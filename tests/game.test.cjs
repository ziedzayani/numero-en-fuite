/*
 * Tests automatiques du jeu « Le Numéro en fuite » (navigateur Chromium sans écran).
 * Usage :  npm ci && npx playwright install chromium   (puis : npm test)
 *          node tests/game.test.cjs [chemin/vers/index.html] [dossier/captures]
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const FILE = path.resolve(
  process.argv[2] || path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'index.html')
);
const SHOTS = process.argv[3] ? path.resolve(process.argv[3]) : null;
const URL = 'file://' + FILE;
const MAX = { junior: 9, malin: 15, expert: 30, genius: 50 };
const RANGE = { junior: 1, malin: 2, expert: 2, genius: 5 };
const LIMIT = [0, 12, 30, 24, 24]; // V8.14 : 10 essais chacun à 2 joueurs

let passed = 0,
  failed = 0;
const failures = [];
function check(cond, msg) {
  if (cond) passed++;
  else {
    failed++;
    failures.push(msg);
    if (failures.length < 40) console.log('  ✗ ' + msg);
  }
}
const S = page => page.evaluate(() => JSON.parse(JSON.stringify(window.__numero.state)));
/* Recalcule, indépendamment du jeu, l'ensemble exact des positions possibles à partir de l'historique :
   on essaie chaque position de départ et on rejoue questions, réponses, éliminations et déplacements. */
// Carnet de référence, écrit indépendamment du moteur : on part de tous les numéros, on applique chaque
// indice puis chaque saut. Saut au sens caché (V8.18) : les deux sens restent possibles.
const EXPECTED_FN = `function(N){const s=N.state,max=N.maxN(),h=s.history;let from=0;for(let i=h.length-1;i>=0;i--)if(h[i].type==='found'||h[i].type==='netHit'){from=i+1;break}
 const W=n=>((n-1)%max+max)%max+1;
 const step=(p,m)=>typeof m==='number'?[W(p+m)]:m.op==='+'?[W(p+m.k)]:m.op==='±'?[W(p+m.k),W(p-m.k)]:m.op==='×'?[W(p*m.k)]:m.op==='×m'?[(p*m.k)%(max+1)]:m.op==='÷'?[Math.ceil(p/m.k)]:m.op==='seq'?m.steps.reduce((a,st)=>a.flatMap(x=>step(x,st)),[p]):[max+1-p];
 let S=Array.from({length:max},(_,k)=>k+1);
 for(const e of h.slice(from)){
  if(e.type==='question')S=S.filter(p=>!!N.qbyid(e.qid).test(p)===e.answer);
  else if(e.type==='math'&&e.correct&&e.qid)S=S.filter(p=>!!N.qbyid(e.qid).test(p)===e.answer);
  else if(e.type==='math'&&e.correct)S=S.filter(p=>(p>e.math.threshold)===e.answer);
  else if(e.type==='wrong')S=S.filter(p=>p!==e.n);
  else if(e.type==='netMiss')S=S.filter(p=>!e.nums.includes(p));
  S=[...new Set(S.flatMap(p=>step(p,e.shift)))];}
 return S.sort((a,b)=>a-b)}`;
const notebookOK = page =>
  page.evaluate(src => {
    const f = eval('(' + src + ')'),
      N = window.__numero,
      exp = f(N),
      got = [...N.state.candidates].sort((a, b) => a - b);
    return {
      ok: exp.join() === got.join() && got.includes(N.state.secret),
      exp: exp.join(),
      got: got.join()
    };
  }, EXPECTED_FN);

async function fresh(browser, viewport = { width: 360, height: 740 }) {
  const ctx = await browser.newContext({
    locale: 'fr-FR',
    viewport,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(String(e)));
  page.on('console', m => {
    if (m.type() === 'error') page.errors.push(m.text());
  });
  page.on('dialog', d => {
    page.errors.push('dialogue natif inattendu : ' + d.message());
    d.dismiss();
  });
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  // premier lancement : la proposition de tutoriel est testée à part (section V8.4)
  await page.evaluate(() => {
    const N = window.__numero;
    N.state.replayAsk = false;
    N.state.tipsSeen = Object.fromEntries(N.tipKeys.map(k => [k, true]));
    if (N.state.modal === 'tutInvite') {
      N.state.modal = null;
      N.render();
    }
  });
  return { ctx, page };
}

/** Accueil V8.13 : « À plusieurs » d'abord, puis le nombre de joueurs. */
async function pickPlayers(page, n, how = 'click') {
  if (n > 1 && !(await page.$(`[data-players="${n}"]`))) await page[how]('#homeMulti');
  await page[how](`[data-players="${n}"]`);
}
/** Accueil V8.13 : les règles, le tutoriel et le Wi-Fi sont dans le menu « Plus ». */
async function viaMore(page, id) {
  if (id === 'openLanMore') id = 'openLan'; // V9.2 : tuile Wi-Fi directement sur l'accueil
  if (!(await page.$('#' + id)) && (await page.$('#openMore'))) await page.click('#openMore');
  await page.click('#' + id);
}

async function noOverflow(page, label) {
  const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(o <= 1, `${label} : pas de débordement horizontal (écart ${o}px)`);
}
async function shot(page, name) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: false });
}

async function playFullGame(browser, players, level, lang = 'fr') {
  const label = `${players}J/${level}/${lang}`;
  const { ctx, page } = await fresh(browser);
  await page.evaluate(() => {
    window.__numero.state.reduceMotion = true;
  });
  if (lang !== 'fr') {
    await page.click('#openSettings');
    await page.click('#openLang');
    await page.click(`[data-language="${lang}"]`);
    await page.click('#closeSettings');
  }
  await pickPlayers(page, players);
  await page.click(`[data-level="${level}"]`);
  await page.click('#start');
  const NAMES = ['Léa', 'Omar', 'Zoé & Co', 'Nour'];
  if (players === 1) {
    check(
      (await page.isVisible('[data-phelp="0"]')) &&
        !(await page.$('#name0')) &&
        !(await page.$('[data-gmode]')),
      `${label} : solo — fenêtre « Prêt ? » avec l’aide (désactivée)`
    );
    await page.click('#namesGo');
    await page.waitForFunction(() => window.__numero.state.screen === 'game');
  }
  if (players > 1) {
    check(await page.isVisible('#name0'), `${label} : saisie des prénoms`);
    for (let i = 0; i < players; i++) await page.fill('#name' + i, i === 1 ? '' : NAMES[i]);
    await page.click('[data-phelp="0"]');
    await page.click('[data-phelp="0"]');
    check(
      (await page.inputValue('#name0')) === 'Léa',
      `${label} : les prénoms restent saisis quand on touche l’aide`
    );
    check((await S(page)).gameMode === 'race', `${label} : mode Course proposé par défaut`);
    await page.click('[data-gmode="score"]');
    await page.click('#namesGo');
    await page.waitForFunction(() => window.__numero.state.screen === 'game');
  }
  let st = await S(page);
  const max = MAX[level];
  if (players > 1) {
    const chips = await page.$$eval('.chip .cname', els => els.map(e => e.textContent.trim()));
    check(
      chips[0] === 'Léa' && /2/.test(chips[1]) && (players < 3 || chips[2] === 'Zoé & Co'),
      `${label} : prénoms affichés (${chips.join(' / ')})`
    );
  }
  check(
    st.screen === 'game' && st.limit === LIMIT[players],
    `${label} : partie lancée avec ${LIMIT[players]} tours`
  );
  check(st.secret >= 1 && st.secret <= max, `${label} : numéro secret dans 1..${max}`);
  const seenQuestions = [];
  let clueCount = 0,
    mathCount = 0,
    guessCount = 0,
    finds = 0;

  for (let turn = 0; turn < st.limit; turn++) {
    st = await S(page);
    if (players > 1) {
      if (turn === 0)
        check(
          !st.modal,
          `${label} : après les prénoms, la partie démarre tout de suite (pas d’écran sombre)`
        );
      else check(st.modal === 'handoff', `${label} t${turn} : écran « passe le téléphone » affiché`);
      if (st.modal === 'handoff') await page.click('#handoffGo');
    }
    st = await S(page);
    const player = turn % players;
    check(st.turn === turn && st.phase === 'choose', `${label} t${turn} : début de tour cohérent`);
    check(
      st.choices.length === 3 && new Set(st.choices).size === 3,
      `${label} t${turn} : 3 questions différentes proposées`
    );
    seenQuestions.push(...st.choices);
    const scoresBefore = st.scores.slice();
    const starsBefore = st.stars.slice();

    const action = turn % 3; // 0 = question, 1 = calcul, 2 = tentative directe
    if (action === 0 || action === 1) {
      const secretBefore = st.secret;
      if (action === 0) {
        await page.click(`[data-question="${st.choices[turn % 3]}"]`);
        clueCount++;
      } else {
        await page.click('[data-tab="math"]');
        const answerRight = turn % 2 === 0;
        const opt = answerRight ? st.math.result : st.math.options.find(o => o !== st.math.result);
        const nOpt = ['expert', 'genius'].includes(level) ? 6 : 3;
        check(
          st.math.options.includes(st.math.result) &&
            new Set(st.math.options).size === nOpt &&
            (await page.$$eval('[data-math]', e => e.length)) === nOpt,
          `${label} t${turn} : calcul avec ${nOpt} réponses dont la bonne`
        );
        await page.click(`[data-math="${opt}"]`);
        mathCount++;
        const after = await S(page);
        check(
          after.stars[player] === starsBefore[player] + (answerRight ? 1 : 0),
          `${label} t${turn} : étoile ${answerRight ? 'gagnée' : 'non gagnée'}`
        );
        check(
          after.scores.join() === scoresBefore.join(),
          `${label} t${turn} : le calcul ne change pas les points`
        );
      }
      let r = await S(page);
      const shift = r.last.shift;
      const okMove =
        level === 'genius'
          ? typeof shift === 'object' && shift !== null
          : Math.abs(shift) <= RANGE[level] && shift !== 0;
      check(
        r.phase === 'result' && okMove,
        `${label} t${turn} : déplacement annoncé ${JSON.stringify(shift)}, jamais 0`
      );
      check(
        (await page.evaluate(({ b, sh }) => window.__numero.moveFn(sh)(b), {
          b: secretBefore,
          sh: shift
        })) === r.secret,
        `${label} t${turn} : déplacement appliqué correctement (bouclage)`
      );
      check(await page.isVisible('#next'), `${label} t${turn} : bouton « Choisir mon numéro » visible`);
      const nb0 = await notebookOK(page);
      check(
        nb0.ok,
        `${label} t${turn} : carnet exact après indice/calcul et déplacement (attendu ${nb0.exp} / carnet ${nb0.got})`
      );
      await page.click('#next');
      r = await S(page);
      check(
        r.phase === 'choose' && r.turn === turn && r.helpUsed && r.tab === 'guess',
        `${label} t${turn} : APRÈS L'AIDE, le même joueur doit tenter un numéro`
      );
      check(
        (await page.isDisabled('[data-tab="question"]')) && (await page.isDisabled('[data-tab="math"]')),
        `${label} t${turn} : 2e aide impossible`
      );
      check(r.scores.join() === scoresBefore.join(), `${label} t${turn} : tour conservé sans pénalité`);
      // tenter directement nextTurn sans deviner ne doit rien faire
      await page.evaluate(() => window.__numero.nextTurn());
      check(
        (await S(page)).turn === turn,
        `${label} t${turn} : impossible de finir le tour sans tenter un numéro`
      );
    }
    st = await S(page);
    check(
      st.candidates.includes(st.secret),
      `${label} t${turn} : le secret reste parmi les pistes possibles`
    );
    // Alterne capture précise / filet magique, réussies ou ratées
    const wantRight = turn % 4 === 1 || turn % 4 === 2;
    const mode = players === 1 || turn % 2 === 0 || !(st.netsLeft[player] > 0) ? 'precise' : 'net';
    const n = await page.evaluate(
      ({ right, mode }) => {
        const N = window.__numero,
          s = N.state,
          max = N.maxN();
        if (right) return s.secret;
        for (let k = 1; k <= max; k++) {
          const c = ((s.secret - 1 + k * 3) % max) + 1;
          if (mode === 'precise' ? c !== s.secret : !N.netRange(c).includes(s.secret)) return c;
        }
        return null;
      },
      { right: wantRight, mode }
    );
    if (st.tab !== 'guess') await page.click('[data-tab="guess"]');
    check(
      (await page.isDisabled('#capPrecise')) && (await page.isDisabled('#capNet')),
      `${label} t${turn} : les 2 boutons de capture attendent un numéro`
    );
    if (max > 30) {
      await page.click('[data-key="clr"]');
      for (const ch of String(n)) await page.click(`[data-key="${ch}"]`);
    } else await page.click(`[data-guess="${n}"]`);
    const inNet =
      max > 30
        ? await page.evaluate(n => window.__numero.netRange(n), n)
        : await page.$$eval('.numtile.in-net', els => els.map(e => Number(e.textContent)));
    const expNet = await page.evaluate(n => window.__numero.netRange(n), n);
    if (players > 1 && st.netsLeft[player] > 0)
      check(
        inNet.join() === expNet.join() &&
          expNet.length === (level === 'junior' ? 2 : 3) &&
          expNet.every(v => v >= 1 && v <= max),
        `${label} t${turn} : filet de ${expNet.length} numéros dans les limites (${expNet.join('·')})`
      );
    await page.click(mode === 'precise' ? '#capPrecise' : '#capNet');
    await page.waitForFunction(() => window.__numero.state.phase === 'result', null, { timeout: 3000 });
    guessCount++;
    const g = await S(page);
    const delta = g.scores[player] - st.scores[player];
    const expDelta = wantRight
      ? (mode === 'precise' ? 10 : 4) + (action === 0 ? 1 : 0)
      : mode === 'precise'
        ? -1
        : -(level === 'junior' ? 2 : 3);
    check(
      delta === expDelta,
      `${label} t${turn} : ${mode} ${wantRight ? 'réussie' : 'ratée'} → ${expDelta > 0 ? '+' : ''}${expDelta} (obtenu ${delta})`
    );
    check(
      g.last.type ===
        (mode === 'precise' ? (wantRight ? 'found' : 'wrong') : wantRight ? 'netHit' : 'netMiss'),
      `${label} t${turn} : type de capture enregistré`
    );
    if (wantRight) finds++;
    const nb = await notebookOK(page);
    check(nb.ok, `${label} t${turn} : carnet exact après la capture (attendu ${nb.exp} / carnet ${nb.got})`);
    if (players === 1 && wantRight) {
      const D = await page.evaluate(l => window.__numero.dictionaries[l], lang);
      check(
        (await page.textContent('#next')).includes(D.soloSeeWin),
        `${label} t${turn} : solo, numéro attrapé → « ${D.soloSeeWin} »`
      );
      await page.click('#next');
      break;
    }
    if (turn + 1 < st.limit) {
      const D = await page.evaluate(l => window.__numero.dictionaries[l], lang);
      const want = players === 1 ? D.nextTurn : D.nextPlayer;
      check((await page.textContent('#next')).includes(want), `${label} t${turn} : bouton « ${want} »`);
    }
    check(g.secret >= 1 && g.secret <= max, `${label} t${turn} : secret toujours valide`);
    await page.click('#next');
  }
  st = await S(page);
  check(st.screen === 'end', `${label} : écran de victoire atteint`);
  if (players === 1)
    check(
      st.soloWon === true && st.turn === 1 && !(await page.textContent('.hero h1')).includes('😅'),
      `${label} : solo gagné dès la 1re capture réussie (tour 2)`
    );
  check(st.captures === finds, `${label} : ${finds} captures comptées`);
  const endText = await page.textContent('#app');
  check(!/\{\w+\}/.test(endText), `${label} : aucun texte non traduit sur l'écran final`);
  check(
    (await page.isVisible('#again')) && (await page.isVisible('#menu')),
    `${label} : boutons Rejouer / Accueil`
  );
  const shown = await page.$$eval('.finalscore .value', els => els.map(e => parseInt(e.textContent)));
  const totals = st.scores.map((v, i) => v + st.stars[i]).sort((a, b) => b - a);
  if (players > 1)
    check(
      shown.join() === totals.join(),
      `${label} : classement final = points + étoiles (${shown.join(', ')})`
    );
  else
    check(
      (await page.$$eval('.solo-stars span.on', e => e.length)) === 3 &&
        (await page.textContent('.hero .intro')).includes('2') &&
        (await page.isVisible('.solo-score')) &&
        (await page.isVisible('.reward-chip.xp')) &&
        !(await page.$('.finalscore')),
      `${label} : écran solo — 3 étoiles (trouvé en 2 tours), score d’enquête, XP, pas de « classement »`
    );
  const unique = new Set(seenQuestions).size;
  check(
    unique >= Math.min(seenQuestions.length, 12) * 0.7,
    `${label} : questions variées (${unique} différentes sur ${seenQuestions.length})`
  );
  check(page.errors.length === 0, `${label} : aucune erreur JavaScript ${page.errors.join(' | ')}`);
  await ctx.close();
  return { clueCount, mathCount, guessCount };
}

(async () => {
  const browser = await chromium.launch();
  console.log('Fichier testé : ' + FILE);

  // 0) Dictionnaires complets
  {
    const { ctx, page } = await fresh(browser);
    const miss = await page.evaluate(() => {
      const d = window.__numero.dictionaries,
        out = [];
      for (const k of Object.keys(d.fr))
        for (const l of ['en', 'ar']) if (!(k in d[l])) out.push(l + ':' + k);
      return out;
    });
    check(miss.length === 0, 'Traductions EN/AR complètes ' + miss.join(','));
    await ctx.close();
  }

  // 1) Parties complètes : 1 à 4 joueurs × 3 niveaux
  for (const players of [1, 2, 3, 4])
    for (const level of ['junior', 'malin', 'expert', ...(players % 2 ? ['genius'] : [])]) {
      const before = failed;
      await playFullGame(browser, players, level);
      console.log(`${failed === before ? '✓' : '✗'} Partie complète ${players} joueur(s), niveau ${level}`);
    }
  for (const lang of ['en', 'ar']) {
    const before = failed;
    await playFullGame(browser, 2, 'expert', lang);
    console.log(`${failed === before ? '✓' : '✗'} Partie complète en langue ${lang}`);
  }

  // 2) Logique : simulation massive (sans interface) des aides, des pistes et des déplacements
  {
    const before = failed;
    const { ctx, page } = await fresh(browser);
    const res = await page.evaluate(
      ({ MAX, RANGE, SRC }) => {
        const EXP = eval('(' + SRC + ')');
        const N = window.__numero,
          errors = [];
        let informative = 0,
          total = 0;
        for (const level of ['junior', 'malin', 'expert', 'genius'])
          for (let rep = 0; rep < 120; rep++) {
            const st = N.state;
            st.players = 1 + (rep % 4);
            st.gameMode = 'score';
            st.level = level;
            N.start();
            if (N.state.modal) N.state.modal = null;
            for (let i = 0; i < 40 && N.state.screen === 'game'; i++) {
              const s = N.state,
                max = MAX[level];
              if (!s.candidates.includes(s.secret)) errors.push('secret hors pistes ' + level);
              const qs = s.choices.map(N.qbyid);
              if (qs.some(q => !q)) errors.push('question introuvable');
              if (s.candidates.length > 1)
                for (const q of qs) {
                  total++;
                  if (s.candidates.some(n => q.test(n)) && s.candidates.some(n => !q.test(n))) informative++;
                }
              if (/\{\w+\}/.test(qs.map(q => q.text).join())) errors.push('question non remplie');
              // V9.15 : les 3 questions couvrent tous les numéros possibles (donc au moins un OUI, sans fuite)
              if (!s.candidates.every(n => qs.some(q => q.test(n))))
                errors.push('questions qui ne couvrent pas ' + level);
              if (!qs.some(q => q.test(s.secret))) errors.push('aucune question à réponse OUI');
              const r = Math.random();
              if (r < 0.4) N.ask(s.choices[0]);
              else if (r < 0.7) {
                N.mathAnswer(Math.random() < 0.7 ? s.math.result : s.math.options[0]);
              }
              if (N.state.phase === 'result') {
                const sh = N.state.last.shift;
                if (level === 'genius' ? typeof sh !== 'object' : Math.abs(sh) > RANGE[level] || sh === 0)
                  errors.push('déplacement invalide ' + JSON.stringify(sh));
                N.nextTurn();
              }
              if (N.state.phase !== 'choose') errors.push('phase inattendue après aide');
              {
                const e = EXP(N);
                if (e.join() !== [...N.state.candidates].sort((a, b) => a - b).join())
                  errors.push('carnet faux après aide ' + level);
              }
              const c = N.state.candidates;
              const pickN = c[Math.floor(Math.random() * c.length)];
              if (N.state.players === 1 || N.netsLeft() === 0 || Math.random() < 0.5)
                N.guess(Math.random() < 0.3 ? 1 + Math.floor(Math.random() * max) : pickN);
              else N.netCapture(1 + Math.floor(Math.random() * max));
              if (N.state.last && N.state.last.type === 'netMiss' && N.state.last.nums.length !== N.netSize())
                errors.push('taille de filet');
              if (N.state.phase !== 'result') errors.push('tentative refusée');
              {
                const e = EXP(N);
                if (e.join() !== [...N.state.candidates].sort((a, b) => a - b).join())
                  errors.push('carnet faux après capture ' + level);
              }
              N.nextTurn();
              if (N.state.modal) N.state.modal = null;
            }
          }
        return { errors: [...new Set(errors)], informative, total };
      },
      { MAX, RANGE, SRC: EXPECTED_FN }
    );
    check(
      res.errors.length === 0,
      'Simulation de 450 parties (carnet vérifié à chaque étape) sans incohérence : ' + res.errors.join(', ')
    );
    check(
      res.informative / res.total > 0.9,
      `Questions utiles (qui départagent les pistes) : ${Math.round((100 * res.informative) / res.total)} %`
    );
    console.log(
      `${failed === before ? '✓' : '✗'} Simulation logique (450 parties) — questions utiles : ${Math.round((100 * res.informative) / res.total)} %`
    );
    await ctx.close();
  }

  // 3) Changement de langue en cours de partie, sauvegarde, reprise, bouton Retour
  {
    const before = failed;
    const { ctx, page } = await fresh(browser);
    await pickPlayers(page, 2);
    await page.click('[data-level="malin"]');
    await page.click('#start');
    await page.click('#namesGo');
    await page.waitForFunction(() => window.__numero.state.screen === 'game');
    let st = await S(page);
    await page.click(`[data-question="${st.choices[0]}"]`);
    const mid = await S(page);
    await page.click('#pause');
    await page.click('#pauseSettings');
    await page.click('#openLang');
    await page.click('[data-language="ar"]');
    check(
      (await page.evaluate(() => document.documentElement.dir)) === 'rtl',
      'Arabe : affichage de droite à gauche'
    );
    await shot(page, '07_reglages_arabe');
    await page.click('#closeSettings');
    await page.waitForTimeout(450);
    check((await S(page)).modal === 'pause', 'Retour des réglages : la partie reste en pause');
    await page.click('#resumeGame');
    let now = await S(page);
    check(
      now.screen === 'game' && now.phase === 'result' && now.turn === mid.turn && now.secret === mid.secret,
      'Changement de langue sans interrompre la partie'
    );
    await shot(page, '08_resultat_arabe');
    await noOverflow(page, 'Résultat en arabe');
    await page.reload();
    now = await S(page);
    check(
      now.screen === 'game' && now.phase === 'result' && now.lang === 'ar' && now.secret === mid.secret,
      'Sauvegarde : la partie reprend après fermeture/réouverture'
    );
    await page.click('#next');
    check((await S(page)).tab === 'guess', 'Après rechargement : le joueur doit toujours tenter un numéro');
    // Bouton Retour Android
    let handled = await page.evaluate(() => window.__numero.back());
    check(
      handled && (await S(page)).modal === 'pause',
      'Retour en partie : met le jeu en pause (fenêtre du jeu, pas de boîte native)'
    );
    await page.click('#resumeGame');
    check(
      (await S(page)).screen === 'game' && !(await S(page)).modal,
      'Pause → Reprendre : on revient dans la partie'
    );
    await page.click('#openNotebook');
    await page.click('[data-nbtab="clues"]');
    check(
      await page.isVisible('.modal .history-items'),
      'Carnet d’indices dans une fenêtre (onglet « Indices »)'
    );
    await page.click('#closeModal');
    await page.click('#pause');
    await page.click('#askQuit');
    check((await S(page)).modal === 'quit', 'Quitter : confirmation demandée');
    await page.click('#quitNo');
    check(
      (await S(page)).modal === 'pause' && (await S(page)).screen === 'game',
      'Quitter → Non : retour au menu Pause'
    );
    await page.click('#askQuit');
    await page.click('#quitYes');
    now = await S(page);
    check(
      now.screen === 'home' && !now.inGame && !(await page.$('#resume')),
      'Quitter : la partie est terminée (pas de « Reprendre »)'
    );
    await page.click('[data-level="junior"]');
    check(
      !(await page.$('#resume')),
      'Changer de niveau après avoir quitté : aucune ancienne partie proposée'
    );
    handled = await page.evaluate(() => window.__numero.back());
    check(handled === false, 'Retour sur l’accueil : l’application peut se fermer');
    check(
      page.errors.length === 0,
      'Aucune erreur JavaScript (langue/sauvegarde) ' + page.errors.join(' | ')
    );
    console.log(
      `${failed === before ? '✓' : '✗'} Langue en cours de partie, sauvegarde, reprise, bouton Retour`
    );
    await ctx.close();
  }

  // 3b) Chronos : global (tour) + réponse, visibles dès le début du tour ; pause ; calculs
  {
    const before = failed;
    const { ctx, page } = await fresh(browser);
    const kinds = () => page.$$eval('[data-tk]', els => els.map(e => e.dataset.tk).join());
    const txt = k => page.textContent(`[data-tk="${k}"] b`);
    const lvls = await page.$$eval('.level', els => els.map(e => e.textContent));
    check(
      lvls.length === 4 && lvls.every(x => !/ans\b|Sauts de/.test(x)),
      'Niveaux : ni âge ni étiquette « Sauts de… » : ' + lvls.join(' / ')
    );
    for (const [level, ans, mathS, glob] of [
      ['junior', 25, 30, 75],
      ['malin', 20, 30, 70],
      ['expert', 20, 45, 90]
    ]) {
      await page.evaluate(lv => {
        const N = window.__numero;
        N.state.players = 2;
        N.state.level = lv;
        N.state.timerMode = 'normal';
        N.start();
      }, level);
      await page.click('#handoffGo');
      check(
        (await kinds()) === 'global,answer' &&
          (await txt('global')).includes(String(glob)) &&
          (await txt('answer')).includes(String(ans)),
        `${level} : dès le début du tour, chrono global ${glob} s + chrono de réponse ${ans} s`
      );
      await page.waitForTimeout(1200);
      let st = await S(page);
      check(st.turnElapsed >= 800 && st.answerElapsed >= 800, `${level} : les deux chronos avancent`);
      await page.click('#pause');
      const p0 = await S(page);
      await page.waitForTimeout(800);
      const p1 = await S(page);
      check(
        p1.turnElapsed === p0.turnElapsed && p1.answerElapsed === p0.answerElapsed,
        `${level} : PAUSE arrête les chronos`
      );
      await page.click('#resumeGame');
      await page.click('[data-tab="math"]');
      check(
        (await kinds()) === 'global,math' && (await txt('math')).includes(String(mathS)),
        `${level} : calcul → chrono global + chrono calcul ${mathS} s`
      );
      check(
        await page.isDisabled('[data-tab="question"]'),
        `${level} : pendant le calcul, pas d’indice en plus`
      );
      const st0 = await S(page);
      await page.evaluate(() => {
        const s = window.__numero.state;
        s.mathElapsed += window.__numero.mathLeft() - 150;
      });
      await page.waitForTimeout(700);
      st = await S(page);
      check(
        st.phase === 'result' &&
          st.last.timeout === true &&
          st.stars[0] === st0.stars[0] &&
          st.scores[0] === st0.scores[0],
        `${level} : calcul hors temps → pas d’étoile, pas de pénalité`
      );
      check(!(await page.$('[data-tk]')), `${level} : chronos arrêtés pendant l’écran de résultat`);
      const g1 = st.turnElapsed;
      await page.waitForTimeout(500);
      check(
        (await S(page)).turnElapsed === g1,
        `${level} : le chrono global ne tourne pas pendant le résultat`
      );
      await page.click('#next');
      st = await S(page);
      check(
        st.phase === 'choose' && st.tab === 'guess' && (await kinds()) === 'global' && st.turnElapsed >= g1,
        `${level} : après le calcul, le chrono global continue (réponse + choix du numéro)`
      );
      await page.evaluate(() => {
        const s = window.__numero.state;
        s.turnElapsed += window.__numero.turnLeft() - 150;
      });
      await page.waitForTimeout(700);
      st = await S(page);
      check(
        st.phase === 'result' && st.last.type === 'timeout' && st.scores.join() === st0.scores.join(),
        `${level} : chrono global écoulé → tour perdu (0 point)`
      );
      await page.click('#next');
      st = await S(page);
      check(st.turn === st0.turn + 1 && st.modal === 'handoff', `${level} : le tour passe au joueur suivant`);
      // Chrono de réponse écoulé pendant la question
      await page.click('#handoffGo');
      await page.evaluate(() => {
        const s = window.__numero.state;
        s.answerElapsed += window.__numero.answerLeft() - 150;
      });
      await page.waitForTimeout(700);
      st = await S(page);
      check(
        st.phase === 'choose' &&
          st.helpUsed &&
          st.tab === 'guess' &&
          (await page.textContent('.pick-hint')).includes('⏱'),
        `${level} : temps de réponse écoulé → plus d’aide, il faut choisir un numéro`
      );
      // Difficulté des calculs
      const ok = await page.evaluate(lv => {
        const N = window.__numero,
          out = [];
        for (let i = 0; i < 300; i++) {
          N.state.level = lv;
          N.state.screen = 'game';
          N.state.phase = 'choose';
          N.start();
          const m = N.state.math;
          const txt = m.text;
          const val = Function('return ' + txt.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-'))();
          if (
            val !== m.result ||
            m.options.length !== (lv === 'expert' ? 6 : 3) ||
            new Set(m.options).size !== m.options.length ||
            m.options.some(o => o < 0) ||
            !m.options.includes(m.result)
          )
            out.push(txt);
          if (lv === 'malin' && /^\d \+ \d$|^1\d \+ \d$/.test(txt)) out.push('trop facile ' + txt);
          if (lv === 'expert' && (txt.match(/[+−×÷]/g) || []).length < 2)
            out.push('pas assez mélangé ' + txt);
        }
        return out;
      }, level);
      check(ok.length === 0, `${level} : 300 calculs justes et adaptés ${ok.slice(0, 3).join(', ')}`);
    }
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.level = 'junior';
      N.state.players = 1;
      N.state.inGame = false;
      N.state.screen = 'home';
      N.state.modal = null;
      N.render();
    });
    await page.click('#openSettings');
    await page.click('[data-timer="long"]');
    await page.click('#closeSettings');
    await page.click('#start');
    await page.click('#namesGo');
    await page.waitForFunction(() => window.__numero.state.screen === 'game');
    check(
      (await txt('global')).includes('113') && (await txt('answer')).includes('38'),
      'Réglage « Plus de temps » : ×1,5 (Petit : 113 s / 38 s)'
    );
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.screen = 'home';
      N.render();
    });
    await page.click('#openSettings');
    await page.click('[data-timer="off"]');
    await page.click('#closeSettings');
    await page.click('#start');
    await page.click('#namesGo');
    await page.waitForFunction(() => window.__numero.state.screen === 'game');
    await page.waitForTimeout(400);
    check(!(await page.$('[data-tk]')), 'Réglage « Sans chrono » : aucun compte à rebours');
    check(page.errors.length === 0, 'Aucune erreur JavaScript (chronos) ' + page.errors.join(' | '));
    console.log(
      `${failed === before ? '✓' : '✗'} Chronos global + réponse (visibles dès le début), pause, difficulté des calculs`
    );
    await ctx.close();
  }

  // 3e) Défi solo (1–100, sauts fous, contre la montre ou sans limite)
  {
    const before = failed;
    const { ctx, page } = await fresh(browser);
    await page.evaluate(() => {
      window.__numero.state.reduceMotion = true;
    });
    await pickPlayers(page, 3);
    await page.click('[data-level="malin"]');
    await page.click('#openChallenge');
    check(
      (await page.isVisible('#chTimed')) && (await page.isVisible('#chEndless')),
      'Défi : choix « contre la montre » ou « sans limite »'
    );
    await page.click('#chEndless');
    let st = await S(page);
    check(
      st.mode === 'challenge' &&
        st.players === 1 &&
        st.limit === 0 &&
        st.secret >= 1 &&
        st.secret <= 100 &&
        st.candidates.length === 100,
      'Défi : solo, numéros 1 à 100, sans limite de tours'
    );
    check(
      (await page.isVisible('[data-tk="chUp"]')) && !(await page.$('[data-tk="global"]')),
      'Défi sans limite : temps écoulé affiché, pas de compte à rebours'
    );
    // pavé numérique
    await page.click('[data-tab="guess"]');
    for (const k of ['4', '7']) await page.click(`[data-key="${k}"]`);
    st = await S(page);
    check(
      st.sel === 47 &&
        (await page.textContent('.kp-display')).includes('47') &&
        (await page.textContent('#capNet')).includes('46·47·48'),
      'Pavé numérique : 47 tapé, filet 46·47·48'
    );
    await page.click('[data-key="del"]');
    await page.click('[data-key="clr"]');
    for (const k of ['1', '0', '0']) await page.click(`[data-key="${k}"]`);
    check(
      (await S(page)).sel === 100 && (await page.textContent('#capNet')).includes('98·99·100'),
      'Pavé : 100, filet sans dépasser 100 (98·99·100)'
    );
    // sauts fous + carnet exact sur de nombreux tours
    const sim = await page.evaluate(src => {
      const EXP = eval('(' + src + ')'),
        N = window.__numero,
        errs = [],
        ops = new Set();
      for (let game = 0; game < 60; game++) {
        N.startChallenge('endless', ['easy', 'medium', 'hard'][game % 3]);
        for (let i = 0; i < 25 && N.state.screen === 'game'; i++) {
          const s = N.state;
          const rr = Math.random();
          if (rr < 0.35) N.ask(s.choices[0]);
          else if (rr < 0.7) N.mathAnswer(Math.random() < 0.6 ? s.math.result : s.math.options[0]);
          if (N.state.last && N.state.last.pick) N.mathPick(N.state.choices[Math.floor(Math.random() * 3)]);
          if (rr > 0.9 && N.state.phase === 'choose') {
            N.passTurn();
          }
          if (N.state.phase === 'result') {
            const m = N.state.last.shift;
            if (N.state.last.frozen ? m !== 0 : typeof m !== 'object')
              errs.push('mouvement incohérent en défi');
            else if (!N.state.last.frozen) ops.add(m.op === '+' ? (m.k > 0 ? '+' : '−') : m.op);
            N.nextTurn();
          }
          const e1 = EXP(N);
          if (e1.join() !== [...N.state.candidates].sort((a, b) => a - b).join())
            errs.push('carnet faux (aide)');
          const c = N.state.candidates;
          const n = c[Math.floor(Math.random() * c.length)];
          if (Math.random() < 0.5) N.guess(Math.random() < 0.2 ? n : 1 + Math.floor(Math.random() * 100));
          else N.netCapture(1 + Math.floor(Math.random() * 100));
          if (
            N.state.screen === 'game' &&
            N.state.phase === 'result' &&
            !['found', 'netHit'].includes(N.state.last.type)
          ) {
            const e2 = EXP(N);
            if (e2.join() !== [...N.state.candidates].sort((a, b) => a - b).join())
              errs.push('carnet faux (capture)');
          }
          N.nextTurn();
        }
      }
      N.state.chDiffPref = 'medium'; // la suite du test joue en Moyen (difficulté par défaut)
      return { errs: [...new Set(errs)], ops: [...ops].sort().join(' ') };
    }, EXPECTED_FN);
    check(
      sim.errs.length === 0,
      'Défi : 60 parties simulées (3 difficultés), carnet exact malgré sens caché, ×2/×3 modulo 101, miroir, doubles sauts, « laisser filer »… ' +
        sim.errs.join(', ')
    );
    check(sim.ops.split(' ').length >= 5, 'Défi : sauts variés observés (' + sim.ops + ')');
    // Calcul juste en défi : gel, +10 (combo seulement visuel), +15 s ; faux : −10 et saut
    const mres = await page.evaluate(() => {
      const N = window.__numero;
      N.startChallenge('timed');
      const s = N.state;
      s.chElapsed = 60000;
      const sec0 = s.secret,
        sc0 = N.chScore();
      N.mathAnswer(s.math.result);
      const a = {
        frozen: s.last.frozen,
        shift: s.last.shift,
        same: s.secret === sec0,
        bonus: s.last.chBonus,
        d: N.chScore() - sc0,
        time: s.chElapsed
      };
      N.nextTurn();
      N.guess((s.secret % 100) + 1 === s.secret ? 1 : (s.secret % 100) + 1);
      N.nextTurn();
      const sc1 = N.chScore(),
        sec1 = s.secret;
      N.mathAnswer(s.math.result);
      const b = {
        bonus: s.last.chBonus,
        streak: s.last.streak,
        same: s.secret === sec1,
        d: N.chScore() - sc1
      };
      N.nextTurn();
      N.guess((s.secret % 100) + 1);
      N.nextTurn();
      const sc2 = N.chScore();
      N.mathAnswer(s.math.options.find(o => o !== s.math.result));
      const c = {
        frozen: s.last.frozen,
        moved: typeof s.last.shift === 'object',
        d: N.chScore() - sc2,
        streak: s.chStreak
      };
      return { a, b, c };
    });
    check(
      mres.a.frozen &&
        mres.a.same &&
        mres.a.shift === 0 &&
        mres.a.bonus === 10 &&
        mres.a.d === 10 &&
        mres.a.time === 52000,
      'Défi : calcul juste → numéro gelé 🧊, +10 points, +8 s au chrono (V8.18)'
    );
    check(
      mres.b.bonus === 10 && mres.b.streak === 2 && mres.b.same && mres.b.d === 10,
      'Défi : 2e calcul juste d’affilée → combo ×2 affiché, toujours +10 (pas de bonus croissant)'
    );
    check(
      !mres.c.frozen && mres.c.moved && mres.c.d === -10 && mres.c.streak === 0,
      'Défi : calcul faux → −10 et saut fou, combo remis à zéro'
    );
    await page.evaluate(() => {
      const N = window.__numero;
      N.startChallenge('endless');
      N.ask(N.state.choices[0]);
      N.nextTurn();
      N.mathAnswer;
    });
    await page.click('#next').catch(() => {});
    await page.evaluate(() => {
      const N = window.__numero;
      N.startChallenge('endless');
    });
    await page.click('[data-tab="math"]');
    await page.click('.mathbox .info-link');
    check(
      (await page.textContent('.mathbox .tradeoff')).includes('🧊'),
      'Défi : avantages du calcul affichés (gel, +10) avec ℹ️'
    );
    await page.click('.mathbox .tradeoff');
    check(!(await page.$('.mathbox .tradeoff')), 'Défi : un toucher referme les avantages / risques');
    await page.click(`[data-math="${(await S(page)).math.result}"]`);
    check(
      (await page.isVisible('.ch-bonus')) && (await page.isVisible('.move-line.frozen')),
      'Défi : résultat « 🧊 +10 points » et « Gelé »'
    );
    const netWin = await page.evaluate(() => {
      localStorage.removeItem('numeroEnFuiteRecords');
      const N = window.__numero;
      N.startChallenge('endless');
      N.netCapture(N.state.secret);
      N.nextTurn();
      return N.state.chFinal;
    });
    check(netWin === 950, `Défi gagné au filet : −50 (score ${netWin})`);
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.screen = 'home';
      N.render();
    });
    await page.click('#openChallenge');
    // victoire + score + record
    await page.evaluate(() => {
      localStorage.removeItem('numeroEnFuiteRecords');
      const N = window.__numero;
      N.startChallenge('endless');
      N.ask(N.state.choices[0]);
      N.nextTurn();
      N.guess(N.state.secret);
    });
    check((await page.textContent('#next')).includes('score'), 'Défi trouvé : bouton « Voir mon score »');
    await page.click('#next');
    st = await S(page);
    check(
      st.screen === 'end' &&
        st.chWon &&
        st.chFinal === 995 &&
        (await page.isVisible('.ch-score')) &&
        (await page.isVisible('.ch-new')),
      `Défi réussi au 1er tour avec 1 question : score 995, nouveau record (${st.chFinal})`
    );
    check(
      (await page.evaluate(() => window.__numero.records()))['endless-medium-v2'] === 995,
      'Record enregistré pour « sans limite / moyen » (règles V8.18)'
    );
    // contre la montre : échec quand le temps est écoulé
    await page.click('#again');
    await page.evaluate(() => {
      const N = window.__numero;
      N.startChallenge('timed');
    });
    check(
      (await page.isVisible('[data-tk="challenge"]')) &&
        (await page.textContent('[data-tk="challenge"] b')).includes('3:00'),
      'Contre la montre : 3:00 affiché'
    );
    await page.evaluate(() => {
      window.__numero.state.chElapsed = 180000 - 150;
    });
    await page.waitForTimeout(700);
    st = await S(page);
    check(
      st.screen === 'end' &&
        st.chWon === false &&
        st.chFinal === 0 &&
        (await page.textContent('.intro')).includes(String(st.chSecret)),
      'Contre la montre : temps écoulé → défi perdu, le numéro est révélé'
    );
    await page.click('#menu');
    st = await S(page);
    check(
      st.screen === 'home' && st.mode === 'normal' && st.players === 3 && st.level === 'malin',
      'Retour à l’accueil : niveau et nombre de joueurs d’avant rétablis'
    );
    check(page.errors.length === 0, 'Aucune erreur JavaScript (défi) ' + page.errors.join(' | '));
    console.log(
      `${failed === before ? '✓' : '✗'} Défi solo : 1–100, pavé, sauts fous, carnet exact, score, record, contre la montre`
    );
    await ctx.close();
  }

  // 3c) Captures animées, détective vivant, aide par joueur, modes Course / Points, animations réduites
  {
    const before = failed;
    const { ctx, page } = await fresh(browser);
    const fresh2 = (lv = 'junior') =>
      page.evaluate(lv => {
        const N = window.__numero;
        N.state.players = 2;
        N.state.gameMode = 'score';
        N.state.starter = 0;
        N.state.level = lv;
        N.state.playerHelp = [false, false, false, false];
        N.start(true);
      }, lv);
    await fresh2();
    const cls = () => page.getAttribute('.turn-card .detective-scene', 'class');
    check(
      /think/.test(await cls()) && /expr-curious/.test(await cls()),
      'Détective : réfléchit (onglet Indice), expression curieuse'
    );
    check(
      (await page.textContent('.bubble .quip')).length > 3,
      'Bulle de dialogue affichée : « ' + (await page.textContent('.bubble .quip')).trim() + ' »'
    );
    await page.click('[data-tab="guess"]');
    check(
      (await page.$$eval('.numtile.possible', e => e.length)) === 0 && !(await page.$('#hints')),
      'Par défaut, aucune aide : pas de numéros en vert'
    );
    check(
      (await page.textContent('.pick-hint')).includes('⚡'),
      'Deviner sans aide : avantage / inconvénient affichés'
    );
    await page.click('[data-guess="9"]');
    check(
      (await page.$$eval('.numtile.in-net', els => els.map(e => e.textContent))).join() === '8,9',
      'Mode Points — filet (Petit) sur 9 → 8·9 (2 numéros, sans dépasser 9)'
    );
    await page.click('[data-guess="1"]');
    check(
      (await page.$$eval('.numtile.in-net', els => els.map(e => e.textContent))).join() === '1,2',
      'Filet (Petit) sur 1 → 1·2'
    );
    check(/aim/.test(await cls()), 'Détective : vise quand un numéro est choisi');
    const sec = (await S(page)).secret;
    await page.click(`[data-guess="${sec}"]`);
    await page.click('#capPrecise');
    check(
      (await page.$$eval('.numtile.hit-precise', e => e.length)) === 1 && (await S(page)).phase === 'choose',
      'Animation de capture précise (cible) avant le résultat'
    );
    await page.click('#capNet', { force: true });
    await page.waitForTimeout(1000);
    let st = await S(page);
    check(
      st.phase === 'result' && st.last.type === 'found' && st.scores[0] === 10,
      'Une seule capture par tour : capture précise réussie +10 (le 2e bouton est ignoré)'
    );
    check(
      /caught/.test(await cls()) && /expr-proud/.test(await cls()) && (await page.$('.turn-card .confetti')),
      'Détective : danse et fierté + confettis quand on gagne'
    );
    check(await page.isVisible('.chip .delta.up'), 'Badge « +10 » sur le score');
    await page.click('#next');
    st = await S(page);
    check(
      st.screen === 'game' && st.turn === 1,
      'Mode Points : après une capture, la partie continue (nouveau numéro)'
    );
    // filet raté, animé
    await fresh2();
    const miss = await page.evaluate(() => {
      const N = window.__numero;
      for (let n = 1; n <= 9; n++) if (!N.netRange(n).includes(N.state.secret)) return n;
    });
    await page.click('[data-tab="guess"]');
    await page.click(`[data-guess="${miss}"]`);
    await page.click('#capNet');
    check(
      (await page.$$eval('.numtile.hit-net', e => e.length)) === 2,
      'Animation du filet sur les 2 numéros'
    );
    await page.waitForTimeout(1000);
    st = await S(page);
    check(
      st.last.type === 'netMiss' &&
        st.scores[0] === -2 &&
        /grimace/.test(await cls()) &&
        /expr-grimace/.test(await cls()),
      'Filet vide (2 numéros) −2 : grimace du détective'
    );
    await fresh2();
    await page.click('[data-tab="math"]');
    check(/search/.test(await cls()), 'Détective : cherche avec sa loupe (calcul)');
    // 3 filets maximum par joueur
    await fresh2('malin');
    const nets = await page.evaluate(() => {
      const N = window.__numero,
        out = [];
      for (let k = 0; k < 4; k++) {
        const s = N.state;
        s.turn = 0;
        s.phase = 'choose';
        s.helpUsed = false;
        s.modal = null;
        const before = N.netsLeft(0);
        N.netCapture((s.secret % 15) + 1 === s.secret ? 1 : ((s.secret + 7) % 15) + 1);
        out.push(before + '>' + N.netsLeft(0) + ':' + s.phase);
      }
      return out;
    });
    check(
      nets.join() === '3>2:result,2>1:result,1>0:result,0>0:choose',
      'Filet : 3 maximum par joueur, le 4e est refusé (' + nets.join(' ') + ')'
    );
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.phase = 'choose';
      N.state.last = null;
      N.render();
    });
    await page.click('[data-tab="guess"]');
    await page.click('[data-guess="5"]');
    check(
      (await page.isDisabled('#capNet')) &&
        (await page.textContent('#capNet')).includes('Plus de filet') &&
        (await page.textContent('#capNet .nets-left')) === '○○○' &&
        (await page.$$eval('.numtile.in-net', e => e.length)) === 0,
      'Filet épuisé : bouton grisé « Plus de filet » (○○○), plus d’aperçu du filet'
    );
    check(
      (await page.evaluate(() => window.__numero.netsLeft(1))) === 3,
      'Les filets sont comptés par joueur (joueur 2 : encore 3)'
    );
    // Aide par joueur : seulement pour le joueur qui l'a activée
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.players = 2;
      N.state.gameMode = 'score';
      N.state.starter = 0;
      N.state.level = 'malin';
      N.state.playerHelp = [false, true, false, false];
      N.start(true);
    });
    await page.click('[data-tab="guess"]');
    check(
      (await page.$$eval('.numtile.possible', e => e.length)) === 0,
      'Aide par joueur : joueur 1 sans aide → pas de vert'
    );
    await page.click('#openNotebook');
    check(
      !(await page.$('[data-nbtab="auto"]')) &&
        (await page.$$('.nb-cell.no')).length === 0 &&
        (await page.isVisible('.nb-grid.mine')),
      'Sans aide : seul le carnet « à la main » (rien de barré tout seul)'
    );
    await page.click('[data-nbtab="clues"]');
    check(
      await page.isVisible('.modal .history-items'),
      'Sans aide : le carnet garde l’historique des indices'
    );
    await page.click('#closeModal');
    await page.evaluate(() => {
      const N = window.__numero;
      N.guess((N.state.secret % 15) + 1);
      N.nextTurn();
      N.state.modal = null;
      N.render();
    });
    await page.click('[data-tab="guess"]');
    check(
      (await page.$$eval('.numtile.possible', e => e.length)) > 0 && !(await page.$('.banner.slim')),
      'Aide par joueur : joueur 2 avec aide → numéros possibles en vert'
    );
    await page.click('#openNotebook');
    await page.click('[data-nbtab="auto"]');
    check(
      (await page.isVisible('.nb-grid:not(.mine)')) && (await page.textContent('.nb-count')).includes('15'),
      'Avec aide : onglet « Détective » avec la grille des possibles'
    );
    await page.click('#closeModal');
    // Encourager les questions : avantages/inconvénients + bonus +1
    await fresh2('malin');
    check(
      !(await page.$('.tradeoff')) && (await page.isVisible('.q-head .info-btn')),
      'Avantages / risques cachés par défaut, bouton ℹ️'
    );
    await page.click('.q-head .info-btn');
    check(
      (await page.isVisible('.tradeoff .up')) && (await page.isVisible('.tradeoff .down')),
      'ℹ️ : les avantages / risques s’affichent au toucher'
    );
    await page.click('[data-tab="math"]');
    check(
      (await page.isVisible('.mathbox .tradeoff')) &&
        (await page.getAttribute('.gbar .brand-icon', 'class').then(c => /thinking/.test(c))) &&
        (await page.isVisible('.logo-bubble')),
      'Calcul : avantages/inconvénients, et le logo réfléchit'
    );
    await fresh2('malin');
    await page.click('[data-question]');
    await page.click('#next');
    let sc0 = (await S(page)).scores[0];
    await page.evaluate(() => {
      window.__numero.state.reduceMotion = false;
    });
    await page.click(`[data-guess="${(await S(page)).secret}"]`);
    await page.click('#capPrecise');
    check(await page.isVisible('.numtile .loupe-fx'), 'Effet loupe sur le numéro au moment de la capture');
    await page.waitForTimeout(1000);
    st = await S(page);
    check(
      st.scores[0] - sc0 === 11 &&
        st.last.bonus === 1 &&
        (await page.isVisible('.bonus-line')) &&
        (await page.isVisible('.found-lens')),
      'Question puis capture précise réussie : +10 +1 bonus = +11, grosse loupe sur le numéro attrapé'
    );
    check(
      (await page.textContent('.chip .delta')).includes('11') &&
        /cheer/.test(await page.getAttribute('.gbar .brand-icon', 'class')),
      'Badge +11 et logo qui fête la capture'
    );
    await fresh2('malin');
    await page.click('[data-question]');
    await page.click('#next');
    sc0 = (await S(page)).scores[0];
    await page.evaluate(() => {
      const N = window.__numero;
      N.netCapture(N.state.secret);
    });
    st = await S(page);
    check(st.scores[0] - sc0 === 5, 'Question puis filet réussi : +4 +1 bonus = +5');
    await fresh2('malin');
    sc0 = (await S(page)).scores[0];
    await page.evaluate(() => {
      const N = window.__numero;
      N.guess(N.state.secret);
    });
    check((await S(page)).scores[0] - sc0 === 10, 'Sans question : capture précise = +10 (pas de bonus)');
    // Mode Course (et solo) : pas de filet, le premier qui attrape gagne
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.players = 3;
      N.state.gameMode = 'race';
      N.state.starter = 0;
      N.state.level = 'junior';
      N.start(true);
    });
    await page.click('[data-tab="guess"]');
    await page.click('[data-guess="5"]');
    check(
      (await page.isVisible('#capNet')) &&
        (await page.$$eval('.numtile.in-net', e => e.length)) === 2 &&
        (await page.textContent('#capNet .nets-left')) === '●●●',
      'Mode Course : filet disponible 3 fois (●●●)'
    );
    const raceNet = await page.evaluate(() => {
      const N = window.__numero;
      const s0 = N.state.scores[0],
        sec0 = N.state.secret;
      N.netCapture(N.state.secret);
      const r = [N.state.last.type, N.state.scores[0] - s0, N.netsLeft(0)];
      N.nextTurn();
      return [...r, N.state.screen, N.state.placed.map(x => x.player).join('')];
    });
    check(
      raceNet.join() === 'netHit,4,2,end,0',
      'Mode Course (V9.7) : un filet réussi fait gagner le joueur 1, la partie s’arrête (' +
        raceNet.join(' ') +
        ')'
    );
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.players = 3;
      N.state.gameMode = 'race';
      N.state.starter = 0;
      N.state.level = 'junior';
      N.start(true);
    });
    await page.evaluate(() => {
      const N = window.__numero;
      N.guess((N.state.secret % 9) + 1);
      N.nextTurn();
      N.state.modal = null;
      N.guess(N.state.secret);
    });
    check(
      !(await page.isVisible('.podium-note')) && (await page.textContent('#next')).includes('classement'),
      'Mode Course : capture → bouton « Voir les résultats » (plus de « Continuer »)'
    );
    await page.click('#next');
    st = await S(page);
    const pod = await page.$$eval('.finalscore', e => e.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
    check(
      st.screen === 'end' &&
        st.raceWinner === 1 &&
        (await page.textContent('.hero h1')).includes('Joueur 2') &&
        pod.length === 3 &&
        /^🥇\s*Joueur 2/.test(pod[0]),
      'Mode Course : le premier qui attrape gagne, fin immédiate, les autres classés aux points (' +
        pod.join(' / ') +
        ')'
    );
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.players = 3;
      N.state.gameMode = 'race';
      N.state.starter = 0;
      N.state.level = 'junior';
      N.start(true);
      N.state.modal = null;
      N.guess((N.state.secret % 9) + 1);
      N.nextTurn();
      N.state.modal = null;
      N.guess(N.state.secret);
      N.nextTurn();
      N.state.modal = null;
      for (let i = 0; i < 40 && N.state.screen === 'game'; i++) {
        N.guess((N.state.secret % 9) + 1);
        N.nextTurn();
        N.state.modal = null;
      }
      N.render();
    });
    check(
      (await page.textContent('.next-starter')).includes('Joueur 2'),
      'Rejouer : le joueur suivant commencera (Joueur 2)'
    );
    await page.click('#again');
    st = await S(page);
    check(
      st.starter === 1 &&
        st.modal === 'handoff' &&
        (await page.textContent('.modal h2')).includes('Joueur 2'),
      'Rotation : la nouvelle partie commence par le joueur 2'
    );
    await page.evaluate(() => {
      const N = window.__numero;
      for (let i = 0; i < 40 && N.state.screen === 'game'; i++) {
        N.state.modal = null;
        if (i % 3 === 0) N.mathAnswer(N.state.math.result), N.nextTurn();
        N.guess((N.state.secret % 9) + 1);
        N.nextTurn();
      }
    });
    st = await S(page);
    check(
      st.screen === 'end' &&
        st.raceWinner == null &&
        (await page.textContent('.hero h1')).includes('Personne') &&
        (await page.isVisible('.finalscore')),
      'Mode Course sans capture après le dernier tour : départage aux points et ⭐'
    );
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.players = 1;
      N.start();
    });
    await page.click('[data-tab="guess"]');
    check(await page.isVisible('#capNet'), 'Solo : filet disponible (3 fois)');
    // boutons plats
    check(
      await page.evaluate(() =>
        [...document.querySelectorAll('button')].every(b => getComputedStyle(b).boxShadow === 'none')
      ),
      'Boutons plats : plus de reflet sous les boutons'
    );
    // animations réduites
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.screen = 'settings';
      N.render();
    });
    await page.click('#motionToggle');
    check(
      await page.evaluate(() => document.body.classList.contains('reduce-motion')),
      'Option « Réduire les animations »'
    );
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.screen = 'game';
      N.state.modal = null;
      N.render();
    }); // le détective (V9 : SVG animé) est sur l'écran de jeu
    const an = await page.evaluate(() => {
      const els = [...document.querySelectorAll('.detective-scene, .detective-scene *')];
      return els.length >= 2 && els.every(e => ['none', ''].includes(getComputedStyle(e).animationName));
    });
    check(an, 'Animations coupées quand l’option est active (détective compris)');
    check(
      page.errors.length === 0,
      'Aucune erreur JavaScript (captures/détective/aide/modes) ' + page.errors.join(' | ')
    );
    console.log(
      `${failed === before ? '✓' : '✗'} Captures, détective, aide par joueur, modes Course / Points, boutons plats`
    );
    await ctx.close();
  }

  // 3d) Accueil sans défilement, réglages au doigt sans clignotement, prénoms spéciaux
  {
    const before = failed;
    for (const [w, h] of [
      [360, 640],
      [360, 740],
      [412, 800]
    ])
      for (const lang of ['fr', 'ar']) {
        const { ctx, page } = await fresh(browser, { width: w, height: h });
        if (lang === 'ar') {
          await page.evaluate(() => {
            window.__numero.state.lang = 'ar';
            window.__numero.render();
          });
        }
        await page.waitForTimeout(450);
        const sc = await page.evaluate(() => document.scrollingElement.scrollHeight - window.innerHeight);
        check(sc <= 1, `Accueil ${w}×${h} (${lang}) : tout tient sans défiler (${sc}px)`);
        if (w === 360 && h === 640) await shot(page, `00_accueil_${lang}_360x640`);
        await ctx.close();
      }
    for (const [w, h] of [
      [360, 700],
      [412, 760]
    ]) {
      const { ctx, page } = await fresh(browser, { width: w, height: h });
      const worst = await page.evaluate(() => {
        let m = 0;
        for (const lv of ['junior', 'malin', 'expert', 'genius'])
          for (let k = 0; k < 15; k++) {
            const N = window.__numero;
            N.state.players = 2;
            N.state.names = ['Assya', 'Zied', '', ''];
            N.state.level = lv;
            N.start();
            N.state.modal = null;
            N.render();
            const el = document.querySelector('.turn-body');
            m = Math.max(m, el.scrollHeight - el.clientHeight);
          }
        return m;
      });
      check(
        worst <= 2,
        `Onglet Indice ${w}×${h} (4 niveaux, 60 tirages) : rien à faire défiler (${worst}px)`
      );
      await ctx.close();
    }
    const { ctx, page } = await fresh(browser);
    await page.tap('#openSettings');
    await page.waitForTimeout(500);
    const flashCheck = async label => {
      await page.waitForTimeout(60);
      const r = await page.evaluate(() => ({
        cls: document.getElementById('app').classList.contains('screen-enter'),
        anim: [...document.querySelectorAll('#app > *')].some(el =>
          el.getAnimations().some(a => a.animationName === 'screenIn')
        )
      }));
      check(!r.cls && !r.anim, `Réglages « ${label} » : pas de clignotement de l’écran`);
    };
    const taps = [
      ['[data-language="en"]', st => st.lang === 'en', 'English'],
      ['[data-language="ar"]', st => st.lang === 'ar', 'العربية'],
      ['[data-language="fr"]', st => st.lang === 'fr', 'Français'],
      ['#soundToggle', st => st.sound === false, 'Son coupé'],
      ['#soundToggle', st => st.sound === true, 'Son activé'],
      ['[data-timer="long"]', st => st.timerMode === 'long', 'Plus de temps'],
      ['[data-timer="off"]', st => st.timerMode === 'off', 'Sans chrono'],
      ['[data-timer="normal"]', st => st.timerMode === 'normal', 'Chrono normal'],
      ['#motionToggle', st => st.reduceMotion === true, 'Animations réduites'],
      ['#motionToggle', st => st.reduceMotion === false, 'Animations normales']
    ];
    for (const [sel, ok, label] of taps) {
      if (sel.startsWith('[data-language')) await page.tap('#openLang');
      await page.locator(sel).scrollIntoViewIfNeeded();
      await page.tap(sel);
      check(ok(await S(page)), `Réglages : le bouton « ${label} » fonctionne au toucher`);
      await flashCheck(label);
    }
    await page.tap('#closeSettings');
    check((await S(page)).screen === 'home', 'Réglages : bouton Retour');
    // prénoms avec caractères spéciaux
    await pickPlayers(page, 2, 'tap');
    await page.tap('#start');
    await page.fill('#name0', `<b>Al'i</b>`);
    await page.fill('#name1', 'Inès');
    await page.tap('#namesGo');
    await page.waitForFunction(() => window.__numero.state.screen === 'game');
    const t0 = await page.textContent('.bubble b');
    check(
      t0.includes(`<b>Al'i</b>`) && !(await page.$('.modal-back')),
      'Prénom avec caractères spéciaux affiché tel quel, partie lancée en un seul appui'
    );
    await page.tap('[data-tab="question"]');
    await page.tap('[data-question]');
    await page.tap('#openNotebook');
    await page.tap('[data-nbtab="clues"]');
    check(
      (await page.textContent('.modal .history-items')).includes(`<b>Al'i</b>`),
      'Prénom correct dans le carnet'
    );
    check(
      page.errors.length === 0,
      'Aucune erreur JavaScript (accueil/réglages/prénoms) ' + page.errors.join(' | ')
    );
    console.log(
      `${failed === before ? '✓' : '✗'} Accueil sans défilement, réglages au toucher sans clignotement, prénoms`
    );
    await ctx.close();
  }

  // 3f) Film du parcours du numéro
  {
    const before = failed;
    const { ctx, page } = await fresh(browser);
    const chk = await page.evaluate(() => {
      const N = window.__numero,
        errs = [];
      let hunts = 0,
        steps = 0;
      const verify = () => {
        const h = N.state.lastHunt;
        if (!h) {
          errs.push('pas de parcours');
          return;
        }
        hunts++;
        steps += h.steps.length;
        if (!h.steps.length) {
          if (h.start !== h.end.n) errs.push('départ ≠ capture sans saut');
          return;
        }
        if (h.steps[0].from !== h.start) errs.push('1er saut ne part pas du départ');
        for (let k = 1; k < h.steps.length; k++)
          if (h.steps[k].from !== h.steps[k - 1].to) errs.push('saut discontinu');
        if (h.steps[h.steps.length - 1].to !== h.end.n) errs.push('dernière position ≠ numéro attrapé');
        if (h.steps.some(st => !st.ev)) errs.push('saut sans événement');
        for (const st of h.steps)
          if (!st.frozen && N.moveFn(st.shift)(st.from) !== st.to) errs.push('saut mal calculé');
      };
      for (const lv of ['junior', 'malin', 'expert', 'genius', 'challenge'])
        for (let gm = 0; gm < 40; gm++) {
          if (lv === 'challenge') N.startChallenge('endless');
          else {
            N.state.players = 1 + (gm % 3);
            N.state.gameMode = 'score';
            N.state.level = lv;
            N.start();
          }
          for (let i = 0; i < 30 && N.state.screen === 'game'; i++) {
            const s = N.state;
            s.modal = null;
            const r = Math.random();
            if (r < 0.3) N.ask(s.choices[0]);
            else if (r < 0.55) N.mathAnswer(Math.random() < 0.6 ? s.math.result : s.math.options[0]);
            if (N.state.phase === 'result') N.nextTurn();
            N.state.modal = null;
            const c = N.state.candidates,
              pickn = c[Math.floor(Math.random() * c.length)];
            if (Math.random() < 0.5) N.guess(Math.random() < 0.35 ? N.state.secret : pickn);
            else N.netCapture(Math.random() < 0.3 ? N.state.secret : pickn);
            if (N.state.last && ['found', 'netHit'].includes(N.state.last.type)) verify();
            N.nextTurn();
          }
        }
      return { errs: [...new Set(errs)], hunts, steps };
    });
    check(
      chk.errs.length === 0 && chk.hunts > 100,
      `Parcours exact et continu sur ${chk.hunts} captures (${chk.steps} sauts), 4 niveaux + défi ${chk.errs.join(', ')}`
    );
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.replayAsk = true;
      N.state.players = 2;
      N.state.gameMode = 'score';
      N.state.starter = 0;
      N.state.level = 'malin';
      N.state.reduceMotion = false;
      N.start(true);
    });
    await page.click('[data-question]');
    await page.click('#next');
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.modal = null;
      N.guess((N.state.secret % 15) + 1);
      N.nextTurn();
      N.state.modal = null;
      N.render();
    });
    await page.click('[data-tab="guess"]');
    const sec = (await S(page)).secret;
    await page.click(`[data-guess="${sec}"]`);
    await page.click('#capPrecise');
    await page.waitForTimeout(900);
    check(!(await S(page)).modal, 'La fenêtre attend la fin de l’animation de capture');
    await page.waitForTimeout(1700);
    check(
      !(await S(page)).modal && (await page.isVisible('#openReplay')),
      'Après la capture : pas de fenêtre « Revoir l’évasion ? » (V9.4), bouton « Revoir son parcours » dans le résultat'
    );
    await page.click('#openReplay');
    const h = (await S(page)).lastHunt;
    const frames = 2 + h.steps.length;
    check(
      (await page.isVisible('.modal.replay')) &&
        (await page.textContent('.rp-num')).trim() === String(h.start) &&
        (await page.textContent('.rp-step')).includes(`/ ${frames}`),
      `Film : départ sur le ${h.start}, ${frames} étapes`
    );
    await page.click('#rpPlay');
    const seq = [];
    for (let k = 1; k < frames; k++) {
      await page.click('#rpNext');
      seq.push(Number((await page.textContent('.rp-num')).trim()));
    }
    const want = [...h.steps.map(st => st.to), h.end.n];
    check(
      seq.join() === want.join(),
      `Film : chaque étape montre la bonne position (${[h.start, ...seq].join(' → ')})`
    );
    check(
      (await page.isVisible('.rp-stage.win')) &&
        (await page.textContent('.rp-cap')).includes(String(h.end.n)),
      'Film : la dernière étape montre la capture'
    );
    check(
      (await page.$$eval('.rp-track span.trail, .rp-track span.cur', e => e.length)) >= 1,
      'Film : traces du parcours sur la grille'
    );
    // le choix raté du joueur est montré
    const missIdx = 1 + h.steps.findIndex(st => st.ev && st.ev.type === 'wrong');
    await page.click('#rpRestart');
    await page.click('#rpModeManual');
    for (let k = 0; k < missIdx; k++) await page.click('#rpNext');
    const missEv = h.steps[missIdx - 1].ev;
    check(
      (await page.isVisible('.rp-pick.bad')) &&
        (await page.textContent('.rp-pick')).includes(String(missEv.n)) &&
        (await page.$$eval('.rp-track span.miss', e => e.map(x => x.textContent).join())) ===
          String(missEv.n),
      `Film : le choix raté (${missEv.n}) est montré, en rouge sur la grille`
    );
    check(await page.isVisible('.rp-was'), 'Film : « il était sur le … » à côté du choix raté');
    const wrapOk = await page.evaluate(() => {
      const N = window.__numero,
        s = N.state;
      s.lastHunt = {
        start: 2,
        max: 15,
        steps: [
          {
            from: 2,
            to: 15,
            shift: -2,
            ev: { type: 'question', player: 0, qid: s.choices[0], answer: false, shift: -2 }
          }
        ],
        end: { type: 'found', player: 0, n: 15 }
      };
      s.rpIdx = 1;
      s.rpPlaying = false;
      N.render();
      const mv = document.querySelector('.rp-move'),
        sp = mv.querySelectorAll('span');
      return (
        sp[0].textContent === '2' &&
        sp[1].textContent === '15' &&
        mv.querySelector('.mv-arrow i').textContent === '−2' &&
        document.querySelector('.rp-hint.wrap').textContent.includes('15')
      );
    });
    check(wrapOk, 'Film : 2 ──−2──➜ 15 avec « Après 1, il repart de 15 » (flèche dans le bon sens)');
    check(
      !(await page.textContent('.rp-cap')).includes('⬅'),
      'Film : la légende ne répète pas la flèche du saut'
    );
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.rpIdx = 0;
      N.render();
    });
    check(
      (await page.isVisible('#rpNext')) &&
        (await page.textContent('#rpNext')).includes('Suivant') &&
        (await page.textContent('#rpPrev')).includes('Précédent'),
      'Film « Avec les boutons » : boutons « Précédent » et « Suivant » visibles'
    );
    check(
      await page.evaluate(() =>
        [...document.querySelectorAll('.rp-ctrl .key')].every(
          b =>
            b.scrollWidth <= b.clientWidth + 1 &&
            b.getBoundingClientRect().width >= 40 &&
            b.getBoundingClientRect().height >= 40
        )
      ),
      'Film : boutons assez grands, textes non coupés'
    );
    // mode boutons : pas d'enchaînement automatique
    const idxM = (await S(page)).rpIdx;
    await page.waitForTimeout(6600);
    check(
      (await S(page)).rpIdx === idxM && !(await page.$('#rpPlay')) && !(await page.$('.rp-bar')),
      'Film « Avec les boutons » : pas d’enchaînement automatique'
    );
    // pas de flash : la fenêtre n'est pas ré-animée entre deux étapes
    await page.click('#rpNext');
    const anims = await page.evaluate(() =>
      [...document.querySelectorAll('.modal-back, .modal-back > .modal')].flatMap(el =>
        el.getAnimations().map(a => a.animationName)
      )
    );
    check(anims.length === 0, 'Film : aucun fondu de la fenêtre entre deux étapes (plus d’écran noir)');
    check(
      (await page.evaluate(() => getComputedStyle(document.querySelector('.modal-back')).backgroundColor)) ===
        'rgba(20, 32, 74, 0.8)',
      'Film : le fond sombre reste identique d’une étape à l’autre'
    );
    // mode automatique : 6 s par étape
    await page.click('#rpModeAuto');
    await page.click('#rpRestart');
    await page.waitForTimeout(4700);
    check(
      (await S(page)).rpIdx === 0 && (await page.isVisible('.rp-bar')),
      'Film automatique : l’étape reste affichée (pas d’enchaînement avant 6 s), barre de temps'
    );
    await page.waitForTimeout(2000);
    check((await S(page)).rpIdx === 1, 'Film automatique : étape suivante après 6 s');
    check((await page.evaluate(() => window.__numero.RP_STEP)) === 6000, 'Film : 6 secondes par étape');
    await page.click('#rpClose');
    check(!(await S(page)).modal, 'Film : fermeture');
    await page.click('#next');
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.modal = null;
      N.state.lang = 'ar';
      N.state.reduceMotion = true;
      N.guess(N.state.secret);
    });
    await page.waitForTimeout(300);
    check(!(await S(page)).modal, 'Arabe : pas de fenêtre après la capture non plus');
    await page.click('#openReplay');
    check(await page.isVisible('.modal.replay'), 'Film disponible en arabe');
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.lang = 'fr';
      N.state.players = 1;
      N.start();
      for (let i = 0; i < 40 && N.state.screen === 'game'; i++) {
        N.state.modal = null;
        N.guess((N.state.secret % N.maxN()) + 1);
        N.nextTurn();
      }
    });
    const st = await S(page);
    check(
      st.screen === 'end' &&
        st.soloWon === false &&
        (await page.textContent('.hero h1')).includes('échappé') &&
        (await page.textContent('.intro')).includes(String(st.soloSecret)),
      'Solo non trouvé en 12 tours : « Il t’a échappé », le numéro est révélé'
    );
    check(
      (await page.isVisible('.solo-reveal .lens-glass')) &&
        !(await page.$('.solo-stars')) &&
        !(await page.$('.finalscore')),
      'Solo perdu : loupe sur le numéro caché, pas d’étoiles ni de score'
    );
    // Ponctuation des questions dans les 3 langues
    const punct = await page.evaluate(() => {
      const D = window.__numero.dictionaries,
        bad = [];
      for (const [l, d] of Object.entries(D))
        for (const [k, v] of Object.entries(d)) {
          if (typeof v !== 'string') continue;
          if (/^\s*[?؟❓]/.test(v)) bad.push(l + ':' + k + ' commence par ?');
          if (l === 'fr' && /[^\u00a0]\?/.test(v.replace(/\?\u00a0/g, '?')))
            bad.push('fr:' + k + ' sans espace insécable avant ?');
          if (l === 'en' && /\s\?/.test(v)) bad.push('en:' + k + ' espace avant ?');
          if (l === 'ar' && /\?/.test(v)) bad.push('ar:' + k + ' « ? » au lieu de « ؟ »');
        }
      return bad;
    });
    check(punct.length === 0, 'Points d’interrogation corrects en FR / EN / AR ' + punct.join(', '));
    check(!(await page.content()).includes('❓'), 'Aucune icône ❓ en début de phrase');
    check(page.errors.length === 0, 'Aucune erreur JavaScript (film) ' + page.errors.join(' | '));
    console.log(`${failed === before ? '✓' : '✗'} Film du parcours : exact, popup, lecture pas à pas, arabe`);
    await ctx.close();
  }

  // 3g) V8.4 : barème du défi anti-abus, chrono figé sur les résultats, difficultés, sauts jamais sur place,
  //     version affichée, tutoriel, mini-carnet, sauts « à l'aveugle », sous-totaux
  {
    const before = failed;
    const { ctx, page } = await fresh(browser, { width: 412, height: 800 });
    // Critère de l'audit : retarder volontairement la capture ne doit JAMAIS rapporter plus qu'une capture plus rapide.
    const abuse = await page.evaluate(() => {
      const N = window.__numero,
        bad = [];
      const run = (kind, diff, plan) => {
        N.startChallenge(kind, diff);
        const s = N.state;
        s.chElapsed = 60000;
        for (const a of plan) {
          if (a === 'calc') {
            N.mathAnswer(s.math.result);
            if (N.state.last && N.state.last.pick) N.mathPick(N.state.choices[0]);
          } else if (a === 'q') N.ask(s.choices[0]);
          else if (a === 'badcalc') N.mathAnswer(s.math.options.find(o => o !== s.math.result));
          if (s.phase === 'result') N.nextTurn();
          if (a === 'net') N.netCapture(s.secret > 50 ? 1 : 100);
          else N.guess(s.secret === 1 ? 2 : s.secret - 1);
          N.nextTurn();
        }
        N.guess(N.state.secret);
        N.nextTurn();
        return N.state.chFinal;
      };
      let sims = 0;
      for (const kind of ['timed', 'endless'])
        for (const diff of ['easy', 'medium', 'hard']) {
          const quick = run(kind, diff, []);
          for (let k = 1; k <= 8; k++) {
            const sc = run(kind, diff, Array(k).fill('calc'));
            sims++;
            if (sc >= quick) bad.push(`${kind}/${diff} ${k} calculs+ratés : ${sc} ≥ ${quick}`);
          }
          for (let r = 0; r < 20; r++) {
            const plan = Array.from(
              { length: 1 + Math.floor(Math.random() * 6) },
              () => ['calc', 'calc', 'q', 'badcalc', 'none', 'net'][Math.floor(Math.random() * 6)]
            );
            const sc = run(kind, diff, plan);
            sims++;
            if (sc >= quick) bad.push(`${kind}/${diff} [${plan}] : ${sc} ≥ ${quick}`);
          }
        }
      // le scénario de l'audit : 8 calculs justes + 7 ratés puis capture (1 205 points en V8.3)
      const audit = run('endless', 'hard', Array(7).fill('calc'));
      return { bad, sims, audit, quick: run('endless', 'hard', []) };
    });
    check(
      abuse.bad.length === 0,
      `Défi : ${abuse.sims} parties « retardées exprès » ne battent jamais une capture plus rapide ` +
        abuse.bad.slice(0, 3).join(' | ')
    );
    check(
      abuse.audit < abuse.quick,
      `Défi : le scénario de l’audit (7 calculs justes + 7 ratés) ne rapporte plus (${abuse.audit} < ${abuse.quick})`
    );
    // chrono du défi figé pendant la lecture du résultat
    const tm = await page.evaluate(async () => {
      const N = window.__numero,
        wait = ms => new Promise(r => setTimeout(r, ms));
      N.startChallenge('timed', 'medium');
      N.state.modal = null;
      N.render();
      N.ask(N.state.choices[0]);
      const a = N.state.chElapsed;
      await wait(900);
      const b = N.state.chElapsed;
      N.nextTurn();
      await wait(900);
      const c = N.state.chElapsed;
      N.startChallenge('endless', 'medium');
      N.ask(N.state.choices[0]);
      const d = N.state.chElapsed;
      await wait(700);
      return { result: b - a, play: c - b, endless: N.state.chElapsed - d };
    });
    check(
      tm.result === 0 && tm.endless === 0,
      `Défi : chrono arrêté pendant l’écran de résultat (+${tm.result} ms, sans limite +${tm.endless} ms)`
    );
    check(tm.play >= 600, `Défi : le chrono repart quand on rejoue (+${tm.play} ms)`);
    // difficultés
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.screen = 'home';
      N.state.mode = 'normal';
      N.state.modal = null;
      N.render();
    });
    await page.click('#openChallenge');
    check(
      (await page.$$('[data-chdiff]')).length === 3 && (await page.isVisible('[data-chdiff="medium"].on')),
      'Défi : 3 difficultés, « Moyen » par défaut'
    );
    await page.click('[data-chdiff="easy"]');
    await page.click('#chEndless');
    const easy = await page.evaluate(() => {
      const N = window.__numero,
        r = [];
      let small = 0;
      for (let i = 0; i < 60; i++) {
        N.startChallenge('endless', 'easy');
        const m = N.state.math;
        r.push(m.result, ...m.options);
        if (/^\d \+ \d$|^\d+ − \d$/.test(m.text || '') && m.result <= 10) small++;
      }
      return {
        level: N.state.level,
        diff: N.state.chDiff,
        small,
        n: N.state.math.options.length,
        maxN: N.maxN()
      };
    });
    check(
      easy.level === 'junior' &&
        easy.diff === 'easy' &&
        easy.small === 0 &&
        easy.n === 3 &&
        easy.maxN === 100,
      `Défi facile (V9.4) : calculs du niveau Moyen (retenues, tables), plus de « 5 + 2 » ; numéros 1–100`
    );
    const hard = await page.evaluate(() => {
      const N = window.__numero;
      N.startChallenge('timed', 'hard');
      return [N.state.level, N.state.math.options.length, N.state.chDiffPref].join();
    });
    check(
      hard === 'expert,6,hard',
      'Défi difficile : calculs à priorités, 6 propositions, choix mémorisé (' + hard + ')'
    );
    const recs = await page.evaluate(() => {
      localStorage.removeItem('numeroEnFuiteRecords');
      const N = window.__numero;
      N.startChallenge('endless', 'easy');
      N.guess(N.state.secret);
      N.nextTurn();
      N.startChallenge('endless', 'hard');
      N.ask(N.state.choices[0]);
      N.nextTurn();
      N.guess(N.state.secret);
      N.nextTurn();
      return N.records();
    });
    check(
      recs['endless-easy-v2'] === 1000 && recs['endless-hard-v2'] === 995 && !('endless' in recs),
      'Défi : un record par difficulté ' + JSON.stringify(recs)
    );
    // sauts spéciaux : jamais sur place (÷2 sur 1, ×2 sur le maximum)
    const still = await page.evaluate(() => {
      const N = window.__numero;
      let same = 0,
        n = 0;
      for (let i = 0; i < 150; i++) {
        N.state.players = 1;
        N.state.level = 'genius';
        N.state.mode = 'normal';
        N.start(true);
        N.state.modal = null;
        N.state.secret = 50;
        N.ask(N.state.choices[0]);
        n++;
        if (N.state.history.at(-1).shift && N.state.secret === 50) same++;
      }
      for (let i = 0; i < 150; i++) {
        N.startChallenge('endless', 'medium');
        N.state.secret = i % 2 ? 1 : 100;
        const s0 = N.state.secret;
        N.ask(N.state.choices[0]);
        n++;
        if (N.state.secret === s0) same++;
      }
      return { same, n };
    });
    check(
      still.same === 0,
      `Génie (50) et défi (1, 100) : ${still.n} sauts, aucun ne laisse le numéro sur place (${still.same})`
    );
    // version affichée = versionName de app/build.gradle
    const gradleVersion = fs
      .readFileSync(path.join(__dirname, '..', 'app', 'build.gradle'), 'utf8')
      .match(/versionName\s+'([^']+)'/)[1];
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.mode = 'normal';
      N.state.screen = 'home';
      N.state.modal = null;
      N.render();
    });
    const foot = await page.textContent('.footer');
    check(
      foot.includes('V' + gradleVersion) && !foot.includes('V7'),
      `Accueil : version ${gradleVersion} affichée (« ${foot.trim()} »)`
    );
    await page.click('#openSettings');
    check(
      (await page.textContent('.app-version')).includes(gradleVersion),
      'Réglages : numéro de version affiché'
    );
    await page.click('#closeSettings');
    // tutoriel
    for (const lang of ['fr', 'en', 'ar']) {
      await page.evaluate(l => {
        const N = window.__numero;
        N.state.lang = l;
        N.state.modal = null;
        N.state.screen = 'home';
        N.render();
      }, lang);
      await viaMore(page, 'openTutorial');
      let txt = '';
      for (let i = 0; i < 4; i++) {
        txt += await page.textContent('.modal');
        await page.click(i === 1 ? '#tutAsk' : '#tutNext');
      }
      txt += await page.textContent('.modal');
      check(
        !/\btut[A-Z0-9]/.test(txt) && (await S(page)).tut.step === 4,
        `Tutoriel (${lang}) : étapes traduites jusqu’à la boucle 9 → 1`
      );
      await page.click('#tutClose');
    }
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.lang = 'fr';
      N.render();
    });
    await viaMore(page, 'openRules');
    await page.click('#rulesTutorial');
    let tu = await S(page);
    check(
      tu.modal === 'tutorial' && tu.tut.step === 0 && (await page.$$('.tut-cell.secret')).length === 1,
      'Tutoriel accessible depuis les règles, numéro d’entraînement visible'
    );
    await page.click('#tutNext');
    await page.click('#tutAsk');
    check(
      (await page.$$('.tut-cell.out')).length === 4,
      'Tutoriel : « plus grand que 5 ? » NON → 6, 7, 8, 9 rayés'
    );
    await page.click('#tutNext');
    const moved = await page.$$eval('.tut-cell', cs =>
      cs
        .map(c => (c.classList.contains('out') ? 'x' : '') + (c.classList.contains('secret') ? '*' : ''))
        .join(',')
    );
    check(
      moved === 'x,,,,*,,x,x,x' && (await page.isVisible('.tut-body .blind-jump')),
      'Tutoriel : le numéro s’enfuit (+1, 4 → 5) et le carnet se décale (2 à 6) ' + moved
    );
    await page.click('#tutNext');
    check(
      !(await page.$('#tutNext')) &&
        (await page.isVisible('.tut-loop .loop-arrow')) &&
        (await page.textContent('.tut-body')).includes('après 9, on revient à 1'),
      'Tutoriel : étape « boucle » (8 → 9 → 1), flèche, pas de « Suivant » avant la réponse'
    );
    await page.click('[data-tutpick="9"]');
    check(
      !(await page.$('#tutNext')) && (await page.isVisible('.tut-cell.wrong')),
      'Tutoriel : mauvaise case (9) → explication, on réessaie'
    );
    await page.click('[data-tutpick="1"]');
    check(
      (await page.isVisible('#tutNext')) && (await S(page)).tut.loopOk,
      'Tutoriel : 9 + 1 → 1 trouvé, on peut continuer'
    );
    await page.click('#tutNext');
    check(
      (await page.isDisabled('#tutPrecise')) && (await page.isDisabled('#tutNet')),
      'Tutoriel : boutons de capture inactifs tant qu’aucun numéro n’est touché'
    );
    await page.click('[data-tutpick="8"]');
    await page.click('#tutPrecise');
    tu = await S(page);
    check(
      tu.tut.step === 5 && (await page.textContent('.tut-body')).includes('5'),
      'Tutoriel : capture ratée expliquée, on peut réessayer'
    );
    await page.click('[data-tutpick="4"]');
    check(
      (await page.textContent('#tutNet')).includes('4·5'),
      'Tutoriel : filet 4·5 (2 voisins au niveau Petit)'
    );
    await page.click('#tutNet');
    check(
      (await S(page)).tut.step === 6 &&
        (await page.textContent('.modal')).includes('+4') &&
        (await page.isVisible('#tutRestart')),
      'Tutoriel : filet réussi, +4, conclusion et « Rejouer ce tutoriel »'
    );
    await page.click('#tutRestart');
    check((await S(page)).tut.step === 0, 'Tutoriel : « Rejouer » recommence au début');
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.tut.step = 6;
      N.render();
    });
    await page.click('#tutPlay');
    check((await S(page)).modal === 'names', 'Tutoriel : « Jouer » ouvre la préparation de la partie');
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.modal = null;
      N.render();
    });
    await viaMore(page, 'openTutorial');
    check(
      (await page.evaluate(() => window.__numero.back())) && (await S(page)).modal === null,
      'Bouton Retour : ferme le tutoriel'
    );
    // règle de la Course : départage annoncé
    await pickPlayers(page, 2);
    await page.click('#start');
    check(
      (await page.textContent('[data-gmode="race"]')).includes('points départagent'),
      'Mode Course : le départage aux points est annoncé'
    );
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.modal = null;
      N.render();
    });
    // mini-carnet et saut « à l'aveugle »
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.players = 2;
      N.state.level = 'genius';
      N.state.mode = 'normal';
      N.start(true);
      N.state.modal = null;
      N.render();
    });
    check(await page.isVisible('.mini-notebook .tip'), 'Mini-carnet : astuce en début de chasse');
    await page.evaluate(() => {
      const N = window.__numero;
      N.ask(N.state.choices[0]);
    });
    const jump = await page.evaluate(() => {
      const el = document.querySelector('.move-line .blind-jump'),
        m = window.__numero.state.last.shift;
      return { ok: !!el, cls: el && el.className, tokens: el && el.textContent.trim(), op: m.op };
    });
    const expCls = { '+': 'hop', '×': 'grow', '÷': 'shrink', mirror: 'mirror' }[jump.op];
    check(
      jump.ok && jump.cls.includes(expCls) && jump.tokens === '?',
      `Saut à l’aveugle « ${jump.op} » animé (${expCls}) sans révéler la position`
    );
    await page.evaluate(() => {
      const N = window.__numero;
      N.nextTurn();
      N.guess(N.state.secret === 1 ? 2 : 1);
      N.nextTurn();
      N.state.modal = null;
      N.render();
    });
    const mini = await page.textContent('.mini-notebook');
    check(
      mini.includes('Derniers indices') &&
        (mini.match(/Joueur/g) || []).length === 1 &&
        !mini.includes('Raté'),
      'Mini-carnet : seulement les indices (la question), pas la capture ratée'
    );
    // sous-totaux du classement (mode Points)
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.players = 2;
      N.state.gameMode = 'score';
      N.state.level = 'junior';
      N.start(true);
      const s = N.state;
      s.scores = [12, 7];
      s.stars = [3, 0];
      s.screen = 'end';
      s.modal = null;
      N.render();
    });
    const sub = await page.$$eval('.finalscore > div:nth-child(2) small', e => e.map(x => x.textContent));
    check(
      sub.length === 2 && sub[0].includes('12') && sub[0].includes('3'),
      'Classement Points : sous-totaux « captures + ⭐ calculs » ' + sub.join(' / ')
    );
    const dupIds = await page.evaluate(() => {
      const N = window.__numero,
        out = [];
      const scan = tag => {
        const seen = {};
        document.querySelectorAll('[id]').forEach(e => {
          if (seen[e.id]) out.push(tag + ':' + e.id);
          seen[e.id] = 1;
        });
      };
      for (const m of [null, 'rules', 'challenge', 'names', 'tutorial', 'tutInvite']) {
        N.state.screen = 'home';
        N.state.mode = 'normal';
        N.state.modal = m;
        if (m === 'tutorial') N.state.tut = { step: 4, sel: 3, miss: null };
        N.render();
        scan('home/' + m);
      }
      N.state.players = 2;
      N.start(true);
      for (const m of [null, 'pause', 'notebook', 'quit', 'handoff']) {
        N.state.modal = m;
        N.render();
        scan('game/' + m);
      }
      N.state.screen = 'settings';
      N.state.modal = null;
      N.render();
      scan('settings');
      return out;
    });
    check(
      dupIds.length === 0,
      'Aucun identifiant HTML en double (accueil, fenêtres, partie, réglages) ' + dupIds.join(', ')
    );
    check(page.errors.length === 0, 'Aucune erreur JavaScript (V8.4) ' + page.errors.join(' | '));
    console.log(
      `${failed === before ? '✓' : '✗'} V8.4 : défi anti-abus, chrono figé, difficultés, sauts, version, tutoriel, mini-carnet`
    );
    await ctx.close();
  }

  // 3h) V8.5 : niveaux sans âge, proposition du tutoriel au premier lancement, défi plus clair
  {
    const before = failed;
    const { ctx, page } = await fresh(browser, { width: 360, height: 640 });
    for (const lang of ['fr', 'en', 'ar']) {
      await page.evaluate(l => {
        const N = window.__numero;
        N.state.lang = l;
        N.state.modal = null;
        N.state.screen = 'home';
        N.render();
      }, lang);
      const lv = await page.$$eval('.level', e => e.map(x => x.textContent).join(' | '));
      check(
        !/\d+\s*(ans|an)\b|Ages?\s|سنة|سنوات/.test(lv) && !(await page.$('.level .lvl-jumps')),
        `Niveaux (${lang}) : aucune tranche d’âge`
      );
      check(
        (await page.evaluate(() => document.scrollingElement.scrollHeight - innerHeight)) <= 0,
        `Accueil 360×640 (${lang}) sans défilement`
      );
    }
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.lang = 'fr';
      N.render();
    });
    await viaMore(page, 'openRules');
    check(
      (await page.textContent('.modal')).includes('ne dépendent pas de l’âge'),
      'Règles : « les niveaux ne dépendent pas de l’âge »'
    );
    await page.click('#closeModal');
    // premier lancement : tutoriel proposé une seule fois, jamais imposé
    await page.evaluate(() => {
      localStorage.clear();
      const N = window.__numero;
      Object.assign(N.state, { tutSeen: false, modal: null, screen: 'home', mode: 'normal' });
      N.render();
    });
    await page.reload(); // (l'état est resauvegardé à la fermeture de la page : on simule un tout premier lancement)
    check(
      (await S(page)).modal === 'tutInvite' && (await page.isVisible('#inviteTutorial')),
      'Premier lancement : le tutoriel est proposé'
    );
    await page.click('#closeModal');
    await page.reload();
    check(
      (await S(page)).modal === null,
      'Proposition du tutoriel : une seule fois (« Plus tard » respecté)'
    );
    await page.evaluate(() => {
      localStorage.clear();
      const N = window.__numero;
      Object.assign(N.state, { tutSeen: false, modal: null, screen: 'home', mode: 'normal' });
      N.render();
    });
    await page.reload(); // (l'état est resauvegardé à la fermeture de la page : on simule un tout premier lancement)
    await page.click('#inviteTutorial');
    check((await S(page)).modal === 'tutorial', 'Proposition acceptée → tutoriel');
    check(
      (await page.evaluate(() => window.__numero.back())) && (await S(page)).modal === null,
      'Bouton Retour : ferme le tutoriel ouvert depuis la proposition'
    );
    // défi : filet de 3 dans toutes les difficultés, barème propre à chaque variante, anciens records conservés
    const nets = await page.evaluate(() => {
      const N = window.__numero;
      return ['easy', 'medium', 'hard']
        .map(d => {
          N.startChallenge('endless', d);
          return N.netSize();
        })
        .join();
    });
    check(nets === '3,3,3', 'Défi : le filet couvre 3 numéros dans les 3 difficultés (' + nets + ')');
    await page.evaluate(() => {
      localStorage.setItem('numeroEnFuiteRecords', JSON.stringify({ timed: 1205, endless: 990 }));
      const N = window.__numero;
      N.state.mode = 'normal';
      N.state.screen = 'home';
      N.state.modal = 'challenge';
      N.render();
    });
    const chTxt = await page.textContent('.modal');
    check(
      chTxt.includes('Difficulté') && /Filet\s:\s3 numéros/.test(chTxt),
      'Défi : « Difficulté », filet annoncé'
    );
    check(/Anciens records.*1205.*990/.test(chTxt), 'Défi : anciens records V8.3 affichés pour mémoire');
    const fl = await page.$$eval('.modal .sub.small', e => e.map(x => x.textContent));
    check(
      fl.some(x => x.startsWith('⏱') && x.includes('seconde restante')) &&
        fl.some(
          x => x.startsWith('♾️') && !x.includes('seconde restante') && x.includes('Pas de bonus de temps')
        ),
      'Défi : barème propre à chaque variante (bonus temps seulement contre la montre)'
    );
    await page.evaluate(() => {
      const N = window.__numero;
      N.startChallenge('endless', 'medium');
      N.guess(N.state.secret);
      N.nextTurn();
    });
    check(
      !(await page.textContent('.screen, #app')).includes('seconde restante'),
      'Fin d’un défi sans limite : pas de bonus de temps annoncé'
    );
    // pavé numérique (Génie 1–50) : impossible de taper un numéro hors limites ; tient sur un écran 360 × 735
    for (const lang of ['fr', 'ar']) {
      await page.setViewportSize({ width: 360, height: 735 });
      await page.evaluate(l => {
        const N = window.__numero;
        N.state.lang = l;
        N.state.players = 1;
        N.state.level = 'genius';
        N.state.mode = 'normal';
        N.start(true);
        N.state.modal = null;
        N.state.tab = 'guess';
        N.render();
      }, lang);
      const kp = await page.evaluate(() => {
        const tb = document.querySelector('.turn-body');
        return {
          over: tb.scrollHeight - tb.clientHeight,
          range: document.querySelector('.kp-display').textContent.trim(),
          hint: document.querySelector('.pick-hint').textContent
        };
      });
      check(
        kp.over <= 0 && kp.range === '1–50' && kp.hint.includes('50') && !kp.hint.includes('100'),
        `Génie (${lang}) 360×735 : pavé sans défilement, « 1–50 » affiché, consigne 1 à 50 (${JSON.stringify(kp)})`
      );
    }
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.lang = 'fr';
      N.render();
    });
    await page.click('[data-key="8"]');
    const dis8 = await page.$$eval('.key:disabled', e => e.map(x => x.dataset.key).join(''));
    await page.click('[data-key="6"]', { force: true });
    let kst = await S(page);
    check(
      dis8 === '1234567890' && kst.typed === '8' && kst.sel === 8 && !(await page.isDisabled('#capPrecise')),
      'Génie : après « 8 », tous les chiffres sont grisés ; « 86 » est impossible, le 8 reste choisi'
    );
    await page.click('[data-key="clr"]');
    await page.click('[data-key="4"]');
    const dis4 = await page.$$eval('.key:disabled', e => e.map(x => x.dataset.key).join(''));
    await page.click('[data-key="7"]', { force: true });
    await page.click('[data-key="0"]', { force: true });
    kst = await S(page);
    check(
      dis4 === '' && kst.sel === 47 && kst.typed === '47',
      `Génie : après « 4 », tous les chiffres restent possibles (40–49) ; 4, 7 puis 0 → 47 (« 470 » refusé)`
    );
    await page.click('[data-key="clr"]');
    check(
      (await page.isDisabled('[data-key="0"]')) && !(await page.isDisabled('[data-key="5"]')),
      'Pavé : « 0 » impossible en premier chiffre'
    );
    await page.evaluate(() => {
      const N = window.__numero;
      N.startChallenge('endless', 'medium');
      N.state.tab = 'guess';
      N.render();
    });
    for (const k of ['1', '0']) await page.click(`[data-key="${k}"]`);
    const dis10 = await page.$$eval('.key:disabled', e => e.map(x => x.dataset.key).join(''));
    await page.click('[data-key="0"]');
    check(
      dis10 === '123456789' && (await S(page)).sel === 100,
      `Défi 1–100 : après « 10 », seul « 0 » reste possible → 100 (${dis10})`
    );
    await page.setViewportSize({ width: 360, height: 640 });
    check(page.errors.length === 0, 'Aucune erreur JavaScript (V8.5) ' + page.errors.join(' | '));
    console.log(
      `${failed === before ? '✓' : '✗'} V8.5 : niveaux sans âge, tutoriel au premier lancement, défi plus clair`
    );
    await ctx.close();
  }

  // 3i) V8.8 : carrière Solo (cahier des charges « KIT SOLO V8.5 », tests T01–T21)
  {
    const before = failed;
    const { ctx, page } = await fresh(browser, { width: 360, height: 735 });
    // T01–T04 : barème
    const sc = await page.evaluate(() => {
      const f = window.__numero.scoreSolo,
        L = 12;
      return [
        f({ won: true, turns: 4, limit: L, goodMath: 2, finalCapture: 'precise', misses: 1 }).total,
        f({ won: true, turns: 1, limit: L, goodMath: 0, finalCapture: 'precise', misses: 0 }).total,
        f({ won: true, turns: 12, limit: L, goodMath: 0, finalCapture: 'net', misses: 0 }).total,
        f({ won: true, turns: 6, limit: L, goodMath: 5, finalCapture: 'net', misses: 0 }).total -
          f({ won: true, turns: 6, limit: L, goodMath: 0, finalCapture: 'net', misses: 0 }).total,
        f({ won: false, turns: 12, limit: L, goodMath: 3, finalCapture: 'precise', misses: 2 }).total
      ];
    });
    check(
      sc.join() === '460,550,100,60,0',
      'T01–T04 + défaite : barème solo 460 / 550 / 100 / +60 max / 0 (' + sc.join(' ') + ')'
    );
    // anti-abus : un tour de plus avec calcul juste ne rapporte jamais
    const ab = await page.evaluate(() => {
      const f = window.__numero.scoreSolo;
      let bad = 0;
      for (let tr = 1; tr < 12; tr++)
        for (let m = 0; m < 3; m++)
          if (
            f({ won: true, turns: tr + 1, limit: 12, goodMath: m + 1, finalCapture: 'precise', misses: 0 })
              .total >=
            f({ won: true, turns: tr, limit: 12, goodMath: m, finalCapture: 'precise', misses: 0 }).total
          )
            bad++;
      return bad;
    });
    check(ab === 0, 'Solo : prolonger d’un tour pour un calcul juste ne rapporte jamais plus');
    // T11 : migration V8.4 (tours historiques gardés, aucun score inventé), T12 : records défi intacts
    await page.evaluate(() => {
      localStorage.removeItem('numeroEnFuiteCareerV1');
      localStorage.setItem(
        'numeroEnFuiteRecords',
        JSON.stringify({ solo_junior: 5, solo_genius: 9, 'endless-medium': 870, timed: 1205 })
      );
    });
    const mig = await page.evaluate(() => {
      const p = window.__numero.loadCareer().profiles['local-default'];
      return [
        p.levels.junior.bestTurns,
        p.levels.junior.bestScore,
        p.levels.genius.bestTurns,
        p.levels.malin.bestTurns,
        p.xpTotal
      ].join();
    });
    check(
      mig === '5,,9,,0',
      'T11 : migration — meilleurs tours V8.4 repris, aucun score ni XP inventés (' + mig + ')'
    );
    // parties simulées
    const play = (level, misses, maths, net) =>
      page.evaluate(
        ([level, misses, maths, net]) => {
          const N = window.__numero;
          N.state.players = 1;
          N.state.level = level;
          N.state.mode = 'normal';
          N.start(true);
          N.state.replayAsk = false;
          N.state.modal = null;
          for (let i = 0; i < misses; i++) {
            if (i < maths) {
              N.mathAnswer(N.state.math.result);
              N.nextTurn();
            }
            N.guess(N.state.secret === 1 ? 2 : 1);
            N.nextTurn();
          }
          if (net) N.netCapture(N.state.secret);
          else N.guess(N.state.secret);
          N.nextTurn();
          N.state.modal = null;
          N.render();
          return N.state.soloResult;
        },
        [level, misses, maths, net]
      );
    const careerNow = () => page.evaluate(() => window.__numero.loadCareer().profiles['local-default']);
    const r1 = await play('junior', 3, 2, false);
    check(
      r1.won &&
        r1.turns === 4 &&
        r1.score === 440 &&
        r1.stars === 2 &&
        r1.newRecord &&
        r1.prevBest === null &&
        r1.xp === 15,
      `T07 : 1re victoire au niveau Petit → record, +15 XP (10 + 5) (${r1.score} pts, ${r1.xp} XP)`
    );
    check(
      (await page.isVisible('.solo-score')) &&
        (await page.getAttribute('.solo-score [data-count]', 'data-count')) === '440' &&
        (await page.isVisible('.ch-new')) &&
        (await page.isVisible('.next-goal')) &&
        (await page.isVisible('#openOffice')),
      'Écran de fin : score, « Premier record », conseil, bouton « Mon bureau »'
    );
    const r2 = await play('junior', 5, 0, false);
    check(
      !r2.newRecord &&
        r2.prevBest === 440 &&
        r2.xp === 10 &&
        (await page.textContent('.record-chip')).includes('440'),
      `T06 : victoire sans record → +10 XP (Petit), « Record du niveau : 440 » (${r2.score} pts)`
    );
    // T08 : score égal au record → pas de « nouveau record »
    const r3 = await play('junior', 3, 2, false);
    check(
      r3.score === 440 && !r3.newRecord && r3.xp === 10,
      'T08 : score égal au record → pas de « Nouveau record », +10 XP'
    );
    // T09 / T21 : rouvrir le résultat, recharger, Retour, rien n'est compté deux fois
    const c0 = await careerNow();
    for (let i = 0; i < 5; i++) {
      await page.click('#openOffice');
      await page.click('#closeOffice');
    }
    await page.reload();
    await page.evaluate(() => {
      window.__numero.state.modal = null;
      window.__numero.render();
    });
    const again = await page.evaluate(() => {
      const N = window.__numero;
      const before = N.state.soloResult;
      const r = N.settleSolo(true);
      return [N.state.screen, r.score === before.score, r.xp === before.xp].join();
    });
    const c1 = await careerNow();
    check(
      again === 'end,true,true' &&
        c1.xpTotal === c0.xpTotal &&
        c1.totalWins === c0.totalWins &&
        c1.totalStars === c0.totalStars &&
        c1.levels.junior.gamesPlayed === c0.levels.junior.gamesPlayed,
      `T09 / T21 : 5 réouvertures, rechargement, nouvel appel — XP ${c0.xpTotal} → ${c1.xpTotal}, rien de doublé`
    );
    // T05 : défaite après 12 tours ; T10 : niveaux indépendants
    const lose = await page.evaluate(() => {
      const N = window.__numero;
      N.state.level = 'malin';
      N.start(true);
      N.state.replayAsk = false;
      for (let i = 0; i < 12 && N.state.screen === 'game'; i++) {
        N.guess(N.state.secret === 1 ? 2 : 1);
        N.nextTurn();
      }
      N.state.modal = null;
      N.render();
      return N.state.soloResult;
    });
    check(
      !lose.won &&
        lose.score === 0 &&
        lose.stars === 0 &&
        lose.xp === 3 &&
        (await page.isVisible('.solo-reveal')),
      'T05 : défaite après 12 tours (Moyen) → 0 point, 0 étoile, +3 XP, numéro révélé'
    );
    const rM = await play('malin', 1, 1, true);
    const c2 = await careerNow();
    check(
      rM.newRecord &&
        c2.levels.malin.bestScore === rM.score &&
        c2.levels.junior.bestScore === 440 &&
        rM.lines.every(l => l[0] !== 'scoreLinePrecise'),
      `T10 : record Moyen (${rM.score}) indépendant de Petit (440) ; pas de bonus de précision au filet`
    );
    // abandon : 0 XP
    const xpA = (await careerNow()).xpTotal;
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.level = 'expert';
      N.start(true);
      N.ask(N.state.choices[0]);
      N.state.screen = 'home';
      N.state.inGame = false;
      N.render();
    });
    check((await careerNow()).xpTotal === xpA, 'Abandon en cours de partie : 0 XP');
    // T14 : partie suspendue puis reprise → même gameId
    const gid = await page.evaluate(() => {
      const N = window.__numero;
      N.state.level = 'junior';
      N.start(true);
      N.state.modal = null;
      N.render();
      return N.state.gameId;
    });
    await page.reload();
    const gid2 = await page.evaluate(() => window.__numero.state.gameId);
    check(gid && gid === gid2, 'T14 : partie reprise après fermeture → même identifiant de partie');
    // T12 : records défi inchangés ; T13 : progression restaurée
    const rec = await page.evaluate(() => window.__numero.records());
    check(rec['endless-medium'] === 870 && rec.timed === 1205, 'T12 : records des défis inchangés');
    // bureau : compteurs et rangs ; T15 : 3 langues ; T16 : 320 px
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.screen = 'home';
      N.state.modal = null;
      N.render();
    });
    await page.click('#openOffice');
    const c3 = await careerNow();
    const tiles = await page.$$eval('.office-tiles b', e => e.map(x => x.textContent).join());
    await page.click('[data-otab="records"]');
    const olv = await page.evaluate(() => {
        const N = window.__numero;
        return N.state.officeLevel || N.state.level || 'junior';
      }),
      L3 = c3.levels[olv];
    const want = [L3.gamesPlayed, L3.wins, L3.gamesPlayed - L3.wins, L3.stars].join();
    check(
      tiles === want && (await page.textContent('.office-records')).includes('440'),
      'Mon bureau (V9.6) : statistiques du niveau choisi, records par niveau (' +
        olv +
        ' : ' +
        tiles +
        ' / ' +
        want +
        ')'
    );
    const rk = await page.evaluate(() => {
      const f = window.__numero.rankOf;
      return [f(0).rank, f(99).rank, f(100).rank, f(560).rank, f(560).pct, f(5000).rank, f(5000).next].join();
    });
    check(rk === '1,1,2,4,44,8,', 'Rangs : seuils 0 / 100 / … ; 560 XP → rang 4 à 44 % (' + rk + ')');
    for (const lang of ['fr', 'en', 'ar'])
      for (const scr of ['office', 'end']) {
        await page.setViewportSize({ width: 320, height: 640 });
        await page.evaluate(
          ([l, s]) => {
            const N = window.__numero;
            N.state.lang = l;
            N.state.screen = s;
            if (s === 'end') {
              N.state.players = 1;
              N.state.mode = 'normal';
              N.state.soloResult =
                N.loadCareer().profiles['local-default'].processed[
                  Object.keys(N.loadCareer().profiles['local-default'].processed)[0]
                ];
              N.state.soloWon = N.state.soloResult.won;
            }
            N.render();
          },
          [lang, scr]
        );
        const txt = await page.innerText('#app');
        const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        check(
          !/\b(office|rank|score|tip|solo)[A-Z][A-Za-z]+/.test(txt) &&
            ov <= 1 &&
            (lang !== 'ar' || (await page.evaluate(() => document.documentElement.dir === 'rtl'))),
          `T15 / T16 (${lang}, ${scr}) : textes traduits, 320 px sans débordement`
        );
      }
    await page.setViewportSize({ width: 360, height: 735 });
    // T17 : animations réduites
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.lang = 'fr';
      N.state.reduceMotion = true;
      N.state.screen = 'end';
      N.render();
    });
    check(
      !(await page.$('.rain')) &&
        (await page.evaluate(() => document.body.classList.contains('reduce-motion'))) &&
        (await page.isVisible('.solo-score')),
      'T17 : animations réduites → pas de pluie de confettis, score lisible'
    );
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.reduceMotion = false;
      N.render();
    });
    // ancien écran de fin (partie terminée avant la V8.8) : aucune récompense inventée
    const legacy = await page.evaluate(() => {
      const N = window.__numero,
        xp = N.loadCareer().profiles['local-default'].xpTotal;
      N.state.soloResult = null;
      N.state.soloWon = true;
      N.state.soloTurns = 3;
      N.state.screen = 'end';
      N.render();
      return [
        !!document.querySelector('.solo-stats'),
        N.loadCareer().profiles['local-default'].xpTotal === xp
      ].join();
    });
    check(
      legacy === 'true,true',
      'Partie finie avant la mise à jour : ancien écran, aucune XP attribuée a posteriori'
    );
    check(page.errors.length === 0, 'Aucune erreur JavaScript (carrière solo) ' + page.errors.join(' | '));
    console.log(
      `${failed === before ? '✓' : '✗'} V8.8 : carrière solo — barème, records par niveau, XP, rangs, bureau, idempotence, migration`
    );
    await ctx.close();
  }

  // 3j) V8.10 : intervalles proportionnels au niveau ; annonce « X a trouvé le numéro » en Course
  {
    const before = failed;
    const { ctx, page } = await fresh(browser, { width: 360, height: 735 });
    const widths = await page.evaluate(() => {
      const N = window.__numero,
        out = {};
      for (const lv of ['junior', 'malin', 'expert', 'genius']) {
        N.state.players = 1;
        N.state.level = lv;
        N.state.mode = 'normal';
        N.start(true);
        const sizes = new Set(),
          near = new Set();
        for (let i = 0; i < 300; i++) {
          N.state.shownIds = [];
          N.state.candidates = Array.from({ length: N.maxN() }, (_, k) => k + 1);
          for (const id of N.state.choices) {
            const q = N.qbyid(id),
              c = Array.from({ length: N.maxN() }, (_, k) => k + 1).filter(n => q.test(n)).length;
            if (id.startsWith('range')) sizes.add(c);
            if (id.startsWith('near')) near.add(c);
          }
          N.start(true);
        }
        out[lv] = [[...sizes].join('/'), [...near].join('/')].join(' ');
      }
      return out;
    });
    check(
      /^4 /.test(widths.junior) &&
        /^6 /.test(widths.malin) &&
        /^8 /.test(widths.expert) &&
        /^13 /.test(widths.genius),
      'Questions « entre a et b » : 4 numéros (Petit), 6 (Moyen, V8.17 : 2 × filet), 8 (Grand), 13 (Génie) ' +
        JSON.stringify(widths)
    );
    check(
      !/\b7\b/.test(widths.genius.split(' ')[1] || ''),
      'Génie : « proche de k » élargi (11 numéros) ' + widths.genius
    );
    // V9.7 : en Course, la première capture termine la partie (plus d'annonce aux autres joueurs)
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.players = 3;
      N.state.gameMode = 'race';
      N.state.starter = 0;
      N.state.level = 'junior';
      N.state.replayAsk = false;
      N.start(true);
      N.state.modal = null;
      N.guess(N.state.secret);
      N.nextTurn();
      N.render();
    });
    check(
      (await S(page)).screen === 'end' &&
        (await S(page)).raceWinner === 0 &&
        (await page.isVisible('.race-hero')),
      'Course : Joueur 1 attrape le numéro → fin immédiate, écran de victoire'
    );
    check(page.errors.length === 0, 'Aucune erreur JavaScript (V8.10) ' + page.errors.join(' | '));
    console.log(
      `${failed === before ? '✓' : '✗'} V8.10 : intervalles proportionnels, annonce de capture en Course`
    );
    await ctx.close();
  }

  // 3k) V8.11 : multijoueur Wi-Fi local — 3 téléphones simulés reliés par un faux réseau
  //     (même contrat que l'application Android : hostStart / joinStart / send / stop, événements __netEvent)
  {
    const before = failed;
    const hosts = {};
    let peerSeq = 0;
    const deliver = (pg, ev) =>
      setTimeout(() => pg.evaluate(e => window.__netEvent(JSON.stringify(e)), ev).catch(() => {}), 5);
    const hostOf = pg => Object.values(hosts).find(h => h.page === pg);
    const netOp = (src, op, a, b) => {
      if (op === 'scanStart') {
        // V9.18 : parties proches annoncées (« NEF-code-Prénom »)
        for (const h of Object.values(hosts))
          deliver(src, { type: 'room', code: h.code, name: h.name || '' });
      } else if (op === 'hostStart') {
        hosts[a] = { page: src, code: a, peers: new Map(), name: b };
        deliver(src, { type: 'hosting', ip: '192.168.1.10', port: 40123 });
      } else if (op === 'joinStart') {
        const h = hosts[a];
        if (!h) return deliver(src, { type: 'error', code: 'notFound' });
        const id = 'p' + ++peerSeq;
        h.peers.set(id, src);
        src.__peer = { code: a, id };
        deliver(h.page, { type: 'peerJoined', peer: id });
        deliver(src, { type: 'connected' });
      } else if (op === 'send') {
        const h = hostOf(src);
        if (h) {
          const dst = h.peers.get(a);
          if (dst) deliver(dst, { type: 'message', peer: 'host', data: b });
        } else if (src.__peer && hosts[src.__peer.code])
          deliver(hosts[src.__peer.code].page, { type: 'message', peer: src.__peer.id, data: b });
      } else if (op === 'stop') {
        const h = hostOf(src);
        if (h) {
          for (const pg of h.peers.values()) deliver(pg, { type: 'disconnected' });
          delete hosts[h.code];
        } else if (src.__peer) {
          const hh = hosts[src.__peer.code];
          if (hh) {
            hh.peers.delete(src.__peer.id);
            deliver(hh.page, { type: 'peerLeft', peer: src.__peer.id });
          }
          src.__peer = null;
        }
      }
    };
    const phone = async () => {
      const ctx = await browser.newContext({
        locale: 'fr-FR',
        viewport: { width: 360, height: 735 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true
      });
      const page = await ctx.newPage();
      page.errors = [];
      page.on('pageerror', e => page.errors.push(String(e)));
      await page.exposeBinding('__fakeNet', ({ page: src }, op, a, b) => {
        netOp(src, op, a, b);
      });
      await page.addInitScript(() => {
        window.NumeroNet = {
          hostStart: (c, n) => window.__fakeNet('hostStart', c, n),
          scanStart: () => window.__fakeNet('scanStart'),
          scanStop: () => {},
          joinStart: c => window.__fakeNet('joinStart', c),
          send: (p, d) => window.__fakeNet('send', p, d),
          stop: () => window.__fakeNet('stop'),
          keepAwake: () => {}
        };
      });
      await page.goto(URL);
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.evaluate(() => {
        const N = window.__numero;
        N.state.modal = null;
        N.state.reduceMotion = true;
        N.render();
      });
      return { ctx, page };
    };
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const SN = p => S(p);
    const [A, B, C] = [await phone(), await phone(), await phone()];
    const host = A.page,
      p2 = B.page,
      p3 = C.page;
    check(
      await host.isVisible('#openLan'),
      'Accueil : tuile « Wi-Fi » quand le réseau est disponible (application Android)'
    );
    {
      const { ctx, page } = await fresh(browser);
      check(
        !(await page.$('#openLan')) && !(await page.$('#openLanMore')),
        'Version navigateur sans réseau : pas de bouton Wi-Fi'
      );
      await ctx.close();
    }
    // l'hôte crée la partie
    await viaMore(host, 'openLanMore');
    await host.fill('#netName', 'Léa');
    await host.click('#netCreate');
    const code = (await host.textContent('.net-code')).trim();
    check(
      /^\d{4}$/.test(code) && (await host.isDisabled('#netLaunch')),
      `Hôte : code à 4 chiffres (${code}), « Lancer » inactif tant qu’il est seul`
    );
    // un mauvais code
    await viaMore(p2, 'openLanMore');
    await p2.fill('#netName', 'Omar');
    await p2.click('#netGoJoin');
    await p2.fill('#netCode', code === '9999' ? '8888' : '9999');
    // V9.18 : une partie qui apparaît pendant la saisie ne doit pas effacer le code tapé
    await p2.evaluate(() => window.__netEvent(JSON.stringify({ type: 'room', code: '1111', name: 'Test' })));
    await wait(100);
    check(
      (await p2.inputValue('#netCode')) === (code === '9999' ? '8888' : '9999') &&
        (await p2.textContent('.net-rooms')).includes('Test'),
      'Rejoindre : une partie trouvée pendant la saisie s’ajoute à la liste sans effacer le code tapé'
    );
    await p2.click('#netJoinGo');
    await wait(150);
    check(
      (await p2.isVisible('.net-error')) && (await p2.textContent('.net-error')).includes('introuvable'),
      'Mauvais code → « Partie introuvable »'
    );
    // deux joueurs rejoignent
    await p2.fill('#netCode', code);
    await p2.click('#netJoinGo');
    // V9.18 : Zoé rejoint d'un toucher dans la liste des parties proches (« Partie de Léa »), sans taper le code
    await viaMore(p3, 'openLanMore');
    await p3.fill('#netName', 'Zoé');
    await p3.click('#netGoJoin');
    await wait(200);
    check(
      (await p3.textContent('.net-rooms')).includes('Partie de Léa') &&
        (await p3.$(`[data-room="${code}"]`)) !== null,
      'Rejoindre : la partie de Léa apparaît dans la liste des parties proches'
    );
    await p3.click(`[data-room="${code}"]`);
    await wait(300);
    const hostList = await host.$$eval('.net-players li b', e => e.map(x => x.textContent).join(','));
    check(
      hostList === 'Léa,Omar,Zoé' &&
        (await p3.textContent('.net-panel')).includes('En attente') &&
        !(await host.isDisabled('#netLaunch')),
      'Salle d’attente : Léa (hôte), Omar, Zoé — invités en attente, « Lancer » actif (' + hostList + ')'
    );
    // V9.15 : l'hôte choisit le niveau et le mode dans la salle ; les invités les voient
    {
      const lv0 = (await SN(host)).level,
        md0 = (await SN(host)).gameMode;
      await host.click('[data-netlevel="malin"]');
      await host.click('[data-netmode="score"]');
      await wait(200);
      const txt = await p2.textContent('.net-rules');
      check(
        (await SN(host)).level === 'malin' &&
          (await SN(host)).gameMode === 'score' &&
          /Moyen/.test(txt) &&
          /Points/.test(txt),
        `Salle Wi-Fi : niveau et mode choisis par l’hôte, affichés chez les invités (« ${txt.trim()} »)`
      );
      await host.click('[data-netseries="2"]');
      await wait(200);
      check(
        (await p2.textContent('.net-rules')).includes('Premier à 2'),
        'Salle Wi-Fi : la série choisie par l’hôte (« Premier à 2 ») est affichée chez les invités'
      );
      await host.click('[data-netseries="0"]');
      await host.click(`[data-netlevel="${lv0}"]`);
      await host.click(`[data-netmode="${md0 === 'score' ? 'score' : 'race'}"]`);
      await wait(150);
    }
    // lancement
    await host.click('#netLaunch');
    await wait(300);
    // V8.14 : le premier joueur est tiré au sort (avant : toujours l'hôte). On le fixe ensuite pour la suite du test.
    {
      const st0 = (await SN(host)).starter;
      check(Number.isInteger(st0) && st0 >= 0 && st0 < 3, `Wi-Fi : premier joueur tiré au sort (${st0})`);
      await host.evaluate(() => {
        const N = window.__numero;
        N.state.starter = 0;
        N.state.turn = 0;
        N.render();
      });
      await wait(200);
    }
    // V9.15 : battement de cœur — joueurs silencieux, hôte silencieux, hôte en arrière-plan
    {
      await host.evaluate(() => window.__numero.netHeartbeat(Date.now() + 11000));
      const lost = await host.evaluate(() => window.__numero.netState.lobby.map(p => p.connected).join());
      await host.evaluate(() => {
        window.__numero.netState.lastPing = 0;
        window.__numero.netHeartbeat(Date.now());
      });
      await wait(400);
      const back = await host.evaluate(() => window.__numero.netState.lobby.map(p => p.connected).join());
      check(
        lost === 'true,false,false' && back === 'true,true,true',
        `Wi-Fi : invités muets 10 s → considérés partis (${lost}), puis reprennent leur place s’ils répondent (${back})`
      );
      await p2.evaluate(() => window.__numero.netHeartbeat(Date.now() + 11000));
      await wait(100);
      const silent = await SN(p2);
      const silentTxt = await p2.textContent('.modal');
      await host.evaluate(() => {
        window.__numero.netState.lastPing = 0;
        window.__numero.netHeartbeat(Date.now());
      });
      await wait(400);
      check(
        silent.modal === 'netLost' && /10 secondes/.test(silentTxt) && (await SN(p2)).modal !== 'netLost',
        'Wi-Fi : hôte muet 10 s → « connexion perdue » chez l’invité, refermée dès que l’hôte répond'
      );
      await host.evaluate(() => window.__numero.netVisibility(true));
      await wait(300);
      const away = await SN(p3);
      const awayTxt = await p3.textContent('.modal');
      await host.evaluate(() => window.__numero.netVisibility(false));
      await wait(300);
      check(
        away.modal === 'netLost' &&
          /quitté l’application/.test(awayTxt) &&
          (await SN(p3)).modal !== 'netLost',
        'Wi-Fi : hôte en arrière-plan → invités prévenus tout de suite, fenêtre refermée à son retour'
      );
    }
    let [h, s2, s3] = [await SN(host), await SN(p2), await SN(p3)];
    check(
      h.screen === 'game' &&
        s2.screen === 'game' &&
        s3.screen === 'game' &&
        h.players === 3 &&
        s2.names.join() === 'Léa,Omar,Zoé',
      'Partie lancée sur les 3 téléphones avec les 3 prénoms'
    );
    check(
      s2.secret === undefined &&
        s3.secret === undefined &&
        (s2.math || {}).result === null &&
        !s2.hunt &&
        h.secret >= 1,
      'Le numéro secret, son parcours et la réponse du calcul ne sont jamais envoyés aux autres téléphones'
    );
    check(
      !(await host.$('.net-watch')) &&
        (await p2.textContent('.net-watch')).includes('Léa') &&
        (await p3.textContent('.net-watch')).includes('Léa'),
      'Tour de Léa : bandeau « Au tour de Léa… » chez Omar et Zoé'
    );
    // action hors tour : refusée par l'hôte
    await p2.evaluate(() => window.__numero.act('ask', window.__numero.state.choices[0]));
    await wait(150);
    check(
      (await SN(host)).history.length === 0,
      'Omar ne peut pas jouer à la place de Léa (action refusée par l’hôte)'
    );
    // Léa pose une question (interface), puis rate
    await host.click('[data-tab="question"]');
    await host.click('[data-question]');
    await wait(200);
    s2 = await SN(p2);
    check(
      s2.phase === 'result' &&
        s2.last &&
        s2.last.type === 'question' &&
        (await p2.isVisible('.result-card')) &&
        !(await p2.isVisible('#next')) &&
        (await p2.isVisible('.net-wait-next')),
      'Omar voit en direct la question de Léa et sa réponse ; il n’a pas le bouton « Continuer »'
    );
    await host.click('#next');
    await wait(100);
    const hs = (await SN(host)).secret,
      miss = hs === 1 ? 2 : 1;
    // V9.19 : Omar fait un pronostic secret autour du numéro (connu de l'hôte seulement), Zoé un faux
    const stars0 = (await SN(host)).stars.slice();
    await p2.click('#pronoOpen');
    await p2.click(`[data-prono="${hs}"]`);
    const mx = await host.evaluate(() => window.__numero.maxN()),
      far = hs > mx / 2 ? 1 : mx;
    await p3.click('#pronoOpen');
    await p3.click(`[data-prono="${far}"]`);
    await wait(250);
    {
      const [hp, op, zp] = [await SN(host), await SN(p2), await SN(p3)];
      check(
        Array.isArray(hp.prono[1]) &&
          hp.prono[1].includes(hs) &&
          Array.isArray(hp.prono[2]) &&
          op.prono[1] &&
          !op.prono[2] &&
          zp.prono[2] &&
          !zp.prono[1],
        'Pronostics : reçus par l’hôte, chacun ne voit que le sien'
      );
      check(!(await host.$('#pronoOpen')), 'Pronostic : pas de bouton pour le joueur dont c’est le tour');
    }
    await host.click(`[data-guess="${miss}"]`);
    await host.click('#capPrecise');
    await wait(250);
    {
      const hp = await SN(host);
      check(
        hp.stars[1] === stars0[1] + 1 &&
          hp.stars[2] === stars0[2] &&
          hp.pronoHits.join() === '1' &&
          (await p2.textContent('.result-card')).includes('Omar'),
        `Pronostic juste d’Omar : +1 ⭐ et annonce à tous ; celui de Zoé ne rapporte rien (${hp.stars})`
      );
    }
    await host.click('#next');
    await wait(250);
    [h, s2] = [await SN(host), await SN(p2)];
    check(
      h.turn === 1 && !(await p2.$('.net-watch')) && (await host.textContent('.net-watch')).includes('Omar'),
      'Tour suivant : à Omar de jouer, Léa regarde'
    );
    // V8.14 : carnet « à la main » sur le téléphone d'Omar (sauts reçus, jamais les positions)
    check(
      Array.isArray(s2.huntPublic) &&
        s2.huntPublic.length === 2 &&
        s2.huntPublic.every(x => !('from' in x) && !('to' in x)),
      'Wi-Fi : seuls les types de saut sont envoyés (pas les positions)'
    );
    await p2.click('#openNotebook');
    await p2.click('[data-mark="1"]');
    check(
      await p2.isVisible('#shiftMarks'),
      'Wi-Fi : Omar barre sur son téléphone, « Décaler mes marques » proposé'
    );
    await p2.click('#shiftMarks');
    const om = JSON.stringify((await SN(p2)).marks[1].out);
    await host.evaluate(() => window.__numero.render());
    await wait(150);
    check(
      JSON.stringify((await SN(p2)).marks[1].out) === om &&
        !(await SN(host)).marks.some(m => m && m.out && m.out.length),
      'Wi-Fi : les marques d’Omar restent chez lui (ni écrasées, ni envoyées)'
    );
    await p2.click('#closeModal');
    // Omar joue sur SON téléphone : choisit un numéro (sélection locale), capture → arbitrée par l'hôte
    await p2.click('[data-tab="guess"]');
    await wait(150);
    const sec0 = (await SN(host)).secret,
      sec = sec0 === 1 ? 2 : 1; // V9.7 : une capture ratée (une réussie finirait la Course)
    await p2.click(`[data-guess="${sec}"]`);
    check(
      (await SN(p2)).sel === sec && (await SN(host)).sel !== sec,
      'La sélection d’un numéro reste locale au téléphone d’Omar'
    );
    await p2.click('#capPrecise');
    await wait(300);
    [h, s3] = [await SN(host), await SN(p3)];
    check(
      h.last && h.last.type === 'wrong' && h.last.player === 1 && h.scores[1] === -1,
      'Omar tente une capture depuis son téléphone : ratée (−1), vérifiée par l’hôte'
    );
    check(
      (await p3.isVisible('.result-card')) && (await p3.textContent('.result-card')).includes(String(sec)),
      'Zoé voit en direct la capture ratée d’Omar'
    );
    // chronos : décomptés par l'hôte, reçus par les autres
    await p2.click('#next');
    await wait(1300);
    const tz = await SN(p3);
    check(
      tz.turnElapsed > 300 && (await SN(host)).turnElapsed > 300,
      `Chronos : décomptés par l’hôte, reçus par les autres (${Math.round(tz.turnElapsed)} ms)`
    );
    // réglage local : Zoé passe en arabe, l'hôte reste en français
    await p3.evaluate(() => {
      const N = window.__numero;
      N.state.lang = 'ar';
      N.render();
    });
    await wait(1200);
    check(
      (await SN(p3)).lang === 'ar' &&
        (await SN(host)).lang === 'fr' &&
        (await p3.evaluate(() => document.documentElement.dir)) === 'rtl',
      'Réglages d’affichage propres à chaque téléphone (Zoé en arabe, Léa en français)'
    );
    // déconnexion du joueur actif (Zoé) → tout le monde attend, puis l'hôte continue sans elle
    netOp(p3, 'stop');
    await wait(300);
    [h, s2] = [await SN(host), await SN(p2)];
    check(
      h.modal === 'netWait' &&
        s2.modal === 'netWait' &&
        (await host.isVisible('#netWithout')) &&
        !(await p2.$('#netWithout')),
      'Zoé déconnectée pendant son tour : « En attente de Zoé » chez tous, seul l’hôte peut continuer sans elle'
    );
    // retour de Zoé avec son jeton : elle reprend sa place
    await p3.evaluate(() => {
      window.__numero.state.modal = 'netLost';
      window.__numero.render();
    });
    await p3.click('#netRetry');
    await wait(400);
    [h, s3] = [await SN(host), await SN(p3)];
    check(
      h.modal === null && s3.screen === 'game' && s3.net.seat === 2 && s3.turn === h.turn,
      'Zoé revient (même code) : elle retrouve sa place et la partie reprend'
    );
    // nouvelle coupure, l'hôte continue sans elle
    netOp(p3, 'stop');
    await wait(250);
    await host.click('#netWithout');
    await wait(250);
    h = await SN(host);
    check(
      h.absent.includes(2) && h.modal === null && h.screen === 'game' && (await SN(p2)).screen === 'game',
      'Continuer sans Zoé : la partie continue à deux'
    );
    // V9.7 : Léa attrape le numéro → la Course s'arrête pour tous
    await host.evaluate(() => {
      const N = window.__numero;
      if (N.state.phase === 'result') N.act('next');
      N.state.modal = null;
      N.render();
    });
    await wait(250);
    h = await SN(host);
    {
      const who = (h.turn + h.starter) % h.players;
      const ph = who === 0 ? host : p2;
      await ph.click('[data-tab="guess"]');
      await wait(150);
      await ph.click(`[data-guess="${h.secret}"]`);
      await ph.click('#capPrecise');
      await wait(400);
      await ph.click('#next');
      await wait(400);
      [h, s2] = [await SN(host), await SN(p2)];
      check(
        h.screen === 'end' && s2.screen === 'end' && h.raceWinner === who,
        'Course Wi-Fi : la première capture termine la partie chez tous'
      );
    }
    // V9.16 : « Rejouer » = « je suis prêt » ; la revanche part quand tous les joueurs connectés sont prêts
    check(await p2.isVisible('#again'), 'Fin de partie : « Rejouer » aussi chez les invités');
    await p2.click('#again');
    await wait(400);
    [h, s2] = [await SN(host), await SN(p2)];
    check(
      h.screen === 'end' &&
        s2.screen === 'end' &&
        (await host.textContent('.net-ready')).includes('Omar ✅') &&
        (await host.textContent('.net-ready')).includes('Léa ⏳') &&
        (await p2.textContent('#again')).includes('Prêt'),
      'Revanche Wi-Fi : Omar prêt (✅), Léa pas encore (⏳) — personne n’est éjecté de l’écran de fin'
    );
    await host.click('#again');
    await wait(400);
    [h, s2] = [await SN(host), await SN(p2)];
    check(
      h.screen === 'game' && s2.screen === 'game' && h.players === 2 && s2.names.join() === 'Léa,Omar',
      'Revanche Wi-Fi : tout le monde prêt → nouvelle partie à 2 pour tous'
    );
    // l'hôte rejoue alors qu'il est seul : retour à la salle d'attente (même code) au lieu de ne rien faire
    {
      const [X] = [await phone()];
      const solo = X.page;
      await solo.evaluate(() => {
        const N = window.__numero;
        N.state.screen = 'lan';
        N.state.lan = { view: 'menu' };
        N.render();
      });
      await solo.fill('#netName', 'Nour');
      await solo.click('#netCreate');
      await wait(100);
      const c2 = (await solo.textContent('.net-code')).trim();
      await p3.evaluate(() => window.__numero.netLeave());
      await p3.evaluate(() => {
        const N = window.__numero;
        N.state.screen = 'lan';
        N.state.lan = { view: 'menu' };
        N.render();
      });
      check(
        (await p3.inputValue('#netName')) === 'Zoé',
        'Wi-Fi : le champ prénom garde SON prénom (pas celui de l’hôte)'
      );
      await p3.click('#netGoJoin');
      await p3.fill('#netCode', c2);
      await p3.click('#netJoinGo');
      await wait(250);
      await solo.click('#netLaunch');
      await wait(250);
      netOp(p3, 'stop');
      await wait(250);
      await solo.evaluate(() => {
        const N = window.__numero;
        N.state.screen = 'end';
        N.state.modal = null;
        N.render();
      });
      await solo.click('#again');
      await wait(250);
      const so = await SN(solo);
      check(
        so.screen === 'lan' &&
          so.lan.view === 'hostLobby' &&
          (await solo.textContent('.net-code')).trim() === c2,
        'Rejouer alors que l’autre est parti : retour à la salle d’attente, même code'
      );
      await solo.evaluate(() => window.__numero.netLeave());
      await X.ctx.close();
    }
    // l'hôte quitte en pleine partie → les invités sont prévenus
    await host.evaluate(() => window.__numero.netLeave());
    await wait(250);
    s2 = await SN(p2);
    check(
      s2.modal === 'netLost' && (await p2.isVisible('#netRetry')),
      'L’hôte quitte : « Connexion perdue » chez Omar, avec Réessayer / Quitter'
    );
    // V8.14 (bug signalé) : « Réessayer » alors que l'hôte est parti → la fenêtre reste, « Quitter » marche
    await p2.click('#netRetry');
    await wait(300);
    s2 = await SN(p2);
    check(
      s2.modal === 'netLost' &&
        s2.netLostInfo.failed &&
        (await p2.isVisible('#netQuitGame')) &&
        (await p2.textContent('.modal')).includes('introuvable'),
      'Réessayer sans hôte : message clair, jamais d’écran figé'
    );
    await p2.click('#netQuitGame');
    check(
      (await SN(p2)).screen === 'home' && !(await SN(p2)).net,
      'Quitter : retour à l’accueil, mode réseau fermé'
    );
    // relance après fermeture de l'application : jamais de partie réseau fantôme
    await p2.reload();
    check(
      (await SN(p2)).screen === 'home' && !(await SN(p2)).net,
      'Après redémarrage : pas de partie Wi-Fi « fantôme », retour à l’accueil'
    );
    const errs = [host, p2, p3].flatMap(p => p.errors);
    check(errs.length === 0, 'Aucune erreur JavaScript sur les 3 téléphones ' + errs.join(' | '));
    console.log(
      `${failed === before ? '✓' : '✗'} V8.11 : multijoueur Wi-Fi — salle d’attente, arbitrage, secret protégé, coupures, retour`
    );
    for (const x of [A, B, C]) await x.ctx.close();
  }

  // 3l) V8.12 : sauvegarde de secours des progrès (export / import)
  {
    const before = failed;
    const A = await fresh(browser, { width: 360, height: 735 });
    // un joueur avec des progrès : 2 victoires, records
    await A.page.evaluate(() => {
      const N = window.__numero;
      for (const lv of ['junior', 'malin']) {
        N.state.players = 1;
        N.state.level = lv;
        N.state.mode = 'normal';
        N.start(true);
        N.state.replayAsk = false;
        N.guess(N.state.secret);
        N.nextTurn();
      }
      N.state.lang = 'en';
      N.state.screen = 'settings';
      N.state.modal = null;
      N.render();
    });
    const src = await A.page.evaluate(() => window.__numero.loadCareer().profiles['local-default']);
    await A.page.click('#openBackup');
    await A.page.click('#backupExport');
    const code = await A.page.inputValue('#backupCode');
    check(
      /^NEF1-[A-Za-z0-9+/=]+-[0-9a-z]+$/.test(code) && code.length < 2500,
      `Export : code de sauvegarde « NEF1-… » (${code.length} caractères)`
    );
    await A.page.click('#backupCopy');
    check(
      await A.page.waitForSelector('text=Code copied', { timeout: 3000 }).then(
        () => true,
        () => false
      ),
      'Export : bouton « Copier » avec confirmation'
    );
    // nouveau téléphone
    const B = await fresh(browser, { width: 360, height: 735 });
    await B.page.evaluate(() => {
      const N = window.__numero;
      N.state.screen = 'settings';
      N.render();
    });
    await B.page.click('#openBackup');
    await B.page.click('#backupImport');
    await B.page.fill('#backupInput', 'bonjour');
    await B.page.click('#backupCheck');
    check(
      (await B.page.textContent('.net-error')).includes('pas un code'),
      'Import : texte quelconque refusé'
    );
    const broken = code.slice(0, 12) + (code[12] === 'A' ? 'B' : 'A') + code.slice(13);
    await B.page.fill('#backupInput', broken);
    await B.page.click('#backupCheck');
    check(
      (await B.page.textContent('.net-error')).includes('abîmé'),
      'Import : code modifié ou tronqué refusé (contrôle d’intégrité)'
    );
    await B.page.fill('#backupInput', '  ' + code.slice(0, 40) + '\n' + code.slice(40) + ' ');
    await B.page.click('#backupCheck');
    const conf = await B.page.textContent('.modal');
    check(
      conf.includes(`${src.xpTotal} XP`) &&
        conf.includes('2 victoires') &&
        (await B.page.evaluate(() => window.__numero.loadCareer().profiles['local-default'].xpTotal)) === 0,
      'Import : confirmation qui montre ce que contient le code et ce qu’il remplace — rien n’est écrit avant'
    );
    await B.page.click('#backupApply');
    const dst = await B.page.evaluate(() => window.__numero.loadCareer().profiles['local-default']);
    const st = await S(B.page);
    check(
      dst.xpTotal === src.xpTotal &&
        dst.totalWins === 2 &&
        dst.levels.junior.bestScore === src.levels.junior.bestScore &&
        st.lang === 'en' &&
        (await B.page.isVisible('text=Progress restored')),
      'Import : rang, XP, victoires, records et langue retrouvés'
    );
    await B.page.reload();
    check(
      (await B.page.evaluate(() => window.__numero.loadCareer().profiles['local-default'].xpTotal)) ===
        src.xpTotal,
      'Import : progrès conservés après redémarrage'
    );
    const errs = [...A.page.errors, ...B.page.errors];
    check(errs.length === 0, 'Aucune erreur JavaScript (sauvegarde) ' + errs.join(' | '));
    console.log(`${failed === before ? '✓' : '✗'} V8.12 : sauvegarde de secours des progrès`);
    await A.ctx.close();
    await B.ctx.close();
  }

  // 3m) V8.13 : accueil simplifié, menu « Plus », règles en 3 cartes, astuces « première fois »
  {
    const before = failed;
    const { ctx, page } = await fresh(browser, { width: 360, height: 640 });
    let st = await S(page);
    check(
      st.players === 1 &&
        (await page.isVisible('[data-players="1"][aria-pressed="true"]')) &&
        (await page.$$('.players-row [data-players]')).length === 4,
      'Accueil (maquette V9.2) : Solo par défaut, 4 tuiles 1 à 4 joueurs'
    );
    check(
      (await page.isVisible('#openRules')) &&
        (await page.isVisible('#openChallenge')) &&
        (await page.isVisible('#openTutorial')) &&
        (await page.isVisible('#openOffice')) &&
        (await page.isVisible('#openOffice2')),
      'Accueil : Comment jouer, Défi solo, Tutoriel, Mon bureau en tuiles ; rang cliquable'
    );
    await page.click('[data-players="3"]');
    check(
      (await S(page)).players === 3 && (await page.isVisible('[data-players="3"][aria-pressed="true"]')),
      'Tuile « 3 joueurs » : choisie et cochée'
    );
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.lang = 'en';
      N.render();
    });
    await page.reload();
    st = await S(page);
    check(
      st.players === 3 && st.lang === 'en' && st.modal === null,
      'Redémarrage : choix de l’accueil et langue conservés (sauvegarde non rejetée)'
    );
    for (const lang of ['fr', 'en', 'ar']) {
      await page.evaluate(l => {
        const N = window.__numero;
        N.state.lang = l;
        N.state.modal = null;
        N.render();
      }, lang);
      check(
        (await page.evaluate(() => document.scrollingElement.scrollHeight - innerHeight)) <= 0,
        `Accueil « À plusieurs » 360×640 (${lang}) sans défilement`
      );
      await page.click('#openRules');
      const txt = await page.textContent('.modal');
      check(
        (await page.$$('.rule-card')).length === 3 &&
          !/ruleCard|rulePoints/.test(txt) &&
          (await page.evaluate(() => {
            const m = document.querySelector('.modal');
            return m.scrollHeight <= m.clientHeight + 1;
          })),
        `Règles (${lang}) : 3 cartes traduites, sans défilement`
      );
      await page.click('#closeModal');
    }
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.lang = 'fr';
      N.render();
    });
    check(
      (await page.evaluate(() => window.__numero.back())) === false || (await S(page)).modal === null,
      'Retour : rien à fermer'
    );
    await page.click('#openRules');
    check(
      (await page.evaluate(() => window.__numero.back())) && (await S(page)).modal === null,
      'Bouton Retour : ferme « Comment jouer ? »'
    );
    // astuces du détective : une seule fois, au moment utile
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.players = 1;
      N.state.level = 'junior';
      N.state.mode = 'normal';
      N.state.tipsSeen = {};
      N.state.reduceMotion = true;
      N.start(true);
      N.state.modal = null;
      N.render();
    });
    st = await S(page);
    await page.waitForSelector(`[data-question="${st.choices[0]}"]`, { state: 'visible' });
    await page.click(`[data-question="${st.choices[0]}"]`);
    st = await S(page);
    check(
      st.modal === 'tip' && st.tipKey === 'moved' && (await page.textContent('.modal')).includes('bouger'),
      'Astuce : « le numéro vient de bouger » après le premier indice'
    );
    const t0 = st.turnElapsed;
    await page.waitForTimeout(1200);
    check((await S(page)).turnElapsed === t0, 'Astuce : le chrono est en pause pendant la lecture');
    await page.click('#tipOk');
    check(
      (await S(page)).modal === null && (await S(page)).tipsSeen.moved === true,
      'Astuce : « Compris ! » ferme et la retient'
    );
    await page.evaluate(() => {
      const N = window.__numero;
      Object.assign(N.state, { phase: 'choose', helpUsed: false, tab: 'question' });
      N.act('ask', N.state.choices[0]);
    });
    check((await S(page)).phase === 'result' && (await S(page)).modal !== 'tip', 'Astuce : jamais deux fois');
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.modal = null;
      N.state.phase = 'choose';
      N.state.helpUsed = false;
      N.render();
      N.act('tab', 'guess');
    });
    st = await S(page);
    check(
      st.modal === 'tip' && st.tipKey === 'net',
      'Astuce : le filet expliqué au premier passage sur « Deviner »'
    );
    await page.click('#tipOk');
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.screen = 'home';
      N.state.modal = null;
      N.state.inGame = false;
      N.render();
      N.start(true);
      N.state.modal = null;
      N.render();
    });
    check((await S(page)).tipsSeen.moved === true, 'Astuces vues : conservées d’une partie à l’autre');
    await page.reload();
    check((await S(page)).tipsSeen.net === true, 'Astuces vues : conservées après redémarrage');
    check(page.errors.length === 0, 'Aucune erreur JavaScript (accueil V8.13) ' + page.errors.join(' | '));
    console.log(
      `${failed === before ? '✓' : '✗'} V8.13 : accueil simplifié, menu Plus, règles en cartes, astuces`
    );
    await ctx.close();
  }

  // 3n) V8.14 : carnet « à la main » — l'enfant barre lui-même, « Décaler mes marques »
  {
    const before = failed;
    const { ctx, page } = await fresh(browser, { width: 360, height: 735 });
    let st;
    const solo = (level, extra = '') =>
      page.evaluate(
        ([lv, ex]) => {
          const N = window.__numero;
          Object.assign(N.state, { players: 1, level: lv, mode: 'normal', reduceMotion: true, modal: null });
          N.start(true);
          N.state.modal = null;
          (0, eval)(ex);
          N.render();
        },
        [level, extra]
      );
    await solo('expert');
    await page.click('#openNotebook');
    check(
      (await page.isVisible('.nb-grid.mine')) &&
        (await page.$$('.nb-cell')).length === 30 &&
        (await page.$$('.nb-cell.no')).length === 0,
      'Carnet : grille 1–30 vierge, rien n’est barré tout seul'
    );
    await page.click('[data-mark="7"]');
    await page.click('[data-mark="8"]');
    await page.click('[data-mark="8"]');
    check(
      JSON.stringify((await S(page)).marks[0].out) === '[7]',
      'Carnet : toucher barre, toucher à nouveau rétablit'
    );
    await page.click('#closeModal');
    // un indice, le numéro bouge : les marques NE bougent PAS toutes seules
    await page.evaluate(() => {
      const N = window.__numero;
      N.ask(N.state.choices[0]);
    });
    const shift = (await S(page)).last.shift;
    await page.click('#openNotebook');
    check(
      JSON.stringify((await S(page)).marks[0].out) === '[7]' && (await page.isVisible('#shiftMarks')),
      'Après un saut : marques inchangées, bouton « Décaler mes marques » proposé'
    );
    await page.click('[data-mark="1"]');
    await page.click('#shiftMarks');
    const expected = await page.evaluate(sh => {
      const N = window.__numero,
        f = N.moveFn(sh);
      const keep = new Set(
        [...Array(30)]
          .map((_, i) => i + 1)
          .filter(n => n !== 7 && n !== 1)
          .map(f)
      );
      return [...Array(30)].map((_, i) => i + 1).filter(n => !keep.has(n));
    }, shift);
    st = await S(page);
    check(
      JSON.stringify(st.marks[0].out) === JSON.stringify(expected) &&
        !(await page.$('#shiftMarks')) &&
        (await page.textContent('.modal')).includes('suivent le numéro'),
      `Décaler (${JSON.stringify(shift)}) : les marques suivent exactement le saut`
    );
    // sauvegardé avec la partie
    await page.reload();
    check(
      JSON.stringify((await S(page)).marks[0].out) === JSON.stringify(expected),
      'Carnet : marques conservées après redémarrage'
    );
    // sauts spéciaux : miroir, ×2, ÷2
    const special = await page.evaluate(() => {
      const N = window.__numero,
        r = {};
      const run = (mode, level, out, mv) => {
        Object.assign(N.state, { players: 1, level, mode });
        N.start(true);
        N.state.hunt = { start: 1, steps: [] };
        N.state.marks = [];
        N.toggleRange(...out);
        N.state.hunt.steps.push({ shift: mv, ev: null });
        N.shiftMarks();
        return N.marksOf().out;
      };
      r.mirror = run('normal', 'genius', [1, 10], { op: 'mirror' });
      r.double = run('normal', 'genius', [26, 50], { op: '×', k: 2 });
      N.state.modal = null;
      N.startChallenge('endless');
      N.state.hunt = { start: 1, steps: [] };
      N.state.marks = [];
      N.toggleMark(100);
      N.state.hunt.steps.push({ shift: { op: '÷', k: 2 }, ev: null });
      N.shiftMarks();
      r.half = N.marksOf().out;
      return r;
    });
    const range = (a, b) => [...Array(b - a + 1)].map((_, i) => a + i);
    check(
      JSON.stringify(special.mirror) === JSON.stringify(range(41, 50)),
      'Décaler 🪞 miroir : 1–10 barrés → 41–50 barrés'
    );
    check(
      JSON.stringify(special.double) === JSON.stringify(range(1, 50).filter(n => n % 2)),
      'Décaler ×2 : seuls les nombres pairs restent possibles'
    );
    check(
      JSON.stringify(special.half) === JSON.stringify(range(51, 100)),
      'Décaler ÷2 (Défi) : 51–100 deviennent impossibles'
    );
    // Génie : plages de 10 en plus de la grille
    await solo('genius');
    await page.click('#openNotebook');
    await page.click('[data-range="11-20"]');
    check(
      (await page.$$('.nb-cell.no')).length === 10 && (await page.isVisible('.nb-range.no')),
      'Génie : une plage barre 10 numéros d’un coup'
    );
    await page.click('[data-range="11-20"]');
    check((await page.$$('.nb-cell.no')).length === 0, 'Génie : toucher la plage à nouveau la rétablit');
    await page.click('#closeModal');
    // Défi 1–100 : 10 plages, on en ouvre une
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.modal = null;
      N.startChallenge('endless');
      N.state.modal = null;
      N.render();
    });
    await page.click('#openNotebook');
    check(
      (await page.$$('.nb-tiles .nb-range')).length === 10 && !(await page.$('.nb-cell')),
      'Défi : 10 plages de 10 (pas 100 cases)'
    );
    await page.click('[data-zoom="9"]');
    await page.click('[data-mark="95"]');
    await page.click('.nb-rangebtn');
    check(
      (await S(page)).marks[0].out.length === 10 &&
        (await page.textContent('.nb-zoom-btn, .nb-rangebtn')).includes('91–100'),
      'Défi : plage ouverte, numéros barrés un par un ou tous ensemble'
    );
    check(
      (await page.evaluate(() => document.scrollingElement.scrollHeight - innerHeight)) <= 0 &&
        (await page.evaluate(() => {
          const m = document.querySelector('.modal');
          return m.scrollHeight <= m.clientHeight + 1;
        })),
      'Défi : carnet sans défilement'
    );
    await page.click('#closeModal');
    // chacun son carnet ; nouveau numéro (Course) → carnet vierge
    await page.evaluate(() => {
      const N = window.__numero;
      Object.assign(N.state, { players: 2, level: 'malin', mode: 'normal', gameMode: 'race', starter: 0 });
      N.start(true);
      N.state.modal = null;
      N.toggleMark(3);
      N.toggleMark(4);
      N.render();
    });
    st = await page.evaluate(() => {
      const N = window.__numero;
      N.state.turn = 1;
      return [N.marksOf(1).out.length, N.marksOf(0).out.length];
    });
    check(st[0] === 0 && st[1] === 2, 'Chaque joueur a son propre carnet');
    st = await page.evaluate(() => {
      const N = window.__numero;
      N.state.captures++;
      return N.marksOf(0).out.length;
    });
    check(st === 0, 'Nouveau numéro (après une capture) : carnet vierge');
    st = await page.evaluate(() => window.__numero.netLocalKeys.includes('marks'));
    check(st === true, 'Wi-Fi : les marques restent sur le téléphone de chacun (jamais envoyées)');
    check(page.errors.length === 0, 'Aucune erreur JavaScript (carnet à la main) ' + page.errors.join(' | '));
    // V8.14 : fin de partie sans capture → le numéro est révélé, avec le film de son évasion
    st = await page.evaluate(() => {
      const N = window.__numero;
      Object.assign(N.state, { players: 2, level: 'junior', gameMode: 'score', modal: null });
      N.start(true);
      N.state.modal = null;
      for (let i = 0; i < 3; i++) N.ask(N.state.choices[0]);
      N.state.turn = N.state.limit - 1;
      N.state.phase = 'result';
      N.state.last = { type: 'wrong', n: 1, player: 1 };
      N.nextTurn();
      return N.state;
    });
    check(
      st.screen === 'end' &&
        (await page.textContent('.escaped-note')).includes('sur le ' + st.escaped.n) &&
        (await page.isVisible('#openReplay')),
      `Personne ne trouve : « le numéro se cachait sur le ${st.escaped.n} » + bouton film`
    );
    await page.click('#openReplay');
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.rpIdx = 99;
      N.render();
    });
    check(
      (await page.textContent('.rp-cap')).includes('il était sur le ' + st.escaped.n),
      'Film de l’évasion : dernière image « personne ne l’a attrapé »'
    );
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.modal = null;
      N.render();
    });
    console.log(`${failed === before ? '✓' : '✗'} V8.14 : carnet « à la main », décaler mes marques`);
    await ctx.close();
  }

  // 3p) V9.0 : The Number Hunt — langue du téléphone, 8 langues, logo
  {
    const before = failed;
    const LANG8 = ['fr', 'en', 'ar', 'es', 'it', 'de', 'zh', 'ja'];
    // premier lancement : la langue du téléphone est choisie (sinon l'anglais)
    for (const [locale, want] of [
      ['es-MX', 'es'],
      ['de-DE', 'de'],
      ['it-IT', 'it'],
      ['zh-CN', 'zh'],
      ['zh-TW', 'zh'],
      ['ja-JP', 'ja'],
      ['ar-MA', 'ar'],
      ['fr-CA', 'fr'],
      ['en-US', 'en'],
      ['pt-BR', 'en'],
      ['ko-KR', 'en']
    ]) {
      const ctx = await browser.newContext({ locale, viewport: { width: 360, height: 735 } });
      const page = await ctx.newPage();
      await page.goto(URL);
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      const lang = await page.evaluate(() => window.__numero.state.lang);
      check(lang === want, `Premier lancement, téléphone en ${locale} → jeu en « ${want} » (${lang})`);
      await ctx.close();
    }
    const { ctx, page } = await fresh(browser, { width: 360, height: 735 });
    check(
      (await page.evaluate(() =>
        [
          window.__numero.deviceLang(['pt-PT', 'it-CH']),
          window.__numero.deviceLang(['zh-Hant-HK']),
          window.__numero.deviceLang([])
        ].join()
      )) === 'it,zh,en',
      'Langue du téléphone : première langue reconnue de la liste, repli sur l’anglais'
    );
    // un joueur existant garde sa langue sauvegardée, quel que soit le téléphone
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.lang = 'ar';
      N.render();
    });
    await page.waitForTimeout(250);
    await page.reload();
    check(
      (await page.evaluate(() => window.__numero.state.lang)) === 'ar',
      'Joueur existant : la langue sauvegardée est gardée'
    );
    // nom et logo
    check((await page.title()) === 'The Number Hunt', 'Titre de la page : The Number Hunt');
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.lang = 'fr';
      N.state.screen = 'home';
      N.state.modal = null;
      N.render();
    });
    const logo = await page.evaluate(() => {
      const el = document.querySelector('.logo-art');
      const r = el.getBoundingClientRect();
      return {
        bg: getComputedStyle(el).backgroundImage.slice(0, 30),
        w: r.width,
        label: el.getAttribute('aria-label')
      };
    });
    check(
      logo.bg.includes('data:image/webp') && logo.w >= 140 && logo.label === 'The Number Hunt',
      `Accueil : logo The Number Hunt affiché (${Math.round(logo.w)} px)`
    );
    check(
      !(
        await page.evaluate(
          () =>
            getComputedStyle(document.body).cssText +
            [...document.styleSheets].map(s => [...s.cssRules].map(r => r.cssText).join('')).join('')
        )
      ).match(/#f36ab6|#be3e85|#ef7ca8|#fa75a1/i),
      'Plus de rose dans les styles'
    );
    // réglages : une ligne « Langue » → fenêtre aux 8 langues ; chaque langue s'affiche sans erreur
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.screen = 'settings';
      N.render();
    });
    await page.click('#openLang');
    check(
      (await page.$$eval('.lang-grid .lang-choice', b => b.length)) === 8,
      'Réglages : 8 langues proposées'
    );
    for (const l of LANG8) {
      if (!(await page.$('#openLang')) || (await S(page)).modal !== 'lang') await page.click('#openLang');
      await page.click(`[data-language="${l}"]`);
      const r = await page.evaluate(() => ({
        lang: window.__numero.state.lang,
        html: document.documentElement.lang,
        dir: document.documentElement.dir,
        modal: window.__numero.state.modal,
        raw: /\b[a-z]+[A-Z]\w*\b/.test(document.querySelector('.settings-title').textContent)
      }));
      check(
        r.lang === l && r.html === l && r.dir === (l === 'ar' ? 'rtl' : 'ltr') && r.modal === null && !r.raw,
        `Langue « ${l} » : choisie, appliquée à la page, fenêtre refermée`
      );
      for (const scr of ['home', 'game', 'office']) {
        await page.evaluate(scr => {
          const N = window.__numero;
          N.state.modal = null;
          if (scr === 'game') {
            N.state.players = 1;
            N.start(true);
            N.state.modal = null;
          } else N.state.screen = scr;
          N.render();
        }, scr);
        await page.waitForTimeout(450); // fin de l'animation d'entrée d'écran
        const sc = await page.evaluate(() => document.scrollingElement.scrollHeight - innerHeight);
        check(sc <= 2, `Langue « ${l} », écran ${scr} : pas de défilement (${sc}px)`);
      }
      await page.evaluate(() => {
        const N = window.__numero;
        N.state.screen = 'settings';
        N.state.modal = null;
        N.render();
      });
    }
    check(page.errors.length === 0, 'V9 : aucune erreur JavaScript ' + page.errors.join(' | '));
    console.log(
      `${failed === before ? '✓' : '✗'} V9.0 : The Number Hunt, langue du téléphone, 8 langues, logo`
    );
    await ctx.close();
  }

  // 3q) V9.6 : bureau par niveau — XP selon le niveau, aide = 0, badges à paliers, missions adaptées
  {
    const before = failed;
    const { ctx, page } = await fresh(browser, { width: 360, height: 735 });
    const win = (lv, help = false) =>
      page.evaluate(
        ([lv, help]) => {
          const N = window.__numero;
          Object.assign(N.state, {
            players: 1,
            level: lv,
            mode: 'normal',
            replayAsk: false,
            modal: null,
            playerHelp: [help, false, false, false]
          });
          N.start(true);
          N.state.modal = null;
          N.guess(N.state.secret);
          N.nextTurn();
          return N.state.soloResult;
        },
        [lv, help]
      );
    const prof = () => page.evaluate(() => window.__numero.loadCareer().profiles['local-default']);
    let r = await win('junior');
    check(
      r.xp === 15 && r.newBadges.includes('flash') && r.badgeTier === 1,
      `Petit : victoire + record = 15 XP, badge « Éclair » 🥉 (${r.xp} XP, palier ${r.badgeTier})`
    );
    r = await win('junior');
    check(
      r.xp === 10 && !r.newBadges.includes('flash'),
      'Petit : 10 XP, « Éclair » 🥉 pas regagné au même niveau'
    );
    r = await win('genius');
    let p = await prof();
    check(
      r.xp === 45 && r.newBadges.includes('flash') && p.badges.flash === 4 && p.badges.hound === 4,
      `Génie : 30 + 15 XP, « Éclair » passe en 💎, « Fin limier » 💎 (${r.xp} XP)`
    );
    const xp0 = p.xpTotal,
      w0 = p.totalWins,
      hw0 = p.totalHelpWins || 0;
    r = await win('expert', true);
    p = await prof();
    check(
      r.xp === 0 &&
        r.newBadges.length === 0 &&
        r.missionXp === 0 &&
        p.xpTotal === xp0 &&
        p.totalWins === w0 + 1 &&
        p.totalHelpWins === hw0 + 1,
      'Avec l’aide : victoire comptée « avec aide », mais 0 XP, aucun badge, aucune mission'
    );
    check(
      p.missions.length === 3 &&
        p.missions.every(m => m.min != null || m.level || m.k === 'shift' || m.progress >= 0),
      'Missions : toujours 3, avec un niveau minimum'
    );
    const step = await page.evaluate(() => {
      const N = window.__numero,
        c = N.loadCareer(),
        pr = c.profiles['local-default'];
      pr.missions = [
        { k: 'precise', min: 2, progress: 0, goal: 1 },
        { k: 'play', n: 3, min: 0, progress: 0, goal: 3 },
        { k: 'noMiss', min: 3, progress: 0, goal: 1 }
      ];
      localStorage.setItem('numeroEnFuiteCareerV1', JSON.stringify(c));
      return true;
    });
    await win('junior');
    p = await prof();
    check(
      p.missions.some(m => m.k === 'precise' && m.progress === 0) &&
        p.missions.some(m => m.k === 'noMiss' && m.progress === 0) &&
        p.missions.some(m => m.k === 'play' && m.progress === 1),
      'Mission « niveau Grand ou plus » : une victoire au niveau Petit ne compte pas'
    );
    await win('genius');
    p = await prof();
    check(
      !p.missions.some(m => m.k === 'precise' && m.min === 2) &&
        !p.missions.some(m => m.k === 'noMiss' && m.min === 3),
      'Une victoire au niveau Génie compte pour les missions Grand+ et Génie'
    );
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.screen = 'office';
      N.state.officeTab = 'badges';
      N.state.modal = null;
      N.render();
    });
    check(
      (await page.textContent('.badge-shelf')).includes('💎') &&
        (await page.textContent('.badge-shelf')).includes('Génie'),
      'Onglet Badges : médaille du palier et niveau affichés'
    );
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.officeTab = 'missions';
      N.render();
    });
    check(
      /ou plus/.test(await page.textContent('.mission-list')),
      'Onglet Missions : le niveau minimum est écrit'
    );
    // anciens badges (date) gardés au palier 🥉
    const mig = await page.evaluate(() => {
      const c = JSON.parse(localStorage.getItem('numeroEnFuiteCareerV1'));
      c.profiles['local-default'].badges = { lynx: 1700000000000 };
      localStorage.setItem('numeroEnFuiteCareerV1', JSON.stringify(c));
      return window.__numero.loadCareer().profiles['local-default'].badges.lynx;
    });
    check(mig === 1, 'Ancien badge (date) repris au palier 🥉');
    check(page.errors.length === 0, 'V9.6 : aucune erreur JavaScript ' + page.errors.join(' | '));
    console.log(
      `${failed === before ? '✓' : '✗'} V9.6 : XP par niveau, aide sans récompense, badges à paliers, missions par niveau`
    );
    await ctx.close();
  }

  // 3o) V8.15 : bureau (badges, missions, chapeaux) et écran de victoire compact animé
  {
    const before = failed;
    const { ctx, page } = await fresh(browser, { width: 360, height: 640 });
    const win = (level, opts = '') =>
      page.evaluate(
        ([lv, o]) => {
          const N = window.__numero;
          Object.assign(N.state, { players: 1, level: lv, mode: 'normal', replayAsk: false, modal: null });
          N.start(true);
          N.state.modal = null;
          (0, eval)(o);
          N.guess(N.state.secret);
          N.nextTurn();
          return N.state.soloResult;
        },
        [level, opts]
      );
    check(
      await page.evaluate(() => window.__numero.mascot('idle').includes('hat-r1')),
      'Rang 1 : chapeau d’origine du détective'
    );
    let r = await win('junior');
    check(
      r.newBadges.includes('flash') && r.newBadges.includes('lynx'),
      `Victoire en 1 tour, sans erreur : badges « Éclair » et « Œil de lynx » (${r.newBadges.join(', ')})`
    );
    check(
      (await page.isVisible('.reward-chip.xp')) &&
        (await page.textContent('.reward-line')).includes('badges'),
      'Écran de fin : XP et nouveaux badges regroupés sur une ligne'
    );
    check(
      await page.$('.detective-scene.record'),
      'Nouveau record : le détective saute de joie avec un trophée'
    );
    const p1 = await page.evaluate(() => window.__numero.loadCareer().profiles['local-default']);
    check(
      p1.missions.length === 3 && p1.missions.some(m => m.k === 'play' && m.progress === 1),
      'Missions : 3 en cours, « Mène 3 enquêtes » avance (1/3)'
    );
    r = await win('junior');
    r = await win('junior');
    const p2 = await page.evaluate(() => window.__numero.loadCareer().profiles['local-default']);
    check(
      r.missionsDone.some(m => m.k === 'play') &&
        r.missionXp >= 20 &&
        p2.missions.length === 3 &&
        !p2.missions.some(m => m.k === 'play'),
      `Mission réussie : +${r.missionXp} XP, remplacée par une nouvelle`
    );
    check(!r.newBadges.includes('flash'), 'Un badge ne se gagne qu’une fois');
    // chapeau selon le rang
    for (let i = 0; i < 3; i++) await win('genius'); // V9.6 : le Génie rapporte assez d'XP pour le rang 2
    const rank = await page.evaluate(
      () => window.__numero.rankOf(window.__numero.loadCareer().profiles['local-default'].xpTotal).rank
    );
    check(
      rank >= 2 && (await page.$(`.detective-scene.hat-r${rank}`)),
      `Rang ${rank} : nouveau chapeau sur le détective`
    );
    // score qui défile, puis valeur finale ; tout tient en 360×640
    await page.evaluate(() => {
      window.__numero.state.reduceMotion = false;
    });
    await win('malin');
    await page.waitForTimeout(150);
    const target = Number(await page.getAttribute('[data-count]', 'data-count')),
      midV = Number(await page.textContent('[data-count]'));
    await page.waitForTimeout(1600);
    check(
      midV < target && Number(await page.textContent('[data-count]')) === target,
      `Score de fin qui défile (${midV} → ${target})`
    );
    await page.evaluate(() => window.__numero.render());
    check(
      Number(await page.textContent('[data-count]')) === target,
      'Score : ne redéfile pas à chaque affichage'
    );
    for (const lang of ['fr', 'en', 'ar']) {
      await page.evaluate(l => {
        const N = window.__numero;
        N.state.lang = l;
        N.render();
      }, lang);
      check(
        (await page.evaluate(() => document.scrollingElement.scrollHeight - innerHeight)) <= 0,
        `Victoire 360×640 (${lang}) : sans défilement`
      );
    }
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.lang = 'fr';
      N.state.reduceMotion = true;
      Object.assign(N.state, { players: 1, level: 'malin' });
      N.start(true);
      N.state.modal = null;
      for (let i = 0; i < 12 && N.state.screen === 'game'; i++) {
        N.guess(N.state.secret === 1 ? 2 : 1);
        N.nextTurn();
      }
      N.render();
    });
    check(
      (await page.$('.detective-scene.cheer.expr-wink')) &&
        (await page.evaluate(() => document.scrollingElement.scrollHeight - innerHeight)) <= 0,
      'Défaite : clin d’œil d’encouragement du détective, sans défilement'
    );
    // le bureau : 4 onglets
    await page.click('#openOffice');
    check(
      (await page.isVisible('.rank-line-hats')) && (await page.$$('.rank-step')).length === 8,
      'Bureau › Rang : frise des 8 chapeaux'
    );
    await page.click('[data-otab="badges"]');
    check(
      (await page.$$('.badge')).length === 6 &&
        (await page.$$('.badge.got')).length >= 2 &&
        (await page.textContent('.badge.locked')).length > 5,
      'Bureau › Badges : étagère de 6, ceux à gagner disent comment'
    );
    await page.click('[data-otab="missions"]');
    check(
      (await page.$$('.mission-list li')).length === 3 &&
        (await page.textContent('.mission-list')).match(/\d\/\d/),
      'Bureau › Missions : 3 missions avec leur progression'
    );
    // sauvegarde de secours : badges et missions inclus
    const code = await page.evaluate(() => window.__numero.exportProgress());
    const back = await page.evaluate(
      c => window.__numero.readBackup(c).data.career.profiles['local-default'],
      code
    );
    check(
      Object.keys(back.badges).length >= 2 && back.missions.length === 3,
      'Code de sauvegarde : badges et missions inclus'
    );
    check(page.errors.length === 0, 'Aucune erreur JavaScript (bureau V8.15) ' + page.errors.join(' | '));
    console.log(
      `${failed === before ? '✓' : '✗'} V8.15 : badges, missions, chapeaux, victoire compacte animée`
    );
    await ctx.close();
  }

  // 3p) V8.16 : retours sur téléphone (Génie à 4, écran utile court 360×690)
  {
    const before = failed;
    const { ctx, page } = await fresh(browser, { width: 360, height: 690 });
    const scroll = () =>
      page.evaluate(() =>
        Math.max(
          document.scrollingElement.scrollHeight - innerHeight,
          ...[...document.querySelectorAll('.turn-body')].map(e => e.scrollHeight - e.clientHeight)
        )
      );
    await page.evaluate(() => {
      const N = window.__numero;
      Object.assign(N.state, {
        players: 4,
        names: ['Zied', 'Assya', '', ''],
        level: 'genius',
        mode: 'normal',
        gameMode: 'race',
        replayAsk: false,
        reduceMotion: true,
        timerMode: 'normal'
      });
      N.start(true);
      N.state.modal = null;
      N.render();
      N.act('tab', 'guess');
      N.pressKey('3');
      N.pressKey('8');
    });
    const kp = await page.evaluate(() => {
      const d = document.querySelector('.kp-display').getBoundingClientRect(),
        s = document.querySelector('.kp-display small').getBoundingClientRect();
      return d.bottom - s.bottom;
    });
    check(
      (await scroll()) <= 0 && kp >= 5 && (await page.isVisible('#capNet')),
      `Génie à 4 : clavier, aperçu du filet DANS le champ (${Math.round(kp)} px du bord), boutons de capture visibles sans défiler`
    );
    await page.evaluate(() => {
      const N = window.__numero;
      N.act('tab', 'question');
      N.ask(N.state.choices[0]);
      N.nextTurn();
      N.state.secret = 25;
      N.netCapture(25);
      N.state.modal = null;
      N.render();
    });
    check(
      (await scroll()) <= 0 && (await page.isVisible('.catch-head')),
      'Filet réussi (Course, bonus déduction) : carte compacte, sans défilement'
    );
    await page.evaluate(() => {
      const N = window.__numero;
      N.start(true);
      N.state.modal = null;
      N.state.reduceMotion = false;
      N.render();
      const s = N.state.secret;
      N.netCapture(s > 40 ? 2 : 48);
      N.state.modal = null;
      N.render();
    });
    await page.waitForTimeout(1500);
    const out = await page.evaluate(() => {
      const box = document.querySelector('.move-line').getBoundingClientRect(),
        tok = document.querySelector('.bj-token').getBoundingClientRect();
      return tok.left >= box.left && tok.right <= box.right;
    });
    check(out && (await scroll()) <= 0, 'Filet vide : le pion « ? » du saut reste dans sa boîte');
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.reduceMotion = true;
      let k = 0;
      while (N.state.screen === 'game' && k++ < 300) {
        N.state.modal = null;
        if (N.state.phase === 'result') {
          N.nextTurn();
          continue;
        }
        const s = N.state.secret;
        N.guess(s === 1 ? 2 : 1);
      }
      N.state.modal = null;
      N.render();
    });
    check(
      (await S(page)).screen === 'end' &&
        (await scroll()) <= 0 &&
        (await page.isVisible('.panel > .escaped-note')) &&
        !(await page.$('.end-hero .escaped-note')),
      'Fin de Course à 4 : « le numéro se cachait… » dans le cadre, sans défilement'
    );
    check(page.errors.length === 0, 'Aucune erreur JavaScript (V8.16) ' + page.errors.join(' | '));
    // V8.17 : une question ne réduit jamais, à elle seule, les possibles à la portée du filet
    const qs = await page.evaluate(() => {
      const N = window.__numero,
        G = () => N.state,
        out = {};
      for (const level of ['junior', 'malin', 'expert', 'genius']) {
        let tot = 0,
          bad = 0,
          narrow = 0;
        for (let k = 0; k < 120; k++) {
          Object.assign(G(), { players: 1, level, mode: 'normal', gameMode: 'race', modal: null });
          N.start(true);
          G().modal = null;
          for (let t = 0; t < 3 && G().screen === 'game'; t++) {
            const C = G().candidates,
              ns = N.netSize();
            for (const id of G().choices) {
              const q = N.qbyid(id),
                y = C.filter(n => q.test(n)).length;
              tot++;
              if (C.length >= 4 * ns && Math.min(y, C.length - y) < 2 * ns) bad++;
              if (id.startsWith('range')) {
                const w = Number(id.slice(5).split('_')[0]);
                if (w < 2 * ns) narrow++;
              }
            }
            N.ask(G().choices[0]);
            N.nextTurn();
            G().modal = null;
            const C2 = G().candidates;
            N.guess(C2[0] === G().secret ? C2[1] || 1 : C2[0]);
            G().modal = null;
            if (G().phase === 'result') N.nextTurn();
            G().modal = null;
          }
        }
        out[level] = { tot, bad, narrow };
      }
      return out;
    });
    for (const [lv, r] of Object.entries(qs))
      check(
        r.tot > 200 && r.bad === 0 && r.narrow === 0,
        `Questions ${lv} : chacune laisse au moins 2 × filet numéros possibles (${r.tot} questions vérifiées)`
      );
    console.log(`${failed === before ? '✓' : '✗'} V8.16 : Génie à 4 sur écran court`);
    await ctx.close();
  }

  // 3q) V8.18 : nouveau mode Défi (sauts par difficulté, sens caché, gels comptés, question au choix, laisser filer)
  {
    const before = failed;
    const { ctx, page } = await fresh(browser, { width: 360, height: 740 });
    const ops = await page.evaluate(() => {
      const N = window.__numero,
        out = {};
      for (const d of ['easy', 'medium', 'hard']) {
        N.startChallenge('endless', d);
        const seen = new Set();
        for (let i = 0; i < 600; i++) {
          const m = N.nextMove();
          const add = x =>
            seen.add(
              x.op === '+'
                ? '±' + Math.abs(x.k) + (x.k > 0 ? '+' : '-')
                : x.op === '±'
                  ? 'caché'
                  : x.op === '×m'
                    ? '×' + x.k
                    : x.op
            );
          if (m.op === 'seq') {
            seen.add('double');
            m.steps.forEach(add);
          } else add(m);
        }
        out[d] = [...seen].sort().join(' ');
      }
      const bij = [2, 3].every(
        k =>
          N.moveImage(
            Array.from({ length: 100 }, (_, i) => i + 1),
            { op: '×m', k }
          ).length === 100
      );
      return { ...out, bij };
    });
    check(/^(±[357][+-] ?){6}$/.test(ops.easy), `Défi Facile : seulement ±3, ±5, ±7 (${ops.easy})`);
    check(
      ['caché', 'mirror', '×2', '±13+', '±7-'].every(x => ops.medium.includes(x)) &&
        !ops.medium.includes('÷') &&
        !ops.medium.includes('×3') &&
        !ops.medium.includes('double'),
      `Défi Moyen : ±7…±13, miroir, ×2, sens parfois caché, pas de ÷2 (${ops.medium})`
    );
    check(
      ['caché', 'mirror', '×2', '×3', 'double'].every(x => ops.hard.includes(x)),
      `Défi Difficile : + ×3 et doubles sauts (${ops.hard})`
    );
    check(ops.bij, '×2 et ×3 « modulo 101 » : 100 numéros → 100 cases (deux numéros ne fusionnent jamais)');
    // sens caché : jamais révélé, les deux sens restent possibles
    const hid = await page.evaluate(() => {
      const N = window.__numero;
      N.startChallenge('endless', 'medium');
      const s = N.state;
      s.modal = null;
      s.candidates = [50];
      s.secret = 50;
      s.hunt = { start: 50, steps: [] };
      // on force un saut caché de 7
      let m;
      for (let i = 0; i < 400; i++) {
        s.secret = 50;
        s.candidates = [50];
        m = N.nextMove();
        if (m.op === '±') break;
      }
      s.last = { type: 'pass', player: 0, shift: m };
      s.phase = 'result';
      N.render();
      const card = document.querySelector('.result-card').textContent;
      return {
        op: m.op,
        k: m.k,
        cands: s.candidates.join(','),
        secret: s.secret,
        card,
        label: document.querySelector('.bj-label').textContent
      };
    });
    check(
      hid.op === '±' &&
        hid.cands === [50 - hid.k, 50 + hid.k].join(',') &&
        hid.label.includes('↔ ±' + hid.k) &&
        hid.card.includes('sens inconnu'),
      `Sens caché : « saut de ${hid.k}… » sans le sens ; possibles ${hid.cands} (vrai : ${hid.secret})`
    );
    // gels comptés : Facile illimité, Moyen 3, Difficile 1
    const fr = await page.evaluate(() => {
      const N = window.__numero,
        out = {};
      for (const d of ['easy', 'medium']) {
        N.startChallenge('endless', d);
        const r = [];
        for (let i = 0; i < 5; i++) {
          const s = N.state;
          s.modal = null;
          s.phase = 'choose';
          s.helpUsed = false;
          N.mathAnswer(s.math.result);
          r.push(s.last.frozen ? 'G' : 'm');
          s.phase = 'choose';
          s.helpUsed = false;
          s.math = { ...s.math };
        }
        out[d] = r.join('');
      }
      return out;
    });
    check(
      fr.easy === 'GGGGG' && fr.medium === 'GGGmm',
      `Gels : Facile à chaque calcul juste (${fr.easy}), Moyen 3 puis le numéro bouge (${fr.medium})`
    );
    // Difficile : le calcul juste laisse choisir sa question
    await page.evaluate(() => {
      const N = window.__numero;
      N.startChallenge('endless', 'hard');
      N.state.modal = null;
      N.render();
    });
    await page.click('[data-tab="math"]');
    await page.click(`[data-math="${(await S(page)).math.result}"]`);
    st = await S(page);
    check(
      st.last.pick && (await page.$$('[data-mpick]')).length === 3 && (await page.isHidden('#next')),
      'Difficile : calcul juste → 3 questions au choix, « Suivant » caché tant qu’on n’a pas choisi'
    );
    const nb0 = st.candidates.length,
      qid = st.choices[1];
    await page.click(`[data-mpick="${qid}"]`);
    st = await S(page);
    check(
      !st.last.pick &&
        st.last.qid === qid &&
        st.last.frozen &&
        st.chFreezes === 0 &&
        st.candidates.length < nb0 &&
        (await page.isVisible('#next')) &&
        (await page.textContent('.move-line.frozen')).includes('0'),
      'Difficile : question choisie appliquée, unique gel utilisé (0 restant)'
    );
    const hist = await page.evaluate(() => {
      const N = window.__numero;
      N.state.modal = 'notebook';
      N.state.nbTab = 'clues';
      N.render();
      return document.querySelector('.nb-clues').textContent;
    });
    check(
      hist.includes(await page.evaluate(id => window.__numero.qbyid(id).text, qid)),
      'Carnet › Indices : la question gagnée par le calcul est notée'
    );
    await page.evaluate(() => {
      const N = window.__numero;
      N.state.modal = null;
      N.render();
    });
    // laisser filer : aucune pénalité, le numéro bouge
    await page.click('#next');
    const sc0 = await page.evaluate(() => window.__numero.chScore());
    check(await page.isVisible('#passTurn'), 'Défi : bouton « Laisser filer » sur l’onglet Deviner');
    await page.click('#passTurn');
    st = await S(page);
    const sc1 = await page.evaluate(() => window.__numero.chScore());
    check(
      st.last.type === 'pass' &&
        typeof st.last.shift === 'object' &&
        sc1 === sc0 &&
        (await page.textContent('.result-card')).includes('laisses filer'),
      `Laisser filer : pas de capture, aucune pénalité (${sc0} → ${sc1}), le numéro bouge`
    );
    await page.click('#next');
    check(
      (await S(page)).turn === st.turn + 1 && (await S(page)).phase === 'choose',
      'Laisser filer : on passe au tour suivant'
    );
    // carnet à la main : « Décaler mes marques » garde les deux sens d'un saut caché
    const mk = await page.evaluate(() => {
      const N = window.__numero,
        s = N.state;
      s.marks = [];
      s.hunt = { start: 50, steps: [] };
      for (let n = 1; n <= 100; n++) if (n !== 50) N.toggleMark(n);
      s.hunt.steps.push({ from: 50, to: 57, shift: { op: '±', k: 7, dir: 1 }, ev: null });
      N.shiftMarks();
      return 100 - N.marksOf().out.length + ':' + [43, 57].every(n => !N.marksOf().out.includes(n));
    });
    check(mk === '2:true', 'Carnet : décaler un saut caché de 7 garde 43 ET 57 (' + mk + ')');
    // anciens records gardés et affichés
    await page.evaluate(() => {
      localStorage.setItem(
        'numeroEnFuiteRecords',
        JSON.stringify({ 'endless-medium': 870, 'endless-medium-v2': 640 })
      );
      const N = window.__numero;
      Object.assign(N.state, { screen: 'home', mode: 'normal', modal: 'challenge', chDiffPref: 'medium' });
      N.render();
    });
    const mt = await page.textContent('.modal');
    check(
      mt.includes('640') &&
        /Anciens records[\s\S]*870/.test(mt) &&
        (await page.isVisible('.modal details summary')),
      'Défi : nouveaux records (640) ; anciens gardés pour mémoire (870) ; règles de la difficulté'
    );
    // équilibrage (joueur « calculatrice » qui suit parfaitement les possibles) : 3 difficultés distinctes
    const bal = await page.evaluate(() => {
      const N = window.__numero,
        G = () => N.state,
        med = a => {
          const s = [...a].sort((x, y) => x - y);
          return s[Math.floor(s.length / 2)];
        };
      const cover = (C, n) => N.netRange(n).filter(x => C.includes(x)).length,
        out = {};
      for (const d of ['easy', 'medium', 'hard']) {
        const turns = [];
        let lucky = 0;
        for (let k = 0; k < 150; k++) {
          N.startChallenge('endless', d);
          let t = 0;
          while (G().screen === 'game' && t < 40) {
            G().modal = null;
            if (G().phase === 'result') {
              N.nextTurn();
              continue;
            }
            const C0 = G().candidates;
            const fits = C0.length === 1 || (N.netsLeft() && C0.some(n => cover(C0, n) === C0.length));
            if (!fits && !G().helpUsed) {
              N.mathAnswer(G().math.result);
              if (G().last.pick) {
                const C = G().candidates;
                const best = G().choices.reduce(
                  (b, id) => {
                    const q = N.qbyid(id),
                      y = C.filter(n => q.test(n)).length,
                      s = Math.min(y, C.length - y);
                    return s > b.s ? { id, s } : b;
                  },
                  { id: G().choices[0], s: -1 }
                ).id;
                N.mathPick(best);
              }
              N.nextTurn();
              G().modal = null;
            }
            const C = G().candidates;
            t++;
            if (C.length === 1) N.guess(C[0]);
            else {
              const n = C.find(x => cover(C, x) === C.length);
              if (n != null && N.netsLeft()) N.netCapture(n);
              else N.passTurn();
            }
            N.nextTurn();
          }
          turns.push(t);
        }
        out[d] = med(turns);
      }
      return out;
    });
    check(
      bal.easy <= 6 && bal.medium >= bal.easy + 1 && bal.hard >= bal.medium + 1 && bal.hard <= 12,
      `Équilibrage (150 parties « calculatrice ») : médianes Facile ${bal.easy} < Moyen ${bal.medium} < Difficile ${bal.hard} tours`
    );
    check(page.errors.length === 0, 'Aucune erreur JavaScript (Défi V8.18) ' + page.errors.join(' | '));
    console.log(`${failed === before ? '✓' : '✗'} V8.18 : nouveau mode Défi`);
    await ctx.close();
  }

  // 4) Rendu sur petits écrans + captures
  for (const vp of [
    { width: 320, height: 568, tag: '320' },
    { width: 360, height: 740, tag: '360' }
  ]) {
    const before = failed;
    const { ctx, page } = await fresh(browser, { width: vp.width, height: vp.height });
    const pre = vp.tag === '360' ? '' : 'petit_';
    await noOverflow(page, `Accueil ${vp.tag}px`);
    await shot(page, pre + '01_accueil');
    const tile = await page.$eval('[data-players="1"]', el => el.getBoundingClientRect().height);
    check(tile >= 44, `Boutons tactiles ≥ 44 px (${Math.round(tile)} px)`);
    await pickPlayers(page, 3);
    await page.click('[data-level="expert"]');
    await page.click('#start');
    await page.waitForTimeout(300);
    await shot(page, pre + '01b_prenoms');
    await page.click('#namesGo');
    await page.waitForFunction(() => window.__numero.state.screen === 'game');
    await page.waitForTimeout(450);
    await noOverflow(page, `Partie ${vp.tag}px`);
    await shot(page, pre + '03_questions');
    const pageScroll = await page.evaluate(() => document.scrollingElement.scrollHeight - window.innerHeight);
    check(
      pageScroll <= 1,
      `Partie ${vp.tag}px : tout tient sur l’écran, pas de défilement (${pageScroll}px)`
    );
    await page.click('[data-tab="math"]');
    await page.waitForTimeout(1500);
    await shot(page, pre + '04_calcul');
    const st = await S(page);
    await page.click(`[data-math="${st.math.result}"]`);
    await page.waitForTimeout(400);
    await shot(page, pre + '05_calcul_reussi');
    await page.click('#next');
    await noOverflow(page, `Grille 1-30 ${vp.tag}px`);
    await shot(page, pre + '06_grille_grand');
    if (vp.tag === '360') {
      await page.click('[data-guess="12"]');
      await page.waitForTimeout(200);
      await shot(page, pre + '06b_filet');
      const inner = await page.$eval('.turn-body', el => el.scrollHeight - el.clientHeight);
      check(inner <= 2, `Grille 1-30 + boutons de capture visibles sans défiler (${inner}px)`);
    }
    const t = await page.$eval('[data-guess="30"]', el => el.getBoundingClientRect());
    check(
      t.width >= 44 && t.height >= (vp.tag === '360' ? 44 : 36),
      `Cases numéros 1-30 assez grandes (${Math.round(t.width)}×${Math.round(t.height)} px)`
    );
    await page.evaluate(() => {
      const N = window.__numero;
      for (let i = 0; i < 30 && N.state.screen === 'game'; i++) {
        N.state.modal = null;
        N.guess(N.state.secret);
        N.nextTurn();
      }
    });
    await page.waitForTimeout(300);
    await noOverflow(page, `Victoire ${vp.tag}px`);
    await shot(page, pre + '09_victoire');
    console.log(`${failed === before ? '✓' : '✗'} Affichage ${vp.width}×${vp.height}`);
    await ctx.close();
  }

  // V9.16 : séries « premier à 2 / 3 » (même téléphone) : victoires comptées, manche suivante, nouvelle série
  {
    const { ctx, page } = await fresh(browser);
    const r = await page.evaluate(() => {
      const N = window.__numero,
        out = [];
      Object.assign(N.state, {
        players: 2,
        names: ['Zied', 'Ahlem', '', ''],
        gameMode: 'race',
        level: 'junior',
        seriesPref: 2
      });
      N.start(true);
      const win = who => {
        N.state.modal = null;
        N.state.starter = who;
        N.state.turn = 0;
        N.guess(N.state.secret);
        N.nextTurn();
      };
      win(1);
      out.push(N.state.series.wins.join() + '/' + N.state.series.done);
      document.getElementById('again').click();
      out.push('round' + N.state.series.round + '/' + N.state.screen);
      win(0);
      out.push(N.state.series.wins.join() + '/' + N.state.series.done);
      document.getElementById('again').click();
      win(0);
      out.push(N.state.series.wins.join() + '/' + N.state.series.done);
      out.push(document.getElementById('again').textContent.trim());
      out.push(document.querySelector('.end-hero h1').textContent.trim());
      // le même gameId ne compte qu'une fois (rendu, sauvegarde, rechargement)
      N.render();
      out.push(N.state.series.wins.join());
      document.getElementById('again').click();
      out.push(N.state.series.wins.join() + '/round' + N.state.series.round);
      // Points sans aucune capture : manche nulle
      Object.assign(N.state, { gameMode: 'score' });
      N.state.seriesPref = 3;
      N.start(true);
      N.state.turn = N.state.limit;
      N.state.modal = null;
      N.guess(N.state.secret === 1 ? 2 : 1);
      N.nextTurn();
      out.push('nul:' + N.state.series.wins.join() + '/' + N.state.screen);
      // une seule partie : pas de série
      N.state.seriesPref = 0;
      N.start(true);
      out.push(String(N.state.series));
      return out;
    });
    check(r[0] === '0,1/false', `Série : 1re manche gagnée par Ahlem (${r[0]})`);
    check(
      r[1] === 'round2/game' && r[2] === '1,1/false',
      `Série : « Manche suivante » garde le score (${r[1]} ${r[2]})`
    );
    check(
      r[3] === '2,1/true' && r[4] === 'Nouvelle série' && /Zied remporte la série/.test(r[5]),
      `Série gagnée par Zied 2–1, titre et bouton « Nouvelle série » (${r[3]} · ${r[4]} · ${r[5]})`
    );
    check(
      r[6] === '2,1' && r[7] === '0,0/round1',
      `Série : comptée une seule fois, puis « Nouvelle série » repart de 0 (${r[6]} ${r[7]})`
    );
    check(
      r[8] === 'nul:0,0/end' && r[9] === 'null',
      `Série : manche sans capture = nulle ; « 1 partie » = pas de série (${r[8]} ${r[9]})`
    );
    await page.reload();
    const kept = await page.evaluate(() => JSON.stringify(window.__numero.state.series));
    check(kept === 'null', 'Série : sauvegarde relue sans erreur');
    await ctx.close();
  }

  // V9.17 : statistiques à plusieurs (clé à part) et « Pendant ton absence »
  {
    const { ctx, page } = await fresh(browser);
    const r = await page.evaluate(() => {
      const N = window.__numero;
      localStorage.removeItem('numeroEnFuiteVersusV1');
      Object.assign(N.state, {
        names: ['Zied', 'Ahlem', 'Sami', ''],
        gameMode: 'race',
        level: 'junior',
        seriesPref: 0
      });
      for (const [n, w] of [
        [2, 0],
        [2, 0],
        [2, 1],
        [3, 2]
      ]) {
        N.state.players = n;
        N.start(true);
        N.state.modal = null;
        N.state.starter = w;
        N.state.turn = 0;
        N.guess(N.state.secret);
        N.nextTurn();
        N.render();
      }
      const d = JSON.parse(localStorage.getItem('numeroEnFuiteVersusV1'));
      // 3 joueurs : Zied pose une question puis rate ; Ahlem rate ; au tour de Sami, l'encart résume
      N.state.players = 3;
      N.start(true);
      N.state.modal = null;
      N.state.starter = 0;
      N.state.turn = 0;
      N.ask(N.state.choices[0]);
      N.nextTurn();
      N.guess(N.state.secret === 1 ? 2 : 1);
      N.nextTurn();
      N.state.modal = null;
      N.guess(N.state.secret === 1 ? 2 : 1);
      N.nextTurn();
      N.render();
      const away = document.querySelector('.away-news');
      return {
        d,
        keys: ['numeroEnFuiteV6', 'numeroEnFuiteCareerV1', 'numeroEnFuiteRecords'].map(
          k => typeof localStorage.getItem(k)
        ),
        away: away ? away.textContent : '',
        modal: N.state.modal
      };
    });
    const z = r.d.players.Zied,
      pr = r.d.pairs['Ahlem|Zied'];
    check(
      z.games === 4 &&
        z.wins === 2 &&
        z.best === 2 &&
        z.streak === 0 &&
        r.d.players.Sami.wins === 1 &&
        pr.games === 4 &&
        pr.w.Zied === 2 &&
        pr.w.Ahlem === 1,
      `Statistiques à plusieurs : victoires, série, face-à-face (${JSON.stringify(z)} ${JSON.stringify(pr)})`
    );
    check(
      !r.d.players[''] && !Object.keys(r.d.players).some(n => /Joueur/.test(n)),
      'Statistiques : seulement les prénoms saisis'
    );
    check(
      r.modal === 'handoff' &&
        /Pendant ton absence/.test(r.away) &&
        /Zied/.test(r.away) &&
        /Ahlem/.test(r.away),
      `« Pendant ton absence » au passage du téléphone (${r.away.slice(0, 80)})`
    );
    await page.evaluate(() => {
      const N = window.__numero;
      Object.assign(N.state, { screen: 'office', officeTab: 'versus', modal: null, inGame: false });
      N.render();
    });
    check(
      (await page.textContent('.vs-table')).includes('Zied') &&
        (await page.textContent('.vs-duels')).includes('1 – 2'),
      'Mon bureau : tableau « À plusieurs » et face-à-face'
    );
    await ctx.close();
  }

  // V9.18 : carte de victoire (dessinée par le jeu) et partage par l'application Android
  {
    const { ctx, page } = await fresh(browser);
    await page.evaluate(() => {
      window.NumeroShare = {
        shareImage: (b64, txt) => (window.__shared = { len: b64.length, txt, head: b64.slice(0, 12) })
      };
      const N = window.__numero;
      Object.assign(N.state, {
        players: 2,
        names: ['Zied', 'Ahlem', '', ''],
        gameMode: 'race',
        level: 'junior',
        seriesPref: 0,
        reduceMotion: true
      });
      N.start(true);
      N.state.modal = null;
      N.state.starter = 0;
      N.state.turn = 0;
      N.guess(N.state.secret);
      N.nextTurn();
    });
    check(await page.isVisible('#shareWin'), 'Victoire : bouton « Partager » (Rejouer | Partager | Accueil)');
    const row = await page.$$eval('.ec-actions > *', els =>
      els.map(e => Math.round(e.getBoundingClientRect().top))
    );
    check(
      new Set(row).size === 1 || Math.max(...row) - Math.min(...row) < 20,
      `Victoire : les 3 boutons sur une ligne (${row})`
    );
    await page.click('#shareWin');
    await page.waitForFunction(() => window.__shared, null, { timeout: 8000 }).catch(() => {});
    const sh = await page.evaluate(() => window.__shared || null);
    check(
      sh && sh.len > 20000 && sh.head.startsWith('iVBOR') && /github\.com\/ziedzayani/.test(sh.txt),
      `Partage : image PNG et lien de téléchargement envoyés à Android (${sh ? sh.len : 0} caractères)`
    );
    const dims = await page.evaluate(async () => {
      const c = await window.__numero.drawVictoryCard();
      return c.width + 'x' + c.height;
    });
    check(dims === '1080x1350', `Carte de victoire 1080×1350 (${dims})`);
    // pas de bouton Partager quand personne n'a trouvé le numéro
    await page.evaluate(() => {
      const N = window.__numero;
      Object.assign(N.state, { gameMode: 'score' });
      N.start(true);
      N.state.turn = N.state.limit;
      N.state.modal = null;
      N.guess(N.state.secret === 1 ? 2 : 1);
      N.nextTurn();
    });
    check(!(await page.$('#shareWin')), 'Pas de « Partager » quand personne n’a attrapé le numéro');
    await ctx.close();
  }

  // V9.20 : Duel express — 3 téléphones simulés, choix secrets, révélation simultanée, 8 manches
  {
    const hosts = {};
    let seq = 0;
    const deliver = (pg, ev) =>
      setTimeout(() => pg.evaluate(e => window.__netEvent(JSON.stringify(e)), ev).catch(() => {}), 5);
    const hostOf = pg => Object.values(hosts).find(h => h.page === pg);
    const op = (src, o, a, d) => {
      if (o === 'hostStart') {
        hosts[a] = { page: src, peers: new Map(), code: a };
        deliver(src, { type: 'hosting', ip: '10.0.0.2', port: 4000 });
      } else if (o === 'joinStart') {
        const h = hosts[a],
          id = 'd' + ++seq;
        h.peers.set(id, src);
        src.__peer = { code: a, id };
        deliver(h.page, { type: 'peerJoined', peer: id });
        deliver(src, { type: 'connected' });
      } else if (o === 'send') {
        const h = hostOf(src);
        if (h) {
          const dst = h.peers.get(a);
          if (dst) deliver(dst, { type: 'message', peer: 'host', data: d });
        } else if (src.__peer)
          deliver(hosts[src.__peer.code].page, { type: 'message', peer: src.__peer.id, data: d });
      }
    };
    const errs = [];
    const ctxs = [];
    const phone = async () => {
      const ctx = await browser.newContext({
        locale: 'fr-FR',
        viewport: { width: 360, height: 735 },
        isMobile: true,
        hasTouch: true
      });
      ctxs.push(ctx);
      const pg = await ctx.newPage();
      pg.on('pageerror', e => errs.push(String(e)));
      await pg.exposeBinding('__fakeNet', ({ page: src }, o, a, d) => op(src, o, a, d));
      await pg.addInitScript(() => {
        window.NumeroNet = {
          hostStart: (c, n) => window.__fakeNet('hostStart', c, n),
          joinStart: c => window.__fakeNet('joinStart', c),
          send: (p, d) => window.__fakeNet('send', p, d),
          stop: () => {},
          keepAwake: () => {}
        };
      });
      await pg.goto(URL);
      await pg.evaluate(() => localStorage.clear());
      await pg.reload();
      await pg.evaluate(() => {
        const N = window.__numero;
        N.state.modal = null;
        N.state.reduceMotion = true;
        N.render();
      });
      return pg;
    };
    const w = ms => new Promise(r => setTimeout(r, ms));
    const SS = pg => pg.evaluate(() => JSON.parse(JSON.stringify(window.__numero.state)));
    const [h, a, b] = [await phone(), await phone(), await phone()];
    await h.evaluate(() => {
      const N = window.__numero;
      Object.assign(N.state, { myName: 'Zied', level: 'expert', screen: 'lan', lan: { view: 'menu' } });
      N.render();
    });
    await h.click('#netCreate');
    const code = (await h.textContent('.net-code')).trim();
    for (const [pg, n] of [
      [a, 'Ahlem'],
      [b, 'Sami']
    ]) {
      await pg.evaluate(n => {
        const N = window.__numero;
        Object.assign(N.state, { myName: n, screen: 'lan', lan: { view: 'join' } });
        N.render();
      }, n);
      await pg.fill('#netCode', code);
      await pg.click('#netJoinGo');
    }
    await w(400);
    await h.click('[data-netmode="duel"]');
    await w(150);
    check(
      (await a.textContent('.net-rules')).includes('Duel express'),
      'Duel : choisi dans la salle, affiché chez les invités'
    );
    await h.click('#netLaunch');
    await w(400);
    let hs = await SS(h),
      as = await SS(a);
    check(
      hs.screen === 'game' &&
        as.screen === 'game' &&
        as.duel &&
        as.duel.round === 1 &&
        as.duel.clue &&
        (await a.isVisible('.duel-clue')),
      'Duel : manche 1 chez tous, indice commun affiché'
    );
    const sec = await h.evaluate(() => window.__numero.state.secret);
    await a.click(`[data-dsel="${sec}"]`);
    await a.click('#duelPrecise');
    await w(250);
    const bs = await SS(b);
    hs = await SS(h);
    check(
      bs.secret === undefined &&
        Object.keys(bs.duel.picks).length === 0 &&
        bs.duel.picked.join() === '1' &&
        hs.duel.phase === 'pick',
      'Duel : le choix d’Ahlem reste secret (les autres voient seulement qu’elle a choisi)'
    );
    const far = sec > 15 ? 1 : 30;
    await b.click(`[data-dsel="${far}"]`);
    await b.click('#duelNet');
    await h.click(`[data-dsel="${sec === 1 ? 2 : 1}"]`);
    await h.click('#duelPrecise');
    await w(300);
    hs = await SS(h);
    as = await SS(a);
    check(
      hs.duel.phase === 'reveal' &&
        hs.scores.join() === '0,10,0' &&
        hs.duel.caught === sec &&
        hs.netsLeft[2] === 2 &&
        as.duel.results.length === 3,
      `Duel : révélation simultanée, +10 pour la capture précise d’Ahlem, filet de Sami consommé (${hs.scores})`
    );
    // manche sans capture : le numéro n'est pas révélé
    await h.click('#duelNext');
    await w(300);
    const s2 = await h.evaluate(() => window.__numero.state.secret);
    for (const pg of [h, a, b]) {
      await pg.click(`[data-dsel="${s2 === 1 ? 2 : 1}"]`);
      await pg.click('#duelPrecise');
    }
    await w(300);
    as = await SS(a);
    check(
      as.duel.phase === 'reveal' && as.duel.caught === null && as.secret === undefined,
      'Duel : personne ne l’a eu → le numéro n’est pas révélé'
    );
    // le chrono décide pour ceux qui ne choisissent pas
    await h.click('#duelNext');
    await w(200);
    await h.evaluate(() => {
      const N = window.__numero;
      N.state.duelElapsed = 24990;
    });
    await w(700);
    hs = await SS(h);
    check(
      hs.duel.phase === 'reveal' && hs.duel.results.every(r => r.none),
      'Duel : fin du chrono → révélation, sans choix = rien'
    );
    for (let r = hs.duel.round; r < 8; r++) {
      await h.evaluate(() => window.__numero.act('duelNext'));
      await w(100);
      await h.evaluate(() => {
        window.__numero.state.duelElapsed = 25000;
      });
      await w(400);
    }
    await h.evaluate(() => window.__numero.act('duelNext'));
    await w(400);
    [hs, as] = [await SS(h), await SS(a)];
    check(
      hs.screen === 'end' && as.screen === 'end' && /Ahlem/.test(await a.textContent('.end-hero')),
      'Duel : fin après 8 manches, Ahlem gagne chez tous'
    );
    check(!errs.length, `Duel : aucune erreur JavaScript (${errs.slice(0, 2).join(' | ')})`);
    for (const c of ctxs) await c.close();
  }

  // V9.21 : défi du jour (même départ et mêmes sauts pour tous), coup de pouce, coup décisif
  {
    const mk = async () => {
      const r = await fresh(browser);
      await r.page.evaluate(() => localStorage.clear());
      return r;
    };
    const [A, B] = [await mk(), await mk()];
    const play = (pg, k) =>
      pg.evaluate(k => {
        const N = window.__numero;
        Object.assign(N.state, { screen: 'home', modal: 'challenge' });
        N.render();
        document.getElementById('dailyGo').click();
        const out = [N.state.secret, N.state.level, N.state.players];
        for (let i = 0; i < 4; i++) {
          N.state.modal = null;
          N.ask(N.state.choices[(i + k) % 3]);
          N.nextTurn();
          out.push(N.state.secret);
          N.guess(N.state.secret === 1 ? 2 : 1);
          N.nextTurn();
          out.push(N.state.secret);
        }
        return out.join();
      }, k);
    const [ra, rb] = [await play(A.page, 0), await play(B.page, 2)];
    check(
      ra === rb && /,malin,1,/.test(ra),
      `Défi du jour : même départ et mêmes sauts sur deux téléphones (${ra})`
    );
    const fin = await A.page.evaluate(() => {
      const N = window.__numero;
      N.state.modal = null;
      N.ask(N.state.choices[0]);
      N.nextTurn();
      N.guess(N.state.secret);
      const key = (document.querySelector('.key-clue') || {}).textContent || '';
      N.nextTurn();
      return {
        key,
        banner: (document.querySelector('.daily-banner') || {}).textContent || '',
        store: JSON.parse(localStorage.getItem('numeroEnFuiteDailyV1'))
      };
    });
    const day = Object.values(fin.store)[0];
    check(
      /Coup décisif/.test(fin.key),
      `Capture : le coup décisif (dernier indice) est rappelé (${fin.key})`
    );
    check(
      /Défi du jour/.test(fin.banner) && day && day.won && day.tries === 1,
      'Défi du jour : bandeau de fin et résultat officiel enregistré'
    );
    await A.page.evaluate(() => {
      const N = window.__numero;
      Object.assign(N.state, { screen: 'home', modal: 'challenge' });
      N.render();
    });
    check(
      (await A.page.textContent('#dailyGo')).includes('5') ||
        (await A.page.textContent('#dailyGo')).includes('Fait'),
      'Défi du jour : le bouton affiche le résultat du jour'
    );
    // coup de pouce
    const nets = await B.page.evaluate(() => {
      const N = window.__numero;
      Object.assign(N.state, {
        screen: 'home',
        modal: 'names',
        players: 3,
        playerBoost: [false, false, false, false]
      });
      N.render();
      document.querySelector('[data-boost="1"]').click();
      document.getElementById('namesGo').click();
      return new Promise(r => setTimeout(() => r(N.state.netsLeft.join()), 300));
    });
    check(nets === '3,4,3', `Coup de pouce : un filet de plus pour le joueur 2 (${nets})`);
    await A.ctx.close();
    await B.ctx.close();
  }

  await browser.close();
  console.log(`\nRésultat : ${passed} vérifications réussies, ${failed} échec(s).`);
  if (failed) {
    console.log(failures.slice(0, 60).join('\n'));
    process.exit(1);
  }
})().catch(e => {
  console.error(e);
  process.exit(1);
});
