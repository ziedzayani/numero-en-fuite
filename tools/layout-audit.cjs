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
 *   SHOTS=/tmp/shots node tools/layout-audit.cjs           enregistre en plus une capture de chaque écran
 * Tailles par défaut : 360×735 (téléphone testé : 1080×2340, barres système déduites), 393×806, 412×870.
 */
const path = require('path');
const { chromium } = require('playwright');
const SIZES = (process.env.SIZES || '360x735,393x806,412x870').split(',').map(s => s.split('x').map(Number));
const LANGS = (process.env.LANGS || 'fr,en,ar,es,it,de,zh,ja').split(',');
const MIN_GAP = 8;
const STATES = {
  accueil: N => {},
  'accueil+invite': N => {
    N.state.modal = 'tutInvite';
  },
  règles: N => {
    N.state.modal = 'rules';
  },
  'accueil à plusieurs': N => {
    N.state.players = 3;
  },
  'menu Plus': N => {
    N.state.players = 2;
    N.state.modal = 'more';
  },
  ...Object.fromEntries(
    ['moved', 'mirror', 'double', 'chFreeze', 'net'].map(k => [
      'astuce ' + k,
      `N => { N.state.players = 1; N.state.level = 'genius'; N.state.mode = 'normal'; N.start(true); N.state.modal = 'tip'; N.state.tipKey = '${k}'; }`
    ])
  ),
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
  'carnet à la main (décaler)': N => {
    N.state.players = 1;
    N.state.level = 'expert';
    N.start(true);
    N.ask(N.state.choices[0]);
    [3, 4, 5, 20, 21].forEach(n => N.toggleMark(n));
    N.state.modal = 'notebook';
  },
  'carnet Génie': N => {
    N.state.players = 1;
    N.state.level = 'genius';
    N.start(true);
    N.ask(N.state.choices[0]);
    N.toggleRange(1, 10);
    N.state.modal = 'notebook';
  },
  'carnet Défi (plage ouverte)': N => {
    N.startChallenge('endless');
    N.ask(N.state.choices[0]);
    N.toggleMark(35);
    N.state.nbZoom = 3;
    N.state.modal = 'notebook';
  },
  'carnet indices': N => {
    N.state.players = 2;
    N.state.level = 'genius';
    N.start(true);
    for (let i = 0; i < 6; i++) N.ask(N.state.choices[0]);
    N.state.nbTab = 'clues';
    N.state.modal = 'notebook';
  },
  'carnet détective (aide)': N => {
    N.state.players = 1;
    N.state.level = 'expert';
    N.state.playerHelp = [true, false, false, false];
    N.start(true);
    N.state.nbTab = 'auto';
    N.state.modal = 'notebook';
  },
  'fin sans capture (points)': N => {
    N.state.players = 2;
    N.state.gameMode = 'score';
    N.start(true);
    N.ask(N.state.choices[0]);
    N.state.turn = N.state.limit - 1;
    N.state.phase = 'result';
    N.state.last = { type: 'wrong', n: 1, player: 1 };
    N.nextTurn();
  },
  'wifi hôte parti (fin)': N => {
    N.state.players = 2;
    N.start(true);
    N.state.screen = 'end';
    N.state.net = { role: 'client', seat: 1 };
    N.state.netLostInfo = { ended: true };
    N.state.modal = 'netLost';
  },
  'wifi réessayer raté': N => {
    N.state.players = 2;
    N.start(true);
    N.state.net = { role: 'client', seat: 1 };
    N.state.netLostInfo = { failed: true };
    N.state.modal = 'netLost';
  },
  ...Object.fromEntries(
    ['rank', 'records', 'badges', 'missions'].map(tab => [
      'bureau ' + tab,
      `N => { N.state.screen = 'office'; N.state.officeTab = '${tab}'; }`
    ])
  ),
  'fin solo gagnée + récompenses': N => {
    N.state.players = 1;
    N.state.level = 'junior';
    N.state.mode = 'normal';
    N.state.replayAsk = false;
    N.start(true);
    N.guess(N.state.secret);
    N.nextTurn();
  },
  'défi difficile : question offerte': N => {
    N.startChallenge('endless', 'hard');
    N.state.modal = null;
    N.mathAnswer(N.state.math.result);
  },
  'défi : laisser filer': N => {
    N.startChallenge('timed', 'medium');
    N.state.modal = null;
    N.passTurn();
  },
  'défi : saut caché': N => {
    N.startChallenge('endless', 'hard');
    N.state.modal = null;
    N.ask(N.state.choices[0]);
    N.state.last.shift = {
      op: 'seq',
      steps: [
        { op: '±', k: 13 },
        { op: '×m', k: 3 }
      ]
    };
  },
  'défi : calcul (gels restants)': N => {
    N.startChallenge('endless', 'medium');
    N.state.modal = null;
    N.state.tab = 'math';
    N.state.showInfo = true;
  },
  'défi : choix et règles': N => {
    N.state.modal = 'challenge';
    N.state.chDiffPref = 'hard';
  },
  'wifi connexion perdue': N => {
    N.state.players = 3;
    N.start(true);
    N.state.net = { role: 'client', seat: 1 };
    N.state.modal = 'netLost';
  },
  'progrès : menu': N => {
    N.state.screen = 'settings';
    N.state.modal = 'backup';
    N.state.backup = { view: 'menu' };
  },
  'progrès : export': N => {
    N.state.screen = 'settings';
    N.state.modal = 'backup';
    N.state.backup = { view: 'export', code: N.exportProgress(), copied: true };
  },
  'progrès : import erreur': N => {
    N.state.screen = 'settings';
    N.state.modal = 'backup';
    N.state.backup = { view: 'import', input: 'xx', error: 'damaged' };
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
    const c = await b.newContext({
      locale: 'fr-FR',
      viewport: { width: w, height: h },
      deviceScaleFactor: 1
    });
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
              gameMode: 'race',
              showInfo: false, // « ℹ️ avantages / risques » : ouvert seulement par l'état qui le demande
              tipsSeen: Object.fromEntries(N.tipKeys.map(k => [k, true])) // astuces auditées à part
            });
            (0, eval)('(' + src + ')')(N);
            N.render();
          },
          [lang, typeof fn === 'string' ? fn : fn.toString()]
        );
        await p.waitForTimeout(450);
        // SHOTS=dossier : enregistre aussi une capture de chaque écran (revue visuelle)
        if (process.env.SHOTS)
          await p.screenshot({
            path: path.join(process.env.SHOTS, `${w}x${h}_${lang}_${name.replace(/[^\wÀ-ÿ+-]+/g, '_')}.png`)
          });
        const r = await p.evaluate(MIN => {
          // mesure la mise en page finale : les animations d'ouverture (zoom des fenêtres…) faussaient les écarts
          if (!document.getElementById('audit-still')) {
            const st = document.createElement('style');
            st.id = 'audit-still';
            st.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}';
            document.head.appendChild(st);
          }
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
                '.keypad, .tut-grid, .grid, .numgrid, .nb-grid, .nb-ranges, .nb-tiles, .selector, .levels, .tabs, .actiontabs, .ch-diffs, .lang-grid, .seg-row, .rp-controls, .timer-modes'
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
          // texte peu lisible : contraste texte / fond (fond = 1er ancêtre opaque, ou 1re couleur d'un dégradé)
          out.contrast = [];
          const rgb = str => {
            const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(str || '');
            return m ? [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]] : null;
          };
          const lum = c => {
            const f = v => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
            return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
          };
          let bgOwner = null;
          const bgOf = e => {
            for (let x = e; x && x.nodeType === 1; x = x.parentElement) {
              const s = getComputedStyle(x);
              bgOwner = x;
              if (/url\(/.test(s.backgroundImage)) return null; // image : non mesurable
              const grad = /gradient/.test(s.backgroundImage) && rgb(s.backgroundImage);
              if (grad && grad[3] > 0.5) return grad;
              const c = rgb(s.backgroundColor);
              if (c && c[3] > 0.5) return c;
            }
            bgOwner = null;
            return [26, 43, 102, 1]; // fond de la page
          };
          for (const e of document.querySelectorAll('#app *')) {
            if (
              !vis(e) ||
              (modal && !modal.contains(e)) ||
              e.closest(
                'svg, .sr-only, [aria-hidden="true"], .detector-orbit, .nb-cell.no, .nb-range.no, .tut-cell.out, .rp-dots, .rp-trail, .rp-pick, .rp-track'
              )
            )
              continue;
            const own = [...e.childNodes].some(n => n.nodeType === 3 && /[\p{L}\p{N}]/u.test(n.textContent));
            if (!own) continue;
            let op = 1;
            for (let x = e; x && x.nodeType === 1; x = x.parentElement) op *= +getComputedStyle(x).opacity;
            if (op < 0.6) continue; // bouton désactivé, élément estompé exprès
            const fg = rgb(getComputedStyle(e).color),
              bg = bgOf(e);
            if (!fg || !bg) continue;
            const a = lum(fg),
              b = lum(bg),
              ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
            if (ratio < 3)
              out.contrast.push(
                label(e) +
                  (bgOwner && bgOwner !== e
                    ? ' sur ' +
                      (bgOwner.className && typeof bgOwner.className === 'string'
                        ? '.' + bgOwner.className.trim().split(/\s+/).join('.')
                        : bgOwner.tagName)
                    : '') +
                  ' ' +
                  ratio.toFixed(1)
              );
          }
          return out;
        }, MIN_GAP);
        n++;
        if (r.page > 0 || r.inner.length || r.gaps.length || r.contrast.length)
          issues.push(
            `${w}x${h} ${lang} « ${name} »` +
              (r.page > 0 ? ` | page défile +${r.page}px` : '') +
              (r.inner.length ? ' | zone défile : ' + r.inner.join(', ') : '') +
              (r.gaps.length ? ' | boutons collés : ' + r.gaps.join(' ; ') : '') +
              (r.contrast.length ? ' | texte peu lisible : ' + r.contrast.slice(0, 6).join(' ; ') : '')
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
