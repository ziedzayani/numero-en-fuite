/*
 * Tests automatiques du jeu « Le Numéro en fuite » (navigateur Chromium sans écran).
 * Usage :  npm ci && npx playwright install chromium   (puis : npm test)
 *          node tests/game.test.cjs [chemin/vers/index.html] [dossier/captures]
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'index.html'));
const SHOTS = process.argv[3] ? path.resolve(process.argv[3]) : null;
const URL = 'file://' + FILE;
const MAX = { junior: 9, malin: 15, expert: 30, genius: 50 };
const RANGE = { junior: 1, malin: 2, expert: 2, genius: 5 };
const LIMIT = [0, 12, 16, 18, 20];

let passed = 0, failed = 0;
const failures = [];
function check(cond, msg) {
  if (cond) passed++;
  else { failed++; failures.push(msg); if (failures.length < 40) console.log('  ✗ ' + msg); }
}
const S = page => page.evaluate(() => JSON.parse(JSON.stringify(window.__numero.state)));
/* Recalcule, indépendamment du jeu, l'ensemble exact des positions possibles à partir de l'historique :
   on essaie chaque position de départ et on rejoue questions, réponses, éliminations et déplacements. */
const EXPECTED_FN = `function(N){const s=N.state,max=N.maxN(),h=s.history;let from=0;for(let i=h.length-1;i>=0;i--)if(h[i].type==='found'||h[i].type==='netHit'){from=i+1;break}
 const res=new Set();for(let s0=1;s0<=max;s0++){let p=s0,ok=true;for(const e of h.slice(from)){
  if(e.type==='question'){if(!!N.qbyid(e.qid).test(p)!==e.answer){ok=false;break}}
  else if(e.type==='math'&&e.correct){if((p>e.math.threshold)!==e.answer){ok=false;break}}
  else if(e.type==='wrong'){if(p===e.n){ok=false;break}}
  else if(e.type==='netMiss'){if(e.nums.includes(p)){ok=false;break}}
  const W=n=>((n-1)%max+max)%max+1;const m=e.shift;p=typeof m==='number'?W(p+m):m.op==='+'?W(p+m.k):m.op==='×'?W(p*m.k):m.op==='÷'?Math.ceil(p/m.k):max+1-p}
 if(ok)res.add(p)}return [...res].sort((a,b)=>a-b)}`;
const notebookOK = page => page.evaluate(src => { const f = eval('(' + src + ')'), N = window.__numero, exp = f(N), got = [...N.state.candidates].sort((a, b) => a - b); return { ok: exp.join() === got.join() && got.includes(N.state.secret), exp: exp.join(), got: got.join() }; }, EXPECTED_FN);

async function fresh(browser, viewport = { width: 360, height: 740 }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') page.errors.push(m.text()); });
  page.on('dialog', d => { page.errors.push('dialogue natif inattendu : ' + d.message()); d.dismiss(); });
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.evaluate(() => { window.__numero.state.replayAsk = false; });
  return { ctx, page };
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
  await page.evaluate(() => { window.__numero.state.reduceMotion = true; });
  if (lang !== 'fr') { await page.click('#openSettings'); await page.click(`[data-language="${lang}"]`); await page.click('#closeSettings'); }
  await page.click(`[data-players="${players}"]`);
  await page.click(`[data-level="${level}"]`);
  await page.click('#start');
  const NAMES = ['Léa', 'Omar', 'Zoé & Co', 'Nour'];
  if (players === 1) { check(await page.isVisible('[data-phelp="0"]') && !(await page.$('#name0')) && !(await page.$('[data-gmode]')), `${label} : solo — fenêtre « Prêt ? » avec l’aide (désactivée)`); await page.click('#namesGo'); await page.waitForFunction(() => window.__numero.state.screen === 'game'); }
  if (players > 1) {
    check(await page.isVisible('#name0'), `${label} : saisie des prénoms`);
    for (let i = 0; i < players; i++) await page.fill('#name' + i, i === 1 ? '' : NAMES[i]);
    await page.click('[data-phelp="0"]'); await page.click('[data-phelp="0"]');
    check(await page.inputValue('#name0') === 'Léa', `${label} : les prénoms restent saisis quand on touche l’aide`);
    check((await S(page)).gameMode === 'race', `${label} : mode Course proposé par défaut`);
    await page.click('[data-gmode="score"]');
    await page.click('#namesGo'); await page.waitForFunction(() => window.__numero.state.screen === 'game');
  }
  let st = await S(page);
  const max = MAX[level];
  if (players > 1) {
    const chips = await page.$$eval('.chip .cname', els => els.map(e => e.textContent.trim()));
    check(chips[0] === 'Léa' && /2/.test(chips[1]) && (players < 3 || chips[2] === 'Zoé & Co'), `${label} : prénoms affichés (${chips.join(' / ')})`);
  }
  check(st.screen === 'game' && st.limit === LIMIT[players], `${label} : partie lancée avec ${LIMIT[players]} tours`);
  check(st.secret >= 1 && st.secret <= max, `${label} : numéro secret dans 1..${max}`);
  const seenQuestions = [];
  let clueCount = 0, mathCount = 0, guessCount = 0, finds = 0;

  for (let turn = 0; turn < st.limit; turn++) {
    st = await S(page);
    if (players > 1) {
      if (turn === 0) check(!st.modal, `${label} : après les prénoms, la partie démarre tout de suite (pas d’écran sombre)`);
      else check(st.modal === 'handoff', `${label} t${turn} : écran « passe le téléphone » affiché`);
      if (st.modal === 'handoff') await page.click('#handoffGo');
    }
    st = await S(page);
    const player = turn % players;
    check(st.turn === turn && st.phase === 'choose', `${label} t${turn} : début de tour cohérent`);
    check(st.choices.length === 3 && new Set(st.choices).size === 3, `${label} t${turn} : 3 questions différentes proposées`);
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
        const nOpt = ['expert', 'genius'].includes(level) ? 6 : 3; check(st.math.options.includes(st.math.result) && new Set(st.math.options).size === nOpt && await page.$$eval('[data-math]', e => e.length) === nOpt, `${label} t${turn} : calcul avec ${nOpt} réponses dont la bonne`);
        await page.click(`[data-math="${opt}"]`);
        mathCount++;
        const after = await S(page);
        check(after.stars[player] === starsBefore[player] + (answerRight ? 1 : 0), `${label} t${turn} : étoile ${answerRight ? 'gagnée' : 'non gagnée'}`);
        check(after.scores.join() === scoresBefore.join(), `${label} t${turn} : le calcul ne change pas les points`);
      }
      let r = await S(page);
      const shift = r.last.shift;
      const okMove = level === 'genius' ? (typeof shift === 'object' && shift !== null) : (Math.abs(shift) <= RANGE[level] && shift !== 0);
      check(r.phase === 'result' && okMove, `${label} t${turn} : déplacement annoncé ${JSON.stringify(shift)}, jamais 0`);
      check(await page.evaluate(({ b, sh }) => window.__numero.moveFn(sh)(b), { b: secretBefore, sh: shift }) === r.secret, `${label} t${turn} : déplacement appliqué correctement (bouclage)`);
      check(await page.isVisible('#next'), `${label} t${turn} : bouton « Choisir mon numéro » visible`);
      const nb0 = await notebookOK(page);
      check(nb0.ok, `${label} t${turn} : carnet exact après indice/calcul et déplacement (attendu ${nb0.exp} / carnet ${nb0.got})`);
      await page.click('#next');
      r = await S(page);
      check(r.phase === 'choose' && r.turn === turn && r.helpUsed && r.tab === 'guess', `${label} t${turn} : APRÈS L'AIDE, le même joueur doit tenter un numéro`);
      check(await page.isDisabled('[data-tab="question"]') && await page.isDisabled('[data-tab="math"]'), `${label} t${turn} : 2e aide impossible`);
      check(r.scores.join() === scoresBefore.join(), `${label} t${turn} : tour conservé sans pénalité`);
      // tenter directement nextTurn sans deviner ne doit rien faire
      await page.evaluate(() => window.__numero.nextTurn());
      check((await S(page)).turn === turn, `${label} t${turn} : impossible de finir le tour sans tenter un numéro`);
    }
    st = await S(page);
    check(st.candidates.includes(st.secret), `${label} t${turn} : le secret reste parmi les pistes possibles`);
    // Alterne capture précise / filet magique, réussies ou ratées
    const wantRight = turn % 4 === 1 || turn % 4 === 2;
    const mode = players === 1 || turn % 2 === 0 || !(st.netsLeft[player] > 0) ? 'precise' : 'net';
    const n = await page.evaluate(({ right, mode }) => { const N = window.__numero, s = N.state, max = N.maxN();
      if (right) return s.secret;
      for (let k = 1; k <= max; k++) { const c = ((s.secret - 1 + k * 3) % max) + 1; if (mode === 'precise' ? c !== s.secret : !N.netRange(c).includes(s.secret)) return c; } return null; }, { right: wantRight, mode });
    if (st.tab !== 'guess') await page.click('[data-tab="guess"]');
    check(await page.isDisabled('#capPrecise') && await page.isDisabled('#capNet'), `${label} t${turn} : les 2 boutons de capture attendent un numéro`);
    if (max > 30) { await page.click('[data-key="clr"]'); for (const ch of String(n)) await page.click(`[data-key="${ch}"]`); } else await page.click(`[data-guess="${n}"]`);
    const inNet = max > 30 ? await page.evaluate(n => window.__numero.netRange(n), n) : await page.$$eval('.numtile.in-net', els => els.map(e => Number(e.textContent)));
    const expNet = await page.evaluate(n => window.__numero.netRange(n), n);
    if (players > 1 && st.netsLeft[player] > 0) check(inNet.join() === expNet.join() && expNet.length === (level === 'junior' ? 2 : 3) && expNet.every(v => v >= 1 && v <= max), `${label} t${turn} : filet de ${expNet.length} numéros dans les limites (${expNet.join('·')})`);
    await page.click(mode === 'precise' ? '#capPrecise' : '#capNet');
    await page.waitForFunction(() => window.__numero.state.phase === 'result', null, { timeout: 3000 });
    guessCount++;
    const g = await S(page);
    const delta = g.scores[player] - st.scores[player];
    const expDelta = wantRight ? (mode === 'precise' ? 10 : 4) + (action === 0 ? 1 : 0) : (mode === 'precise' ? -1 : -(level === 'junior' ? 2 : 3));
    check(delta === expDelta, `${label} t${turn} : ${mode} ${wantRight ? 'réussie' : 'ratée'} → ${expDelta > 0 ? '+' : ''}${expDelta} (obtenu ${delta})`);
    check(g.last.type === (mode === 'precise' ? (wantRight ? 'found' : 'wrong') : (wantRight ? 'netHit' : 'netMiss')), `${label} t${turn} : type de capture enregistré`);
    if (wantRight) finds++;
    const nb = await notebookOK(page);
    check(nb.ok, `${label} t${turn} : carnet exact après la capture (attendu ${nb.exp} / carnet ${nb.got})`);
    if (players === 1 && wantRight) { const D = await page.evaluate(l => window.__numero.dictionaries[l], lang); check((await page.textContent('#next')).includes(D.soloSeeWin), `${label} t${turn} : solo, numéro attrapé → « ${D.soloSeeWin} »`); await page.click('#next'); break; }
    if (turn + 1 < st.limit) { const D = await page.evaluate(l => window.__numero.dictionaries[l], lang); const want = players === 1 ? D.nextTurn : D.nextPlayer; check((await page.textContent('#next')).includes(want), `${label} t${turn} : bouton « ${want} »`); }
    check(g.secret >= 1 && g.secret <= max, `${label} t${turn} : secret toujours valide`);
    await page.click('#next');
  }
  st = await S(page);
  check(st.screen === 'end', `${label} : écran de victoire atteint`);
  if (players === 1) check(st.soloWon === true && st.turn === 1 && !(await page.textContent('.hero h1')).includes('😅'), `${label} : solo gagné dès la 1re capture réussie (tour 2)`);
  check(st.captures === finds, `${label} : ${finds} captures comptées`);
  const endText = await page.textContent('#app');
  check(!/\{\w+\}/.test(endText), `${label} : aucun texte non traduit sur l'écran final`);
  check(await page.isVisible('#again') && await page.isVisible('#menu'), `${label} : boutons Rejouer / Accueil`);
  const shown = await page.$$eval('.finalscore .value', els => els.map(e => parseInt(e.textContent)));
  const totals = st.scores.map((v, i) => v + st.stars[i]).sort((a, b) => b - a);
  if (players > 1) check(shown.join() === totals.join(), `${label} : classement final = points + étoiles (${shown.join(', ')})`);
  else check(await page.$$eval('.solo-stars span.on', e => e.length) === 3 && (await page.textContent('.solo-stats')).includes('2') && !(await page.$('.finalscore')), `${label} : écran solo — 3 étoiles (trouvé en 2 tours), compteurs, pas de « classement »`);
  const unique = new Set(seenQuestions).size;
  check(unique >= Math.min(seenQuestions.length, 12) * 0.7, `${label} : questions variées (${unique} différentes sur ${seenQuestions.length})`);
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
      const d = window.__numero.dictionaries, out = [];
      for (const k of Object.keys(d.fr)) for (const l of ['en', 'ar']) if (!(k in d[l])) out.push(l + ':' + k);
      return out;
    });
    check(miss.length === 0, 'Traductions EN/AR complètes ' + miss.join(','));
    await ctx.close();
  }

  // 1) Parties complètes : 1 à 4 joueurs × 3 niveaux
  for (const players of [1, 2, 3, 4]) for (const level of ['junior', 'malin', 'expert', ...(players % 2 ? ['genius'] : [])]) {
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
    const res = await page.evaluate(({ MAX, RANGE, SRC }) => {
      const EXP = eval('(' + SRC + ')');
      const N = window.__numero, errors = []; let informative = 0, total = 0;
      for (const level of ['junior', 'malin', 'expert', 'genius']) for (let rep = 0; rep < 120; rep++) {
        const st = N.state; st.players = 1 + (rep % 4); st.gameMode = 'score'; st.level = level; N.start(); if (N.state.modal) N.state.modal = null;
        for (let i = 0; i < 40 && N.state.screen === 'game'; i++) {
          const s = N.state, max = MAX[level];
          if (!s.candidates.includes(s.secret)) errors.push('secret hors pistes ' + level);
          const qs = s.choices.map(N.qbyid);
          if (qs.some(q => !q)) errors.push('question introuvable');
          if (s.candidates.length > 1) for (const q of qs) { total++; if (s.candidates.some(n => q.test(n)) && s.candidates.some(n => !q.test(n))) informative++; }
          if (/\{\w+\}/.test(qs.map(q => q.text).join())) errors.push('question non remplie');
          const r = Math.random();
          if (r < .4) N.ask(s.choices[0]);
          else if (r < .7) { N.mathAnswer(Math.random() < .7 ? s.math.result : s.math.options[0]); }
          if (N.state.phase === 'result') { const sh = N.state.last.shift; if (level === 'genius' ? typeof sh !== 'object' : (Math.abs(sh) > RANGE[level] || sh === 0)) errors.push('déplacement invalide ' + JSON.stringify(sh)); N.nextTurn(); }
          if (N.state.phase !== 'choose') errors.push('phase inattendue après aide');{const e=EXP(N);if(e.join()!==[...N.state.candidates].sort((a,b)=>a-b).join())errors.push('carnet faux après aide '+level)}
          const c = N.state.candidates; const pickN = c[Math.floor(Math.random() * c.length)]; if (N.state.players === 1 || N.netsLeft() === 0 || Math.random() < .5) N.guess(Math.random() < .3 ? 1 + Math.floor(Math.random() * max) : pickN); else N.netCapture(1 + Math.floor(Math.random() * max)); if (N.state.last && N.state.last.type === 'netMiss' && N.state.last.nums.length !== N.netSize()) errors.push('taille de filet');
          if (N.state.phase !== 'result') errors.push('tentative refusée');
          {const e=EXP(N);if(e.join()!==[...N.state.candidates].sort((a,b)=>a-b).join())errors.push('carnet faux après capture '+level)}
          N.nextTurn(); if (N.state.modal) N.state.modal = null;
        }
      }
      return { errors: [...new Set(errors)], informative, total };
    }, { MAX, RANGE, SRC: EXPECTED_FN });
    check(res.errors.length === 0, 'Simulation de 450 parties (carnet vérifié à chaque étape) sans incohérence : ' + res.errors.join(', '));
    check(res.informative / res.total > 0.9, `Questions utiles (qui départagent les pistes) : ${Math.round(100 * res.informative / res.total)} %`);
    console.log(`${failed === before ? '✓' : '✗'} Simulation logique (450 parties) — questions utiles : ${Math.round(100 * res.informative / res.total)} %`);
    await ctx.close();
  }

  // 3) Changement de langue en cours de partie, sauvegarde, reprise, bouton Retour
  {
    const before = failed;
    const { ctx, page } = await fresh(browser);
    await page.click('[data-players="2"]'); await page.click('[data-level="malin"]'); await page.click('#start');
    await page.click('#namesGo'); await page.waitForFunction(() => window.__numero.state.screen === 'game');
    let st = await S(page);
    await page.click(`[data-question="${st.choices[0]}"]`);
    const mid = await S(page);
    await page.click('#pause'); await page.click('#pauseSettings');
    await page.click('[data-language="ar"]');
    check(await page.evaluate(() => document.documentElement.dir) === 'rtl', 'Arabe : affichage de droite à gauche');
    await shot(page, '07_reglages_arabe');
    await page.click('#closeSettings'); await page.waitForTimeout(450);
    check((await S(page)).modal === 'pause', 'Retour des réglages : la partie reste en pause');
    await page.click('#resumeGame');
    let now = await S(page);
    check(now.screen === 'game' && now.phase === 'result' && now.turn === mid.turn && now.secret === mid.secret, 'Changement de langue sans interrompre la partie');
    await shot(page, '08_resultat_arabe');
    await noOverflow(page, 'Résultat en arabe');
    await page.reload();
    now = await S(page);
    check(now.screen === 'game' && now.phase === 'result' && now.lang === 'ar' && now.secret === mid.secret, 'Sauvegarde : la partie reprend après fermeture/réouverture');
    await page.click('#next');
    check((await S(page)).tab === 'guess', 'Après rechargement : le joueur doit toujours tenter un numéro');
    // Bouton Retour Android
    let handled = await page.evaluate(() => window.__numero.back());
    check(handled && (await S(page)).modal === 'pause', 'Retour en partie : met le jeu en pause (fenêtre du jeu, pas de boîte native)');
    await page.click('#resumeGame');
    check((await S(page)).screen === 'game' && !(await S(page)).modal, 'Pause → Reprendre : on revient dans la partie');
    await page.click('#openNotebook'); check(await page.isVisible('.modal .history-items'), 'Carnet d’indices dans une fenêtre'); await page.click('#closeModal');
    await page.click('#pause'); await page.click('#askQuit');
    check((await S(page)).modal === 'quit', 'Quitter : confirmation demandée');
    await page.click('#quitNo');
    check((await S(page)).modal === 'pause' && (await S(page)).screen === 'game', 'Quitter → Non : retour au menu Pause');
    await page.click('#askQuit'); await page.click('#quitYes');
    now = await S(page);
    check(now.screen === 'home' && !now.inGame && !(await page.$('#resume')), 'Quitter : la partie est terminée (pas de « Reprendre »)');
    await page.click('[data-level="junior"]');
    check(!(await page.$('#resume')), 'Changer de niveau après avoir quitté : aucune ancienne partie proposée');
    handled = await page.evaluate(() => window.__numero.back());
    check(handled === false, 'Retour sur l’accueil : l’application peut se fermer');
    check(page.errors.length === 0, 'Aucune erreur JavaScript (langue/sauvegarde) ' + page.errors.join(' | '));
    console.log(`${failed === before ? '✓' : '✗'} Langue en cours de partie, sauvegarde, reprise, bouton Retour`);
    await ctx.close();
  }

  // 3b) Chronos : global (tour) + réponse, visibles dès le début du tour ; pause ; calculs
  {
    const before = failed;
    const { ctx, page } = await fresh(browser);
    const kinds = () => page.$$eval('[data-tk]', els => els.map(e => e.dataset.tk).join());
    const txt = k => page.textContent(`[data-tk="${k}"] b`);
    const ages = await page.$$eval('.level .age', els => els.map(e => e.textContent));
    check(ages.length === 4 && ages[0].includes('5') && ages[2].includes('11') && ages[3].includes('13'), 'Âges affichés sur les 4 niveaux : ' + ages.join(' / '));
    for (const [level, ans, mathS, glob] of [['junior', 25, 30, 75], ['malin', 20, 30, 70], ['expert', 20, 45, 90]]) {
      await page.evaluate(lv => { const N = window.__numero; N.state.players = 2; N.state.level = lv; N.state.timerMode = 'normal'; N.start(); }, level);
      await page.click('#handoffGo');
      check(await kinds() === 'global,answer' && (await txt('global')).includes(String(glob)) && (await txt('answer')).includes(String(ans)), `${level} : dès le début du tour, chrono global ${glob} s + chrono de réponse ${ans} s`);
      await page.waitForTimeout(1200);
      let st = await S(page);
      check(st.turnElapsed >= 800 && st.answerElapsed >= 800, `${level} : les deux chronos avancent`);
      await page.click('#pause'); const p0 = await S(page); await page.waitForTimeout(800); const p1 = await S(page);
      check(p1.turnElapsed === p0.turnElapsed && p1.answerElapsed === p0.answerElapsed, `${level} : PAUSE arrête les chronos`);
      await page.click('#resumeGame');
      await page.click('[data-tab="math"]');
      check(await kinds() === 'global,math' && (await txt('math')).includes(String(mathS)), `${level} : calcul → chrono global + chrono calcul ${mathS} s`);
      check(await page.isDisabled('[data-tab="question"]'), `${level} : pendant le calcul, pas d’indice en plus`);
      const st0 = await S(page);
      await page.evaluate(() => { const s = window.__numero.state; s.mathElapsed += window.__numero.mathLeft() - 150; });
      await page.waitForTimeout(700);
      st = await S(page);
      check(st.phase === 'result' && st.last.timeout === true && st.stars[0] === st0.stars[0] && st.scores[0] === st0.scores[0], `${level} : calcul hors temps → pas d’étoile, pas de pénalité`);
      check(!(await page.$('[data-tk]')), `${level} : chronos arrêtés pendant l’écran de résultat`);
      const g1 = st.turnElapsed; await page.waitForTimeout(500);
      check((await S(page)).turnElapsed === g1, `${level} : le chrono global ne tourne pas pendant le résultat`);
      await page.click('#next');
      st = await S(page);
      check(st.phase === 'choose' && st.tab === 'guess' && await kinds() === 'global' && st.turnElapsed >= g1, `${level} : après le calcul, le chrono global continue (réponse + choix du numéro)`);
      await page.evaluate(() => { const s = window.__numero.state; s.turnElapsed += window.__numero.turnLeft() - 150; });
      await page.waitForTimeout(700);
      st = await S(page);
      check(st.phase === 'result' && st.last.type === 'timeout' && st.scores.join() === st0.scores.join(), `${level} : chrono global écoulé → tour perdu (0 point)`);
      await page.click('#next');
      st = await S(page);
      check(st.turn === st0.turn + 1 && st.modal === 'handoff', `${level} : le tour passe au joueur suivant`);
      // Chrono de réponse écoulé pendant la question
      await page.click('#handoffGo');
      await page.evaluate(() => { const s = window.__numero.state; s.answerElapsed += window.__numero.answerLeft() - 150; });
      await page.waitForTimeout(700);
      st = await S(page);
      check(st.phase === 'choose' && st.helpUsed && st.tab === 'guess' && (await page.textContent('.pick-hint')).includes('⏱'), `${level} : temps de réponse écoulé → plus d’aide, il faut choisir un numéro`);
      // Difficulté des calculs
      const ok = await page.evaluate(lv => { const N = window.__numero, out = []; for (let i = 0; i < 300; i++) { N.state.level = lv; N.state.screen = 'game'; N.state.phase = 'choose'; N.start(); const m = N.state.math; const txt = m.text; const val = Function('return ' + txt.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-'))(); if (val !== m.result || m.options.length !== (lv === 'expert' ? 6 : 3) || new Set(m.options).size !== m.options.length || m.options.some(o => o < 0) || !m.options.includes(m.result)) out.push(txt); if (lv === 'malin' && /^\d \+ \d$|^1\d \+ \d$/.test(txt)) out.push('trop facile ' + txt); if (lv === 'expert' && (txt.match(/[+−×÷]/g) || []).length < 2) out.push('pas assez mélangé ' + txt); } return out; }, level);
      check(ok.length === 0, `${level} : 300 calculs justes et adaptés ${ok.slice(0, 3).join(', ')}`);
    }
    await page.evaluate(() => { const N = window.__numero; N.state.level = 'junior'; N.state.players = 1; N.state.inGame = false; N.state.screen = 'home'; N.state.modal = null; N.render(); });
    await page.click('#openSettings'); await page.click('[data-timer="long"]'); await page.click('#closeSettings');
    await page.click('#start'); await page.click('#namesGo'); await page.waitForFunction(() => window.__numero.state.screen === 'game');
    check((await txt('global')).includes('113') && (await txt('answer')).includes('38'), 'Réglage « Plus de temps » : ×1,5 (Petit : 113 s / 38 s)');
    await page.evaluate(() => { const N = window.__numero; N.state.screen = 'home'; N.render(); });
    await page.click('#openSettings'); await page.click('[data-timer="off"]'); await page.click('#closeSettings');
    await page.click('#start'); await page.click('#namesGo'); await page.waitForFunction(() => window.__numero.state.screen === 'game'); await page.waitForTimeout(400);
    check(!(await page.$('[data-tk]')), 'Réglage « Sans chrono » : aucun compte à rebours');
    check(page.errors.length === 0, 'Aucune erreur JavaScript (chronos) ' + page.errors.join(' | '));
    console.log(`${failed === before ? '✓' : '✗'} Chronos global + réponse (visibles dès le début), pause, difficulté des calculs`);
    await ctx.close();
  }

  // 3e) Défi solo (1–100, sauts fous, contre la montre ou sans limite)
  {
    const before = failed;
    const { ctx, page } = await fresh(browser);
    await page.evaluate(() => { window.__numero.state.reduceMotion = true; });
    await page.click('[data-players="3"]'); await page.click('[data-level="malin"]');
    await page.click('#openChallenge');
    check(await page.isVisible('#chTimed') && await page.isVisible('#chEndless'), 'Défi : choix « contre la montre » ou « sans limite »');
    await page.click('#chEndless');
    let st = await S(page);
    check(st.mode === 'challenge' && st.players === 1 && st.limit === 0 && st.secret >= 1 && st.secret <= 100 && st.candidates.length === 100, 'Défi : solo, numéros 1 à 100, sans limite de tours');
    check(await page.isVisible('[data-tk="chUp"]') && !(await page.$('[data-tk="global"]')), 'Défi sans limite : temps écoulé affiché, pas de compte à rebours');
    // pavé numérique
    await page.click('[data-tab="guess"]');
    for (const k of ['4', '7']) await page.click(`[data-key="${k}"]`);
    st = await S(page);
    check(st.sel === 47 && (await page.textContent('.kp-display')).includes('47') && (await page.textContent('#capNet')).includes('46·47·48'), 'Pavé numérique : 47 tapé, filet 46·47·48');
    await page.click('[data-key="del"]'); await page.click('[data-key="clr"]');
    for (const k of ['1', '0', '0']) await page.click(`[data-key="${k}"]`);
    check((await S(page)).sel === 100 && (await page.textContent('#capNet')).includes('98·99·100'), 'Pavé : 100, filet sans dépasser 100 (98·99·100)');
    // sauts fous + carnet exact sur de nombreux tours
    const sim = await page.evaluate(src => { const EXP = eval('(' + src + ')'), N = window.__numero, errs = [], ops = new Set();
      for (let game = 0; game < 40; game++) { N.startChallenge('endless');
        for (let i = 0; i < 25 && N.state.screen === 'game'; i++) { const s = N.state;
          const rr = Math.random(); if (rr < .35) N.ask(s.choices[0]); else if (rr < .7) N.mathAnswer(Math.random() < .6 ? s.math.result : s.math.options[0]); if (N.state.phase === 'result') { const m = N.state.last.shift; if (N.state.last.frozen ? m !== 0 : typeof m !== 'object') errs.push('mouvement incohérent en défi'); else if (!N.state.last.frozen) ops.add(m.op === '+' ? (m.k > 0 ? '+' : '−') : m.op); N.nextTurn(); }
          const e1 = EXP(N); if (e1.join() !== [...N.state.candidates].sort((a, b) => a - b).join()) errs.push('carnet faux (aide)');
          const c = N.state.candidates; const n = c[Math.floor(Math.random() * c.length)];
          if (Math.random() < .5) N.guess(Math.random() < .2 ? n : 1 + Math.floor(Math.random() * 100)); else N.netCapture(1 + Math.floor(Math.random() * 100));
          if (N.state.screen === 'game' && N.state.phase === 'result' && !['found', 'netHit'].includes(N.state.last.type)) { const e2 = EXP(N); if (e2.join() !== [...N.state.candidates].sort((a, b) => a - b).join()) errs.push('carnet faux (capture)'); }
          N.nextTurn(); } }
      return { errs: [...new Set(errs)], ops: [...ops].sort().join(' ') }; }, EXPECTED_FN);
    check(sim.errs.length === 0, 'Défi : 40 parties simulées, carnet exact malgré ×2, ÷2, miroir, +7… ' + sim.errs.join(', '));
    check(sim.ops.split(' ').length >= 5, 'Défi : sauts variés observés (' + sim.ops + ')');
    // Calcul juste en défi : gel, +10 (combo seulement visuel), +15 s ; faux : −10 et saut
    const mres = await page.evaluate(() => { const N = window.__numero; N.startChallenge('timed'); const s = N.state; s.chElapsed = 60000;
      const sec0 = s.secret, sc0 = N.chScore(); N.mathAnswer(s.math.result); const a = { frozen: s.last.frozen, shift: s.last.shift, same: s.secret === sec0, bonus: s.last.chBonus, d: N.chScore() - sc0, time: s.chElapsed };
      N.nextTurn(); N.guess(s.secret % 100 + 1 === s.secret ? 1 : (s.secret % 100) + 1); N.nextTurn();
      const sc1 = N.chScore(), sec1 = s.secret; N.mathAnswer(s.math.result); const b = { bonus: s.last.chBonus, streak: s.last.streak, same: s.secret === sec1, d: N.chScore() - sc1 };
      N.nextTurn(); N.guess(s.secret % 100 + 1); N.nextTurn();
      const sc2 = N.chScore(); N.mathAnswer(s.math.options.find(o => o !== s.math.result)); const c = { frozen: s.last.frozen, moved: typeof s.last.shift === 'object', d: N.chScore() - sc2, streak: s.chStreak };
      return { a, b, c }; });
    check(mres.a.frozen && mres.a.same && mres.a.shift === 0 && mres.a.bonus === 10 && mres.a.d === 10 && mres.a.time === 45000, 'Défi : calcul juste → numéro gelé 🧊, +10 points, +15 s au chrono');
    check(mres.b.bonus === 10 && mres.b.streak === 2 && mres.b.same && mres.b.d === 10, 'Défi : 2e calcul juste d’affilée → combo ×2 affiché, toujours +10 (pas de bonus croissant)');
    check(!mres.c.frozen && mres.c.moved && mres.c.d === -10 && mres.c.streak === 0, 'Défi : calcul faux → −10 et saut fou, combo remis à zéro');
    await page.evaluate(() => { const N = window.__numero; N.startChallenge('endless'); N.ask(N.state.choices[0]); N.nextTurn(); N.mathAnswer; });
    await page.click('#next').catch(() => {});
    await page.evaluate(() => { const N = window.__numero; N.startChallenge('endless'); });
    await page.click('[data-tab="math"]'); await page.click('.mathbox .info-link');
    check((await page.textContent('.mathbox .tradeoff')).includes('🧊'), 'Défi : avantages du calcul affichés (gel, +10) avec ℹ️');
    await page.click('.mathbox .tradeoff');
    check(!(await page.$('.mathbox .tradeoff')), 'Défi : un toucher referme les avantages / risques');
    await page.click(`[data-math="${(await S(page)).math.result}"]`);
    check(await page.isVisible('.ch-bonus') && await page.isVisible('.move-line.frozen'), 'Défi : résultat « 🧊 +10 points » et « Gelé »');
    const netWin = await page.evaluate(() => { localStorage.removeItem('numeroEnFuiteRecords'); const N = window.__numero; N.startChallenge('endless'); N.netCapture(N.state.secret); N.nextTurn(); return N.state.chFinal; });
    check(netWin === 950, `Défi gagné au filet : −50 (score ${netWin})`);
    await page.evaluate(() => { const N = window.__numero; N.state.screen = 'home'; N.render(); });
    await page.click('#openChallenge');
    // victoire + score + record
    await page.evaluate(() => { localStorage.removeItem('numeroEnFuiteRecords'); const N = window.__numero; N.startChallenge('endless'); N.ask(N.state.choices[0]); N.nextTurn(); N.guess(N.state.secret); });
    check((await page.textContent('#next')).includes('score'), 'Défi trouvé : bouton « Voir mon score »');
    await page.click('#next');
    st = await S(page);
    check(st.screen === 'end' && st.chWon && st.chFinal === 995 && await page.isVisible('.ch-score') && await page.isVisible('.ch-new'), `Défi réussi au 1er tour avec 1 question : score 995, nouveau record (${st.chFinal})`);
    check((await page.evaluate(() => window.__numero.records()))['endless-medium'] === 995, 'Record enregistré pour « sans limite / moyen »');
    // contre la montre : échec quand le temps est écoulé
    await page.click('#again');
    await page.evaluate(() => { const N = window.__numero; N.startChallenge('timed'); });
    check(await page.isVisible('[data-tk="challenge"]') && (await page.textContent('[data-tk="challenge"] b')).includes('3:00'), 'Contre la montre : 3:00 affiché');
    await page.evaluate(() => { window.__numero.state.chElapsed = 180000 - 150; });
    await page.waitForTimeout(700);
    st = await S(page);
    check(st.screen === 'end' && st.chWon === false && st.chFinal === 0 && (await page.textContent('.intro')).includes(String(st.chSecret)), 'Contre la montre : temps écoulé → défi perdu, le numéro est révélé');
    await page.click('#menu');
    st = await S(page);
    check(st.screen === 'home' && st.mode === 'normal' && st.players === 3 && st.level === 'malin', 'Retour à l’accueil : niveau et nombre de joueurs d’avant rétablis');
    check(page.errors.length === 0, 'Aucune erreur JavaScript (défi) ' + page.errors.join(' | '));
    console.log(`${failed === before ? '✓' : '✗'} Défi solo : 1–100, pavé, sauts fous, carnet exact, score, record, contre la montre`);
    await ctx.close();
  }

  // 3c) Captures animées, détective vivant, aide par joueur, modes Course / Points, animations réduites
  {
    const before = failed;
    const { ctx, page } = await fresh(browser);
    const fresh2 = (lv = 'junior') => page.evaluate(lv => { const N = window.__numero; N.state.players = 2; N.state.gameMode = 'score'; N.state.starter = 0; N.state.level = lv; N.state.playerHelp = [false, false, false, false]; N.start(true); }, lv);
    await fresh2();
    const cls = () => page.getAttribute('.turn-card .detective-scene', 'class');
    check(/think/.test(await cls()) && /expr-curious/.test(await cls()), 'Détective : réfléchit (onglet Indice), expression curieuse');
    check((await page.textContent('.bubble .quip')).length > 3, 'Bulle de dialogue affichée : « ' + (await page.textContent('.bubble .quip')).trim() + ' »');
    await page.click('[data-tab="guess"]');
    check(await page.$$eval('.numtile.possible', e => e.length) === 0 && !(await page.$('#hints')), 'Par défaut, aucune aide : pas de numéros en vert');
    check((await page.textContent('.pick-hint')).includes('⚡'), 'Deviner sans aide : avantage / inconvénient affichés');
    await page.click('[data-guess="9"]');
    check((await page.$$eval('.numtile.in-net', els => els.map(e => e.textContent))).join() === '8,9', 'Mode Points — filet (Petit) sur 9 → 8·9 (2 numéros, sans dépasser 9)');
    await page.click('[data-guess="1"]');
    check((await page.$$eval('.numtile.in-net', els => els.map(e => e.textContent))).join() === '1,2', 'Filet (Petit) sur 1 → 1·2');
    check(/aim/.test(await cls()), 'Détective : vise quand un numéro est choisi');
    const sec = (await S(page)).secret;
    await page.click(`[data-guess="${sec}"]`);
    await page.click('#capPrecise');
    check(await page.$$eval('.numtile.hit-precise', e => e.length) === 1 && (await S(page)).phase === 'choose', 'Animation de capture précise (cible) avant le résultat');
    await page.click('#capNet', { force: true });
    await page.waitForTimeout(1000);
    let st = await S(page);
    check(st.phase === 'result' && st.last.type === 'found' && st.scores[0] === 10, 'Une seule capture par tour : capture précise réussie +10 (le 2e bouton est ignoré)');
    check(/caught/.test(await cls()) && /expr-proud/.test(await cls()) && await page.$('.turn-card .confetti'), 'Détective : danse et fierté + confettis quand on gagne');
    check(await page.isVisible('.chip .delta.up'), 'Badge « +10 » sur le score');
    await page.click('#next');
    st = await S(page);
    check(st.screen === 'game' && st.turn === 1, 'Mode Points : après une capture, la partie continue (nouveau numéro)');
    // filet raté, animé
    await fresh2();
    const miss = await page.evaluate(() => { const N = window.__numero; for (let n = 1; n <= 9; n++) if (!N.netRange(n).includes(N.state.secret)) return n; });
    await page.click('[data-tab="guess"]'); await page.click(`[data-guess="${miss}"]`); await page.click('#capNet');
    check(await page.$$eval('.numtile.hit-net', e => e.length) === 2, 'Animation du filet sur les 2 numéros');
    await page.waitForTimeout(1000);
    st = await S(page);
    check(st.last.type === 'netMiss' && st.scores[0] === -2 && /grimace/.test(await cls()) && /expr-grimace/.test(await cls()), 'Filet vide (2 numéros) −2 : grimace du détective');
    await fresh2();
    await page.click('[data-tab="math"]');
    check(/search/.test(await cls()), 'Détective : cherche avec sa loupe (calcul)');
    // 3 filets maximum par joueur
    await fresh2('malin');
    const nets = await page.evaluate(() => { const N = window.__numero, out = []; for (let k = 0; k < 4; k++) { const s = N.state; s.turn = 0; s.phase = 'choose'; s.helpUsed = false; s.modal = null; const before = N.netsLeft(0); N.netCapture(s.secret % 15 + 1 === s.secret ? 1 : (s.secret + 7) % 15 + 1); out.push(before + '>' + N.netsLeft(0) + ':' + s.phase); } return out; });
    check(nets.join() === '3>2:result,2>1:result,1>0:result,0>0:choose', 'Filet : 3 maximum par joueur, le 4e est refusé (' + nets.join(' ') + ')');
    await page.evaluate(() => { const N = window.__numero; N.state.phase = 'choose'; N.state.last = null; N.render(); });
    await page.click('[data-tab="guess"]'); await page.click('[data-guess="5"]');
    check(await page.isDisabled('#capNet') && (await page.textContent('#capNet')).includes('Plus de filet') && (await page.textContent('#capNet .nets-left')) === '○○○' && await page.$$eval('.numtile.in-net', e => e.length) === 0, 'Filet épuisé : bouton grisé « Plus de filet » (○○○), plus d’aperçu du filet');
    check(await page.evaluate(() => window.__numero.netsLeft(1)) === 3, 'Les filets sont comptés par joueur (joueur 2 : encore 3)');
    // Aide par joueur : seulement pour le joueur qui l'a activée
    await page.evaluate(() => { const N = window.__numero; N.state.players = 2; N.state.gameMode = 'score'; N.state.starter = 0; N.state.level = 'malin'; N.state.playerHelp = [false, true, false, false]; N.start(true); });
    await page.click('[data-tab="guess"]');
    check(await page.$$eval('.numtile.possible', e => e.length) === 0, 'Aide par joueur : joueur 1 sans aide → pas de vert');
    await page.click('#openNotebook');
    check(!(await page.$('.nb-grid')) && await page.isVisible('.modal .history-items'), 'Sans aide : le carnet garde l’historique mais ne déduit rien');
    await page.click('#closeModal');
    await page.evaluate(() => { const N = window.__numero; N.guess(N.state.secret % 15 + 1); N.nextTurn(); N.state.modal = null; N.render(); });
    await page.click('[data-tab="guess"]');
    check(await page.$$eval('.numtile.possible', e => e.length) > 0 && !(await page.$('.banner.slim')), 'Aide par joueur : joueur 2 avec aide → numéros possibles en vert');
    await page.click('#openNotebook');
    check(await page.isVisible('.nb-grid') && (await page.textContent('.nb-count')).includes('15'), 'Avec aide : le carnet montre la grille des possibles');
    await page.click('#closeModal');
    // Encourager les questions : avantages/inconvénients + bonus +1
    await fresh2('malin');
    check(!(await page.$('.tradeoff')) && await page.isVisible('.q-head .info-btn'), 'Avantages / risques cachés par défaut, bouton ℹ️');
    await page.click('.q-head .info-btn');
    check(await page.isVisible('.tradeoff .up') && await page.isVisible('.tradeoff .down'), 'ℹ️ : les avantages / risques s’affichent au toucher');
    await page.click('[data-tab="math"]');
    check(await page.isVisible('.mathbox .tradeoff') && await page.getAttribute('.gbar .brand-icon', 'class').then(c => /thinking/.test(c)) && await page.isVisible('.logo-bubble'), 'Calcul : avantages/inconvénients, et le logo réfléchit');
    await fresh2('malin');
    await page.click('[data-question]'); await page.click('#next');
    let sc0 = (await S(page)).scores[0];
    await page.evaluate(() => { window.__numero.state.reduceMotion = false; });
    await page.click(`[data-guess="${(await S(page)).secret}"]`); await page.click('#capPrecise');
    check(await page.isVisible('.numtile .loupe-fx'), 'Effet loupe sur le numéro au moment de la capture');
    await page.waitForTimeout(1000);
    st = await S(page);
    check(st.scores[0] - sc0 === 11 && st.last.bonus === 1 && await page.isVisible('.bonus-line') && await page.isVisible('.found-lens'), 'Question puis capture précise réussie : +10 +1 bonus = +11, grosse loupe sur le numéro attrapé');
    check((await page.textContent('.chip .delta')).includes('11') && /cheer/.test(await page.getAttribute('.gbar .brand-icon', 'class')), 'Badge +11 et logo qui fête la capture');
    await fresh2('malin');
    await page.click('[data-question]'); await page.click('#next');
    sc0 = (await S(page)).scores[0];
    await page.evaluate(() => { const N = window.__numero; N.netCapture(N.state.secret); });
    st = await S(page);
    check(st.scores[0] - sc0 === 5, 'Question puis filet réussi : +4 +1 bonus = +5');
    await fresh2('malin');
    sc0 = (await S(page)).scores[0];
    await page.evaluate(() => { const N = window.__numero; N.guess(N.state.secret); });
    check((await S(page)).scores[0] - sc0 === 10, 'Sans question : capture précise = +10 (pas de bonus)');
    // Mode Course (et solo) : pas de filet, le premier qui attrape gagne
    await page.evaluate(() => { const N = window.__numero; N.state.players = 3; N.state.gameMode = 'race'; N.state.starter = 0; N.state.level = 'junior'; N.start(true); });
    await page.click('[data-tab="guess"]'); await page.click('[data-guess="5"]');
    check(await page.isVisible('#capNet') && await page.$$eval('.numtile.in-net', e => e.length) === 2 && (await page.textContent('#capNet .nets-left')) === '●●●', 'Mode Course : filet disponible 3 fois (●●●)');
    const raceNet = await page.evaluate(() => { const N = window.__numero; const s0 = N.state.scores[0]; N.netCapture(N.state.secret); const r = [N.state.last.type, N.state.scores[0] - s0, N.netsLeft(0)]; N.nextTurn(); return [...r, N.state.screen, N.state.raceWinner]; });
    check(raceNet.join() === 'netHit,4,2,end,0', 'Mode Course : un filet réussi attrape le numéro et fait gagner (' + raceNet.join(' ') + ')');
    await page.evaluate(() => { const N = window.__numero; N.state.players = 3; N.state.gameMode = 'race'; N.state.starter = 0; N.state.level = 'junior'; N.start(true); });
    await page.evaluate(() => { const N = window.__numero; N.guess(N.state.secret % 9 + 1); N.nextTurn(); N.state.modal = null; N.guess(N.state.secret); });
    check((await page.textContent('#next')).includes('gagnant'), 'Mode Course : bouton « Voir le gagnant »');
    await page.click('#next');
    st = await S(page);
    check(st.screen === 'end' && st.raceWinner === 1 && (await page.textContent('.hero h1')).includes('Joueur 2') && await page.isVisible('.race-winner'), 'Mode Course : le joueur 2 attrape le numéro → il gagne, la partie s’arrête');
    check((await page.textContent('.panel .sub')).includes('Joueur 2'), 'Rejouer : le joueur suivant commencera (Joueur 2)');
    await page.click('#again');
    st = await S(page);
    check(st.starter === 1 && st.modal === 'handoff' && (await page.textContent('.modal h2')).includes('Joueur 2'), 'Rotation : la nouvelle partie commence par le joueur 2');
    await page.evaluate(() => { const N = window.__numero; for (let i = 0; i < 40 && N.state.screen === 'game'; i++) { N.state.modal = null; if (i % 3 === 0) N.mathAnswer(N.state.math.result), N.nextTurn(); N.guess(N.state.secret % 9 + 1); N.nextTurn(); } });
    st = await S(page);
    check(st.screen === 'end' && st.raceWinner == null && (await page.textContent('.hero h1')).includes('Personne') && await page.isVisible('.finalscore'), 'Mode Course sans capture après le dernier tour : départage aux points et ⭐');
    await page.evaluate(() => { const N = window.__numero; N.state.players = 1; N.start(); });
    await page.click('[data-tab="guess"]');
    check(await page.isVisible('#capNet'), 'Solo : filet disponible (3 fois)');
    // boutons plats
    check(await page.evaluate(() => [...document.querySelectorAll('button')].every(b => getComputedStyle(b).boxShadow === 'none')), 'Boutons plats : plus de reflet sous les boutons');
    // animations réduites
    await page.evaluate(() => { const N = window.__numero; N.state.screen = 'settings'; N.render(); });
    await page.click('#motionToggle');
    check(await page.evaluate(() => document.body.classList.contains('reduce-motion')), 'Option « Réduire les animations »');
    const an = await page.evaluate(() => getComputedStyle(document.querySelector('.detector-pupil')).animationName);
    check(an === 'none', 'Animations coupées quand l’option est active');
    check(page.errors.length === 0, 'Aucune erreur JavaScript (captures/détective/aide/modes) ' + page.errors.join(' | '));
    console.log(`${failed === before ? '✓' : '✗'} Captures, détective, aide par joueur, modes Course / Points, boutons plats`);
    await ctx.close();
  }

  // 3d) Accueil sans défilement, réglages au doigt sans clignotement, prénoms spéciaux
  {
    const before = failed;
    for (const [w, h] of [[360, 640], [360, 740], [412, 800]]) for (const lang of ['fr', 'ar']) {
      const { ctx, page } = await fresh(browser, { width: w, height: h });
      if (lang === 'ar') { await page.evaluate(() => { window.__numero.state.lang = 'ar'; window.__numero.render(); }); }
      await page.waitForTimeout(450);
      const sc = await page.evaluate(() => document.scrollingElement.scrollHeight - window.innerHeight);
      check(sc <= 1, `Accueil ${w}×${h} (${lang}) : tout tient sans défiler (${sc}px)`);
      if (w === 360 && h === 640) await shot(page, `00_accueil_${lang}_360x640`);
      await ctx.close();
    }
    for (const [w, h] of [[360, 700], [412, 760]]) {
      const { ctx, page } = await fresh(browser, { width: w, height: h });
      const worst = await page.evaluate(() => { let m = 0; for (const lv of ['junior', 'malin', 'expert', 'genius']) for (let k = 0; k < 15; k++) { const N = window.__numero; N.state.players = 2; N.state.names = ['Assya', 'Zied', '', '']; N.state.level = lv; N.start(); N.state.modal = null; N.render(); const el = document.querySelector('.turn-body'); m = Math.max(m, el.scrollHeight - el.clientHeight); } return m; });
      check(worst <= 2, `Onglet Indice ${w}×${h} (4 niveaux, 60 tirages) : rien à faire défiler (${worst}px)`);
      await ctx.close();
    }
    const { ctx, page } = await fresh(browser);
    await page.tap('#openSettings'); await page.waitForTimeout(500);
    const flashCheck = async label => { await page.waitForTimeout(60); const r = await page.evaluate(() => ({ cls: document.getElementById('app').classList.contains('screen-enter'), anim: [...document.querySelectorAll('#app > *')].some(el => el.getAnimations().some(a => a.animationName === 'screenIn')) })); check(!r.cls && !r.anim, `Réglages « ${label} » : pas de clignotement de l’écran`); };
    const taps = [
      ['[data-language="en"]', st => st.lang === 'en', 'English'], ['[data-language="ar"]', st => st.lang === 'ar', 'العربية'], ['[data-language="fr"]', st => st.lang === 'fr', 'Français'],
      ['#soundToggle', st => st.sound === false, 'Son coupé'], ['#soundToggle', st => st.sound === true, 'Son activé'],
      ['[data-timer="long"]', st => st.timerMode === 'long', 'Plus de temps'], ['[data-timer="off"]', st => st.timerMode === 'off', 'Sans chrono'], ['[data-timer="normal"]', st => st.timerMode === 'normal', 'Chrono normal'],
      ['#motionToggle', st => st.reduceMotion === true, 'Animations réduites'], ['#motionToggle', st => st.reduceMotion === false, 'Animations normales'],
      ['#replayToggle', st => st.replayAsk === true, 'Film du parcours activé'], ['#replayToggle', st => st.replayAsk === false, 'Film du parcours désactivé'],
    ];
    for (const [sel, ok, label] of taps) {
      await page.locator(sel).scrollIntoViewIfNeeded(); await page.tap(sel);
      check(ok(await S(page)), `Réglages : le bouton « ${label} » fonctionne au toucher`);
      await flashCheck(label);
    }
    await page.tap('#closeSettingsBottom');
    check((await S(page)).screen === 'home', 'Réglages : bouton Retour');
    // prénoms avec caractères spéciaux
    await page.tap('[data-players="2"]'); await page.tap('#start');
    await page.fill('#name0', `<b>Al'i</b>`); await page.fill('#name1', 'Inès');
    await page.tap('#namesGo'); await page.waitForFunction(() => window.__numero.state.screen === 'game');
    const t0 = await page.textContent('.bubble b');
    check(t0.includes(`<b>Al'i</b>`) && !(await page.$('.modal-back')), 'Prénom avec caractères spéciaux affiché tel quel, partie lancée en un seul appui');
    await page.tap('[data-tab="question"]'); await page.tap('[data-question]');
    await page.tap('#openNotebook');
    check((await page.textContent('.modal .history-items')).includes(`<b>Al'i</b>`), 'Prénom correct dans le carnet');
    check(page.errors.length === 0, 'Aucune erreur JavaScript (accueil/réglages/prénoms) ' + page.errors.join(' | '));
    console.log(`${failed === before ? '✓' : '✗'} Accueil sans défilement, réglages au toucher sans clignotement, prénoms`);
    await ctx.close();
  }

  // 3f) Film du parcours du numéro
  {
    const before = failed;
    const { ctx, page } = await fresh(browser);
    const chk = await page.evaluate(() => { const N = window.__numero, errs = []; let hunts = 0, steps = 0;
      const verify = () => { const h = N.state.lastHunt; if (!h) { errs.push('pas de parcours'); return; } hunts++; steps += h.steps.length;
        if (!h.steps.length) { if (h.start !== h.end.n) errs.push('départ ≠ capture sans saut'); return; }
        if (h.steps[0].from !== h.start) errs.push('1er saut ne part pas du départ');
        for (let k = 1; k < h.steps.length; k++) if (h.steps[k].from !== h.steps[k - 1].to) errs.push('saut discontinu');
        if (h.steps[h.steps.length - 1].to !== h.end.n) errs.push('dernière position ≠ numéro attrapé');
        if (h.steps.some(st => !st.ev)) errs.push('saut sans événement');
        for (const st of h.steps) if (!st.frozen && N.moveFn(st.shift)(st.from) !== st.to) errs.push('saut mal calculé'); };
      for (const lv of ['junior', 'malin', 'expert', 'genius', 'challenge']) for (let gm = 0; gm < 40; gm++) {
        if (lv === 'challenge') N.startChallenge('endless'); else { N.state.players = 1 + gm % 3; N.state.gameMode = 'score'; N.state.level = lv; N.start(); }
        for (let i = 0; i < 30 && N.state.screen === 'game'; i++) { const s = N.state; s.modal = null; const r = Math.random();
          if (r < .3) N.ask(s.choices[0]); else if (r < .55) N.mathAnswer(Math.random() < .6 ? s.math.result : s.math.options[0]);
          if (N.state.phase === 'result') N.nextTurn(); N.state.modal = null;
          const c = N.state.candidates, pickn = c[Math.floor(Math.random() * c.length)];
          if (Math.random() < .5) N.guess(Math.random() < .35 ? N.state.secret : pickn); else N.netCapture(Math.random() < .3 ? N.state.secret : pickn);
          if (N.state.last && ['found', 'netHit'].includes(N.state.last.type)) verify();
          N.nextTurn(); } }
      return { errs: [...new Set(errs)], hunts, steps }; });
    check(chk.errs.length === 0 && chk.hunts > 100, `Parcours exact et continu sur ${chk.hunts} captures (${chk.steps} sauts), 4 niveaux + défi ${chk.errs.join(', ')}`);
    await page.evaluate(() => { const N = window.__numero; N.state.replayAsk = true; N.state.players = 2; N.state.gameMode = 'score'; N.state.starter = 0; N.state.level = 'malin'; N.state.reduceMotion = false; N.start(true); });
    await page.click('[data-question]'); await page.click('#next');
    await page.evaluate(() => { const N = window.__numero; N.state.modal = null; N.guess(N.state.secret % 15 + 1); N.nextTurn(); N.state.modal = null; N.render(); });
    await page.click('[data-tab="guess"]');
    const sec = (await S(page)).secret;
    await page.click(`[data-guess="${sec}"]`); await page.click('#capPrecise');
    await page.waitForTimeout(900);
    check(!(await S(page)).modal, 'La fenêtre attend la fin de l’animation de capture');
    await page.waitForTimeout(1700);
    check((await S(page)).modal === 'replayAsk' && await page.isVisible('#rpYes'), 'Après la capture : popup « Revoir l’évasion du numéro ? »');
    await page.click('#rpNo');
    check(!(await S(page)).modal && await page.isVisible('#openReplay'), 'Non merci : fermé, bouton « Revoir son parcours » disponible');
    await page.click('#openReplay');
    const h = (await S(page)).lastHunt;
    const frames = 2 + h.steps.length;
    check(await page.isVisible('.modal.replay') && (await page.textContent('.rp-num')).trim() === String(h.start) && (await page.textContent('.rp-step')).includes(`/ ${frames}`), `Film : départ sur le ${h.start}, ${frames} étapes`);
    await page.click('#rpPlay');
    const seq = [];
    for (let k = 1; k < frames; k++) { await page.click('#rpNext'); seq.push(Number((await page.textContent('.rp-num')).trim())); }
    const want = [...h.steps.map(st => st.to), h.end.n];
    check(seq.join() === want.join(), `Film : chaque étape montre la bonne position (${[h.start, ...seq].join(' → ')})`);
    check(await page.isVisible('.rp-stage.win') && (await page.textContent('.rp-cap')).includes(String(h.end.n)), 'Film : la dernière étape montre la capture');
    check(await page.$$eval('.rp-track span.trail, .rp-track span.cur', e => e.length) >= 1, 'Film : traces du parcours sur la grille');
    // le choix raté du joueur est montré
    const missIdx = 1 + h.steps.findIndex(st => st.ev && st.ev.type === 'wrong');
    await page.click('#rpRestart'); await page.click('#rpModeManual');
    for (let k = 0; k < missIdx; k++) await page.click('#rpNext');
    const missEv = h.steps[missIdx - 1].ev;
    check(await page.isVisible('.rp-pick.bad') && (await page.textContent('.rp-pick')).includes(String(missEv.n)) && await page.$$eval('.rp-track span.miss', e => e.map(x => x.textContent).join()) === String(missEv.n), `Film : le choix raté (${missEv.n}) est montré, en rouge sur la grille`);
    check(await page.isVisible('.rp-was'), 'Film : « il était sur le … » à côté du choix raté');
    const wrapOk = await page.evaluate(() => { const N = window.__numero, s = N.state; s.lastHunt = { start: 2, max: 15, steps: [{ from: 2, to: 15, shift: -2, ev: { type: 'question', player: 0, qid: s.choices[0], answer: false, shift: -2 } }], end: { type: 'found', player: 0, n: 15 } }; s.rpIdx = 1; s.rpPlaying = false; N.render();
      const mv = document.querySelector('.rp-move'), sp = mv.querySelectorAll('span'); return sp[0].textContent === '2' && sp[1].textContent === '15' && mv.querySelector('.mv-arrow i').textContent === '−2' && document.querySelector('.rp-hint.wrap').textContent.includes('15'); });
    check(wrapOk, 'Film : 2 ──−2──➜ 15 avec « Après 1, il repart de 15 » (flèche dans le bon sens)');
    check(!(await page.textContent('.rp-cap')).includes('⬅'), 'Film : la légende ne répète pas la flèche du saut');
    await page.evaluate(() => { const N = window.__numero; N.state.rpIdx = 0; N.render(); });
    check(await page.isVisible('#rpNext') && (await page.textContent('#rpNext')).includes('Suivant') && (await page.textContent('#rpPrev')).includes('Précédent'), 'Film « Avec les boutons » : boutons « Précédent » et « Suivant » visibles');
    check(await page.evaluate(() => [...document.querySelectorAll('.rp-ctrl .key')].every(b => b.scrollWidth <= b.clientWidth + 1 && b.getBoundingClientRect().width >= 40 && b.getBoundingClientRect().height >= 40)), 'Film : boutons assez grands, textes non coupés');
    // mode boutons : pas d'enchaînement automatique
    const idxM = (await S(page)).rpIdx; await page.waitForTimeout(6600);
    check((await S(page)).rpIdx === idxM && !(await page.$('#rpPlay')) && !(await page.$('.rp-bar')), 'Film « Avec les boutons » : pas d’enchaînement automatique');
    // pas de flash : la fenêtre n'est pas ré-animée entre deux étapes
    await page.click('#rpNext');
    const anims = await page.evaluate(() => [...document.querySelectorAll('.modal-back, .modal-back > .modal')].flatMap(el => el.getAnimations().map(a => a.animationName)));
    check(anims.length === 0, 'Film : aucun fondu de la fenêtre entre deux étapes (plus d’écran noir)');
    check(await page.evaluate(() => getComputedStyle(document.querySelector('.modal-back')).backgroundColor) === 'rgba(20, 32, 74, 0.8)', 'Film : le fond sombre reste identique d’une étape à l’autre');
    // mode automatique : 6 s par étape
    await page.click('#rpModeAuto'); await page.click('#rpRestart'); await page.waitForTimeout(4700);
    check((await S(page)).rpIdx === 0 && await page.isVisible('.rp-bar'), 'Film automatique : l’étape reste affichée (pas d’enchaînement avant 6 s), barre de temps');
    await page.waitForTimeout(2000);
    check((await S(page)).rpIdx === 1, 'Film automatique : étape suivante après 6 s');
    check(await page.evaluate(() => window.__numero.RP_STEP) === 6000, 'Film : 6 secondes par étape');
    await page.click('#rpClose');
    check(!(await S(page)).modal, 'Film : fermeture');
    await page.click('#next');
    await page.evaluate(() => { const N = window.__numero; N.state.modal = null; N.state.lang = 'ar'; N.state.reduceMotion = true; N.guess(N.state.secret); });
    await page.waitForTimeout(300);
    check((await S(page)).modal === 'replayAsk', 'Popup aussi en arabe');
    await page.click('#rpNever');
    check((await S(page)).replayAsk === false, '« Ne plus demander » enregistré');
    await page.click('#next');
    await page.evaluate(() => { const N = window.__numero; N.state.modal = null; N.guess(N.state.secret); });
    await page.waitForTimeout(400);
    check(!(await S(page)).modal, 'Plus de popup après « Ne plus demander » (le bouton reste dans le résultat)');
    await page.click('#openReplay');
    check(await page.isVisible('.modal.replay'), 'Film disponible en arabe');
    await page.evaluate(() => { const N = window.__numero; N.state.lang = 'fr'; N.state.players = 1; N.start(); for (let i = 0; i < 40 && N.state.screen === 'game'; i++) { N.state.modal = null; N.guess(N.state.secret % N.maxN() + 1); N.nextTurn(); } });
    const st = await S(page);
    check(st.screen === 'end' && st.soloWon === false && (await page.textContent('.hero h1')).includes('échappé') && (await page.textContent('.intro')).includes(String(st.soloSecret)), 'Solo non trouvé en 12 tours : « Il t’a échappé », le numéro est révélé');
    check(await page.isVisible('.solo-reveal .lens-glass') && !(await page.$('.solo-stars')) && !(await page.$('.finalscore')), 'Solo perdu : loupe sur le numéro caché, pas d’étoiles ni de score');
    // Ponctuation des questions dans les 3 langues
    const punct = await page.evaluate(() => { const D = window.__numero.dictionaries, bad = [];
      for (const [l, d] of Object.entries(D)) for (const [k, v] of Object.entries(d)) { if (typeof v !== 'string') continue;
        if (/^\s*[?؟❓]/.test(v)) bad.push(l + ':' + k + ' commence par ?');
        if (l === 'fr' && /[^\u00a0]\?/.test(v.replace(/\?\u00a0/g, '?'))) bad.push('fr:' + k + ' sans espace insécable avant ?');
        if (l === 'en' && /\s\?/.test(v)) bad.push('en:' + k + ' espace avant ?');
        if (l === 'ar' && /\?/.test(v)) bad.push('ar:' + k + ' « ? » au lieu de « ؟ »'); }
      return bad; });
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
      const N = window.__numero, bad = [];
      const run = (kind, diff, plan) => {
        N.startChallenge(kind, diff); const s = N.state; s.chElapsed = 60000;
        for (const a of plan) {
          if (a === 'calc') N.mathAnswer(s.math.result); else if (a === 'q') N.ask(s.choices[0]); else if (a === 'badcalc') N.mathAnswer(s.math.options.find(o => o !== s.math.result));
          if (s.phase === 'result') N.nextTurn();
          if (a === 'net') N.netCapture(s.secret > 50 ? 1 : 100); else N.guess(s.secret === 1 ? 2 : s.secret - 1);
          N.nextTurn();
        }
        N.guess(N.state.secret); N.nextTurn(); return N.state.chFinal;
      };
      let sims = 0;
      for (const kind of ['timed', 'endless']) for (const diff of ['easy', 'medium', 'hard']) {
        const quick = run(kind, diff, []);
        for (let k = 1; k <= 8; k++) { const sc = run(kind, diff, Array(k).fill('calc')); sims++; if (sc >= quick) bad.push(`${kind}/${diff} ${k} calculs+ratés : ${sc} ≥ ${quick}`); }
        for (let r = 0; r < 20; r++) {
          const plan = Array.from({ length: 1 + Math.floor(Math.random() * 6) }, () => ['calc', 'calc', 'q', 'badcalc', 'none', 'net'][Math.floor(Math.random() * 6)]);
          const sc = run(kind, diff, plan); sims++; if (sc >= quick) bad.push(`${kind}/${diff} [${plan}] : ${sc} ≥ ${quick}`);
        }
      }
      // le scénario de l'audit : 8 calculs justes + 7 ratés puis capture (1 205 points en V8.3)
      const audit = run('endless', 'hard', Array(7).fill('calc'));
      return { bad, sims, audit, quick: run('endless', 'hard', []) };
    });
    check(abuse.bad.length === 0, `Défi : ${abuse.sims} parties « retardées exprès » ne battent jamais une capture plus rapide ` + abuse.bad.slice(0, 3).join(' | '));
    check(abuse.audit < abuse.quick, `Défi : le scénario de l’audit (7 calculs justes + 7 ratés) ne rapporte plus (${abuse.audit} < ${abuse.quick})`);
    // chrono du défi figé pendant la lecture du résultat
    const tm = await page.evaluate(async () => {
      const N = window.__numero, wait = ms => new Promise(r => setTimeout(r, ms));
      N.startChallenge('timed', 'medium'); N.state.modal = null; N.render(); N.ask(N.state.choices[0]);
      const a = N.state.chElapsed; await wait(900); const b = N.state.chElapsed;
      N.nextTurn(); await wait(900); const c = N.state.chElapsed;
      N.startChallenge('endless', 'medium'); N.ask(N.state.choices[0]); const d = N.state.chElapsed; await wait(700);
      return { result: b - a, play: c - b, endless: N.state.chElapsed - d };
    });
    check(tm.result === 0 && tm.endless === 0, `Défi : chrono arrêté pendant l’écran de résultat (+${tm.result} ms, sans limite +${tm.endless} ms)`);
    check(tm.play >= 600, `Défi : le chrono repart quand on rejoue (+${tm.play} ms)`);
    // difficultés
    await page.evaluate(() => { const N = window.__numero; N.state.screen = 'home'; N.state.mode = 'normal'; N.state.modal = null; N.render(); });
    await page.click('#openChallenge');
    check((await page.$$('[data-chdiff]')).length === 3 && await page.isVisible('[data-chdiff="medium"].on'), 'Défi : 3 difficultés, « Moyen » par défaut');
    await page.click('[data-chdiff="easy"]'); await page.click('#chEndless');
    const easy = await page.evaluate(() => { const N = window.__numero, r = []; for (let i = 0; i < 60; i++) { N.startChallenge('endless', 'easy'); r.push(N.state.math.result, ...N.state.math.options); } return { level: N.state.level, diff: N.state.chDiff, max: Math.max(...r), n: N.state.math.options.length, maxN: N.maxN() }; });
    check(easy.level === 'junior' && easy.diff === 'easy' && easy.max <= 13 && easy.n === 3 && easy.maxN === 100, `Défi facile : calculs du niveau Petit, numéros 1–100 (max proposé ${easy.max})`);
    const hard = await page.evaluate(() => { const N = window.__numero; N.startChallenge('timed', 'hard'); return [N.state.level, N.state.math.options.length, N.state.chDiffPref].join(); });
    check(hard === 'expert,6,hard', 'Défi difficile : calculs à priorités, 6 propositions, choix mémorisé (' + hard + ')');
    const recs = await page.evaluate(() => { localStorage.removeItem('numeroEnFuiteRecords'); const N = window.__numero; N.startChallenge('endless', 'easy'); N.guess(N.state.secret); N.nextTurn(); N.startChallenge('endless', 'hard'); N.ask(N.state.choices[0]); N.nextTurn(); N.guess(N.state.secret); N.nextTurn(); return N.records(); });
    check(recs['endless-easy'] === 1000 && recs['endless-hard'] === 995 && !('endless' in recs), 'Défi : un record par difficulté ' + JSON.stringify(recs));
    // sauts spéciaux : jamais sur place (÷2 sur 1, ×2 sur le maximum)
    const still = await page.evaluate(() => {
      const N = window.__numero; let same = 0, n = 0;
      for (let i = 0; i < 150; i++) { N.state.players = 1; N.state.level = 'genius'; N.state.mode = 'normal'; N.start(true); N.state.modal = null; N.state.secret = 50; N.ask(N.state.choices[0]); n++; if (N.state.history.at(-1).shift && N.state.secret === 50) same++; }
      for (let i = 0; i < 150; i++) { N.startChallenge('endless', 'medium'); N.state.secret = i % 2 ? 1 : 100; const s0 = N.state.secret; N.ask(N.state.choices[0]); n++; if (N.state.secret === s0) same++; }
      return { same, n };
    });
    check(still.same === 0, `Génie (50) et défi (1, 100) : ${still.n} sauts, aucun ne laisse le numéro sur place (${still.same})`);
    // version affichée = versionName de app/build.gradle
    const gradleVersion = fs.readFileSync(path.join(__dirname, '..', 'app', 'build.gradle'), 'utf8').match(/versionName\s+'([^']+)'/)[1];
    await page.evaluate(() => { const N = window.__numero; N.state.mode = 'normal'; N.state.screen = 'home'; N.state.modal = null; N.render(); });
    const foot = await page.textContent('.footer');
    check(foot.includes('V' + gradleVersion) && !foot.includes('V7'), `Accueil : version ${gradleVersion} affichée (« ${foot.trim()} »)`);
    await page.click('#openSettings');
    check((await page.textContent('.app-version')).includes(gradleVersion), 'Réglages : numéro de version affiché');
    await page.click('#closeSettings');
    // tutoriel
    for (const lang of ['fr', 'en', 'ar']) {
      await page.evaluate(l => { const N = window.__numero; N.state.lang = l; N.state.modal = null; N.state.screen = 'home'; N.render(); }, lang);
      await page.click('#openTutorial');
      let txt = '';
      for (let i = 0; i < 4; i++) { txt += await page.textContent('.modal'); await page.click(i === 1 ? '#tutAsk' : '#tutNext'); }
      txt += await page.textContent('.modal');
      check(!/\btut[A-Z0-9]/.test(txt) && (await S(page)).tut.step === 4, `Tutoriel (${lang}) : 5 étapes traduites, arrivée à la capture`);
      await page.click('#tutClose');
    }
    await page.evaluate(() => { const N = window.__numero; N.state.lang = 'fr'; N.render(); });
    await page.click('#openRules'); await page.click('#rulesTutorial');
    let tu = await S(page);
    check(tu.modal === 'tutorial' && tu.tut.step === 0 && (await page.$$('.tut-cell.secret')).length === 1, 'Tutoriel accessible depuis les règles, numéro d’entraînement visible');
    await page.click('#tutNext'); await page.click('#tutAsk');
    check((await page.$$('.tut-cell.out')).length === 4, 'Tutoriel : « plus grand que 5 ? » NON → 6, 7, 8, 9 rayés');
    await page.click('#tutNext');
    const moved = await page.$$eval('.tut-cell', cs => cs.map(c => (c.classList.contains('out') ? 'x' : '') + (c.classList.contains('secret') ? '*' : '')).join(','));
    check(moved === 'x,,,,*,,x,x,x' && await page.isVisible('.tut-body .blind-jump'), 'Tutoriel : le numéro s’enfuit (+1, 4 → 5) et le carnet se décale (2 à 6) ' + moved);
    await page.click('#tutNext');
    check(await page.isDisabled('#tutPrecise') && await page.isDisabled('#tutNet'), 'Tutoriel : boutons de capture inactifs tant qu’aucun numéro n’est touché');
    await page.click('[data-tutpick="8"]'); await page.click('#tutPrecise');
    tu = await S(page);
    check(tu.tut.step === 4 && (await page.textContent('.tut-body')).includes('5'), 'Tutoriel : capture ratée expliquée, on peut réessayer');
    await page.click('[data-tutpick="4"]');
    check((await page.textContent('#tutNet')).includes('4·5'), 'Tutoriel : filet 4·5 (2 voisins au niveau Petit)');
    await page.click('#tutNet');
    check((await S(page)).tut.step === 5 && (await page.textContent('.modal')).includes('+4'), 'Tutoriel : filet réussi, +4, conclusion');
    await page.click('#tutPlay');
    check((await S(page)).modal === 'names', 'Tutoriel : « Jouer » ouvre la préparation de la partie');
    await page.evaluate(() => { const N = window.__numero; N.state.modal = null; N.render(); });
    await page.click('#openTutorial');
    check(await page.evaluate(() => window.__numero.back()) && (await S(page)).modal === null, 'Bouton Retour : ferme le tutoriel');
    // règle de la Course : départage annoncé
    await page.click('[data-players="2"]'); await page.click('#start');
    check((await page.textContent('[data-gmode="race"]')).includes('points départagent'), 'Mode Course : le départage aux points est annoncé');
    await page.evaluate(() => { const N = window.__numero; N.state.modal = null; N.render(); });
    // mini-carnet et saut « à l'aveugle »
    await page.evaluate(() => { const N = window.__numero; N.state.players = 2; N.state.level = 'genius'; N.state.mode = 'normal'; N.start(true); N.state.modal = null; N.render(); });
    check(await page.isVisible('.mini-notebook .tip'), 'Mini-carnet : astuce en début de chasse');
    await page.evaluate(() => { const N = window.__numero; N.ask(N.state.choices[0]); });
    const jump = await page.evaluate(() => { const el = document.querySelector('.move-line .blind-jump'), m = window.__numero.state.last.shift; return { ok: !!el, cls: el && el.className, tokens: el && el.textContent.trim(), op: m.op }; });
    const expCls = { '+': 'hop', '×': 'grow', '÷': 'shrink', mirror: 'mirror' }[jump.op];
    check(jump.ok && jump.cls.includes(expCls) && jump.tokens === '?', `Saut à l’aveugle « ${jump.op} » animé (${expCls}) sans révéler la position`);
    await page.evaluate(() => { const N = window.__numero; N.nextTurn(); N.guess(N.state.secret === 1 ? 2 : 1); N.nextTurn(); N.state.modal = null; N.render(); });
    const mini = await page.textContent('.mini-notebook');
    check(mini.includes('Derniers indices') && (mini.match(/Joueur/g) || []).length === 2, 'Mini-carnet : les 2 derniers événements de la chasse en cours');
    // sous-totaux du classement (mode Points)
    await page.evaluate(() => { const N = window.__numero; N.state.players = 2; N.state.gameMode = 'score'; N.state.level = 'junior'; N.start(true); const s = N.state; s.scores = [12, 7]; s.stars = [3, 0]; s.screen = 'end'; s.modal = null; N.render(); });
    const sub = await page.$$eval('.finalscore > div:nth-child(2) small', e => e.map(x => x.textContent));
    check(sub.length === 2 && sub[0].includes('12') && sub[0].includes('3'), 'Classement Points : sous-totaux « captures + ⭐ calculs » ' + sub.join(' / '));
    const dupIds = await page.evaluate(() => {
      const N = window.__numero, out = [];
      const scan = tag => { const seen = {}; document.querySelectorAll('[id]').forEach(e => { if (seen[e.id]) out.push(tag + ':' + e.id); seen[e.id] = 1; }); };
      for (const m of [null, 'rules', 'challenge', 'names', 'tutorial']) { N.state.screen = 'home'; N.state.mode = 'normal'; N.state.modal = m; if (m === 'tutorial') N.state.tut = { step: 4, sel: 3, miss: null }; N.render(); scan('home/' + m); }
      N.state.players = 2; N.start(true); for (const m of [null, 'pause', 'notebook', 'quit', 'handoff']) { N.state.modal = m; N.render(); scan('game/' + m); }
      N.state.screen = 'settings'; N.state.modal = null; N.render(); scan('settings');
      return out;
    });
    check(dupIds.length === 0, 'Aucun identifiant HTML en double (accueil, fenêtres, partie, réglages) ' + dupIds.join(', '));
    check(page.errors.length === 0, 'Aucune erreur JavaScript (V8.4) ' + page.errors.join(' | '));
    console.log(`${failed === before ? '✓' : '✗'} V8.4 : défi anti-abus, chrono figé, difficultés, sauts, version, tutoriel, mini-carnet`);
    await ctx.close();
  }

  // 4) Rendu sur petits écrans + captures
  for (const vp of [{ width: 320, height: 568, tag: '320' }, { width: 360, height: 740, tag: '360' }]) {
    const before = failed;
    const { ctx, page } = await fresh(browser, { width: vp.width, height: vp.height });
    const pre = vp.tag === '360' ? '' : 'petit_';
    await noOverflow(page, `Accueil ${vp.tag}px`); await shot(page, pre + '01_accueil');
    const tile = await page.$eval('[data-players="1"]', el => el.getBoundingClientRect().height);
    check(tile >= 44, `Boutons tactiles ≥ 44 px (${Math.round(tile)} px)`);
    await page.click('[data-players="3"]'); await page.click('[data-level="expert"]'); await page.click('#start'); await page.waitForTimeout(300); await shot(page, pre + '01b_prenoms'); await page.click('#namesGo'); await page.waitForFunction(() => window.__numero.state.screen === 'game'); await page.waitForTimeout(450);
    await noOverflow(page, `Partie ${vp.tag}px`); await shot(page, pre + '03_questions');
    const pageScroll = await page.evaluate(() => document.scrollingElement.scrollHeight - window.innerHeight);
    check(pageScroll <= 1, `Partie ${vp.tag}px : tout tient sur l’écran, pas de défilement (${pageScroll}px)`);
    await page.click('[data-tab="math"]'); await page.waitForTimeout(1500); await shot(page, pre + '04_calcul');
    const st = await S(page);
    await page.click(`[data-math="${st.math.result}"]`); await page.waitForTimeout(400); await shot(page, pre + '05_calcul_reussi');
    await page.click('#next'); await noOverflow(page, `Grille 1-30 ${vp.tag}px`); await shot(page, pre + '06_grille_grand');
    if (vp.tag === '360') { await page.click('[data-guess="12"]'); await page.waitForTimeout(200); await shot(page, pre + '06b_filet'); const inner = await page.$eval('.turn-body', el => el.scrollHeight - el.clientHeight); check(inner <= 2, `Grille 1-30 + boutons de capture visibles sans défiler (${inner}px)`); }
    const t = await page.$eval('[data-guess="30"]', el => el.getBoundingClientRect());
    check(t.width >= 44 && t.height >= (vp.tag === '360' ? 44 : 36), `Cases numéros 1-30 assez grandes (${Math.round(t.width)}×${Math.round(t.height)} px)`);
    await page.evaluate(() => { const N = window.__numero; for (let i = 0; i < 30 && N.state.screen === 'game'; i++) { N.state.modal = null; N.guess(N.state.secret); N.nextTurn(); } });
    await page.waitForTimeout(300);
    await noOverflow(page, `Victoire ${vp.tag}px`); await shot(page, pre + '09_victoire');
    console.log(`${failed === before ? '✓' : '✗'} Affichage ${vp.width}×${vp.height}`);
    await ctx.close();
  }

  await browser.close();
  console.log(`\nRésultat : ${passed} vérifications réussies, ${failed} échec(s).`);
  if (failed) { console.log(failures.slice(0, 60).join('\n')); process.exit(1); }
})().catch(e => { console.error(e); process.exit(1); });
