#!/usr/bin/env node
/**
 * Audit de mise en page : pour chaque écran et chaque fenêtre du jeu, dans les 3 langues et
 * plusieurs tailles de téléphone, vérifie :
 *   - qu'il n'y a AUCUN défilement (ni la page, ni une zone interne) ;
 *   - que deux boutons voisins sont espacés d'au moins MIN_GAP px (pas de boutons « collés »).
 * Les grilles de choix (pavé, numéros, niveaux, onglets…) sont exclues : leurs cases sont voulues serrées.
 *
 * Utilisation : npm run audit:layout        (échoue si un problème est trouvé ; utilisé par la CI)
 *   SIZES=360x640 LANGS=fr node tools/layout-audit.cjs   pour une taille ou une langue précise
 * Tailles par défaut : 360×735 (téléphone testé : 1080×2340, barres système déduites), 393×806, 412×870.
 */
const path = require('path');
const { chromium } = require('playwright');
const SIZES = (process.env.SIZES || '360x735,393x806,412x870').split(',').map(s => s.split('x').map(Number));
const LANGS = (process.env.LANGS || 'fr,en,ar').split(',');
const MIN_GAP = 8;
const STATES = {
  accueil: N => {},
  'accueil+invite': N => {
    N.state.modal = 'tutInvite';
  },
  règles: N => {
    N.state.modal = 'rules';
  },
  'défi (fenêtre)': N => {
    N.state.modal = 'challenge';
  },
  'préparation solo': N => {
    N.state.players = 1;
    N.state.modal = 'names';
  },
  'préparation 4 joueurs': N => {
    N.state.players = 4;
    N.state.modal = 'names';
  },
  réglages: N => {
    N.state.screen = 'settings';
  },
  bureau: N => {
    N.state.screen = 'office';
  },
  ...Object.fromEntries(
    [0, 1, 2, 3, 4, 5, 6].map(i => [
      'tuto ' + (i + 1),
      `N => { N.state.modal = 'tutorial'; N.state.tut = { step: ${i}, sel: ${i === 4 ? 1 : i === 5 ? 3 : null}, loopOk: ${i === 4}, miss: null, win: 'precise' }; }`
    ])
  ),
  ...Object.fromEntries(
    ['junior', 'genius'].flatMap(lv =>
      ['question', 'math', 'guess'].map(tab => [
        `jeu ${lv} ${tab}`,
        `N => { N.state.players = 2; N.state.level = '${lv}'; N.state.mode = 'normal'; N.start(true); N.state.tab = '${tab}'; ${tab === 'guess' && lv === 'junior' ? 'N.state.sel = 4;' : ''} }`
      ])
    )
  ),
  'jeu solo genius guess': N => {
    N.state.players = 1;
    N.state.level = 'genius';
    N.state.mode = 'normal';
    N.start(true);
    N.state.tab = 'guess';
  },
  'défi guess': N => {
    N.startChallenge('timed', 'medium');
    N.state.tab = 'guess';
  },
  'défi math': N => {
    N.startChallenge('timed', 'hard');
    N.state.tab = 'math';
  },
  'résultat question': N => {
    N.state.players = 2;
    N.state.level = 'genius';
    N.start(true);
    N.ask(N.state.choices[0]);
  },
  'résultat capture ratée': N => {
    N.state.players = 2;
    N.state.level = 'expert';
    N.start(true);
    N.guess(N.state.secret === 1 ? 2 : 1);
  },
  pause: N => {
    N.state.players = 2;
    N.start(true);
    N.state.modal = 'pause';
  },
  carnet: N => {
    N.state.players = 2;
    N.start(true);
    N.ask(N.state.choices[0]);
    N.nextTurn();
    N.state.modal = 'notebook';
  },
  quitter: N => {
    N.state.players = 2;
    N.start(true);
    N.state.modal = 'quit';
  },
  'passe le téléphone': N => {
    N.state.players = 3;
    N.start();
  },
  'passe le téléphone + annonce de capture': N => {
    N.state.players = 4;
    N.state.gameMode = 'race';
    N.start(true);
    N.state.replayAsk = false;
    N.guess(N.state.secret);
    N.nextTurn();
  },
  'wifi menu': N => {
    N.state.screen = 'lan';
    N.state.lan = { view: 'menu', error: 'host' };
  },
  'wifi salle hôte': N => {
    N.netCreate();
  },
  'wifi rejoindre (erreur)': N => {
    N.state.screen = 'lan';
    N.state.lan = { view: 'join', error: 'notFound' };
  },
  'wifi salle invité': N => {
    N.state.screen = 'lan';
    N.state.lan = { view: 'clientLobby', error: null };
  },
  'wifi jeu (spectateur)': N => {
    N.state.players = 3;
    N.state.level = 'genius';
    N.start(true);
    N.state.net = { role: 'client', seat: 1 };
    N.state.tab = 'guess';
  },
  'wifi attente joueur': N => {
    N.state.players = 3;
    N.start(true);
    N.state.net = { role: 'host', seat: 0 };
    N.state.netWaitSeat = 1;
    N.state.modal = 'netWait';
  },
  'wifi connexion perdue': N => {
    N.state.players = 3;
    N.start(true);
    N.state.net = { role: 'client', seat: 1 };
    N.state.modal = 'netLost';
  },
  'film (proposition)': N => {
    N.state.players = 1;
    N.state.level = 'junior';
    N.start(true);
    N.state.replayAsk = true;
    N.ask(N.state.choices[0]);
    N.nextTurn();
    N.guess(N.state.secret);
    N.state.modal = 'replayAsk';
  },
  film: N => {
    N.state.players = 1;
    N.state.level = 'junior';
    N.start(true);
    N.ask(N.state.choices[0]);
    N.nextTurn();
    N.guess(N.state.secret);
    N.state.modal = 'replay';
    N.state.rpIdx = 1;
    N.state.rpPlaying = false;
  },
  'fin solo gagnée': N => {
    N.state.players = 1;
    N.state.level = 'junior';
    N.state.mode = 'normal';
    N.start(true);
    N.state.replayAsk = false;
    N.guess(N.state.secret === 1 ? 2 : 1);
    N.nextTurn();
    N.mathAnswer(N.state.math.result);
    N.nextTurn();
    N.guess(N.state.secret);
    N.nextTurn();
  },
  'fin solo perdue': N => {
    N.state.players = 1;
    N.state.level = 'malin';
    N.state.mode = 'normal';
    N.start(true);
    N.state.replayAsk = false;
    for (let i = 0; i < 12 && N.state.screen === 'game'; i++) {
      N.guess(N.state.secret === 1 ? 2 : 1);
      N.nextTurn();
    }
  },
  'fin course': N => {
    N.state.players = 3;
    N.state.gameMode = 'race';
    N.start(true);
    N.state.replayAsk = false;
    N.guess(N.state.secret);
    N.nextTurn();
  },
  'fin points': N => {
    N.state.players = 4;
    N.state.gameMode = 'score';
    N.start(true);
    N.state.scores = [12, 7, 3, 9];
    N.state.stars = [2, 1, 0, 3];
    N.state.screen = 'end';
  },
  'fin défi': N => {
    N.startChallenge('timed', 'medium');
    N.state.replayAsk = false;
    N.guess(N.state.secret);
    N.nextTurn();
  }
};
(async () => {
  const b = await chromium.launch();
  const issues = [];
  let n = 0;
  for (const [w, h] of SIZES) {
    const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const p = await c.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    // faux transport muet : les écrans Wi-Fi s'affichent comme dans l'application Android
    await p.addInitScript(() => {
      window.NumeroNet = { hostStart() {}, joinStart() {}, send() {}, stop() {}, keepAwake() {} };
    });
    await p.goto(
      'file://' +
        (process.env.FILE || path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'index.html'))
    );
    for (const lang of LANGS)
      for (const [name, fn] of Object.entries(STATES)) {
        await p.evaluate(
          ([lang, src]) => {
            localStorage.clear();
            const N = window.__numero;
            Object.assign(N.state, {
              lang,
              modal: null,
              screen: 'home',
              mode: 'normal',
              players: 2,
              level: 'junior',
              replayAsk: false,
              tutSeen: true,
              gameMode: 'race'
            });
            (0, eval)('(' + src + ')')(N);
            N.render();
          },
          [lang, typeof fn === 'string' ? fn : fn.toString()]
        );
        await p.waitForTimeout(450);
        const r = await p.evaluate(MIN => {
          const vis = e => {
            const r = e.getBoundingClientRect(),
              s = getComputedStyle(e);
            return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
          };
          const label = e =>
            (e.id ? '#' + e.id : '') +
            (e.className && typeof e.className === 'string'
              ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.')
              : '') +
            ' «' +
            e.textContent.trim().replace(/\s+/g, ' ').slice(0, 22) +
            '»';
          const out = { page: document.scrollingElement.scrollHeight - innerHeight, inner: [], gaps: [] };
          for (const e of document.querySelectorAll('#app *')) {
            const s = getComputedStyle(e);
            if (/(auto|scroll)/.test(s.overflowY) && e.scrollHeight - e.clientHeight > 2 && vis(e))
              out.inner.push(label(e) + ' +' + (e.scrollHeight - e.clientHeight) + 'px');
          }
          // les boutons sous une fenêtre ouverte ne comptent pas
          const modal = document.querySelector('.modal-back');
          const btns = [...document.querySelectorAll('#app button, #app .bigbtn, #app summary')].filter(
            e =>
              vis(e) &&
              (!modal || modal.contains(e)) &&
              !e.closest(
                '.keypad, .tut-grid, .grid, .numgrid, .selector, .levels, .tabs, .actiontabs, .ch-diffs, .lang-grid, .seg-row, .rp-controls, .timer-modes'
              )
          );
          for (let i = 0; i < btns.length; i++)
            for (let j = i + 1; j < btns.length; j++) {
              const a = btns[i].getBoundingClientRect(),
                c = btns[j].getBoundingClientRect();
              if (btns[i].contains(btns[j]) || btns[j].contains(btns[i])) continue;
              const hOverlap = Math.min(a.right, c.right) - Math.max(a.left, c.left),
                vOverlap = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
              let gap = null;
              if (hOverlap > 10)
                gap = Math.max(c.top - a.bottom, a.top - c.bottom); // l'un au-dessus de l'autre
              else if (vOverlap > 10) gap = Math.max(c.left - a.right, a.left - c.right); // côte à côte
              if (gap !== null && gap < MIN)
                out.gaps.push(`${label(btns[i])} ↔ ${label(btns[j])} : ${Math.round(gap)}px`);
            }
          return out;
        }, MIN_GAP);
        n++;
        if (r.page > 0 || r.inner.length || r.gaps.length)
          issues.push(
            `${w}x${h} ${lang} « ${name} »` +
              (r.page > 0 ? ` | page défile +${r.page}px` : '') +
              (r.inner.length ? ' | zone défile : ' + r.inner.join(', ') : '') +
              (r.gaps.length ? ' | boutons collés : ' + r.gaps.join(' ; ') : '')
          );
      }
    if (errs.length) issues.push('ERREURS JS ' + errs.join(' | '));
    await c.close();
  }
  console.log(`${n} écrans contrôlés, ${issues.length} avec problème`);
  console.log(issues.join('\n'));
  await b.close();
  process.exit(issues.length ? 1 : 0);
})();
