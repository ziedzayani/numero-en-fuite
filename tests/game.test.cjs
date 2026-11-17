/*
 * Tests automatiques du jeu « Le Numéro en fuite » (navigateur Chromium sans écran).
 * Usage :  npm install playwright && npx playwright install chromium
 *          node tests/game.test.cjs [chemin/vers/index.html] [dossier/captures]
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'index.html'));
const SHOTS = process.argv[3] ? path.resolve(process.argv[3]) : null;
const URL = 'file://' + FILE;
const MAX = { junior: 9, malin: 15, expert: 30 };
const RANGE = { junior: 1, malin: 2, expert: 2 };
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
  p=((p-1+e.shift)%max+max)%max+1}
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
  if (players > 1) {
    check(await page.isVisible('#name0'), `${label} : saisie des prénoms`);
    for (let i = 0; i < players; i++) await page.fill('#name' + i, i === 1 ? '' : NAMES[i]);
    await page.click('#namesGo');
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
      check(st.modal === 'handoff', `${label} t${turn} : écran « passe le téléphone » affiché`);
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
        const nOpt = level === 'expert' ? 6 : 3; check(st.math.options.includes(st.math.result) && new Set(st.math.options).size === nOpt && await page.$$eval('[data-math]', e => e.length) === nOpt, `${label} t${turn} : calcul avec ${nOpt} réponses dont la bonne`);
        await page.click(`[data-math="${opt}"]`);
        mathCount++;
        const after = await S(page);
        check(after.stars[player] === starsBefore[player] + (answerRight ? 1 : 0), `${label} t${turn} : étoile ${answerRight ? 'gagnée' : 'non gagnée'}`);
        check(after.scores.join() === scoresBefore.join(), `${label} t${turn} : le calcul ne change pas les points`);
      }
      let r = await S(page);
      const shift = r.last.shift;
      check(r.phase === 'result' && Math.abs(shift) <= RANGE[level], `${label} t${turn} : déplacement annoncé ${shift} dans ±${RANGE[level]}`);
      check(((secretBefore - 1 + shift + max * 10) % max) + 1 === r.secret, `${label} t${turn} : déplacement appliqué correctement (bouclage)`);
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
    const mode = turn % 2 === 0 ? 'precise' : 'net';
    const n = await page.evaluate(({ right, mode }) => { const N = window.__numero, s = N.state, max = N.maxN();
      if (right) return s.secret;
      for (let k = 1; k <= max; k++) { const c = ((s.secret - 1 + k * 3) % max) + 1; if (mode === 'precise' ? c !== s.secret : !N.netRange(c).includes(s.secret)) return c; } return null; }, { right: wantRight, mode });
    if (st.tab !== 'guess') await page.click('[data-tab="guess"]');
    check(await page.isDisabled('#capPrecise') && await page.isDisabled('#capNet'), `${label} t${turn} : les 2 boutons de capture attendent un numéro`);
    await page.click(`[data-guess="${n}"]`);
    const inNet = await page.$$eval('.numtile.in-net', els => els.map(e => Number(e.textContent)));
    const expNet = await page.evaluate(n => window.__numero.netRange(n), n);
    check(inNet.join() === expNet.join() && expNet.length === (level === 'junior' ? 2 : 3) && expNet.every(v => v >= 1 && v <= max), `${label} t${turn} : filet de ${expNet.length} numéros dans les limites (${expNet.join('·')})`);
    await page.click(mode === 'precise' ? '#capPrecise' : '#capNet');
    await page.waitForFunction(() => window.__numero.state.phase === 'result', null, { timeout: 3000 });
    guessCount++;
    const g = await S(page);
    const delta = g.scores[player] - st.scores[player];
    const expDelta = wantRight ? (mode === 'precise' ? 10 : 2) + (action === 0 ? 1 : 0) : (mode === 'precise' ? -1 : -(level === 'junior' ? 2 : 3));
    check(delta === expDelta, `${label} t${turn} : ${mode} ${wantRight ? 'réussie' : 'ratée'} → ${expDelta > 0 ? '+' : ''}${expDelta} (obtenu ${delta})`);
    check(g.last.type === (mode === 'precise' ? (wantRight ? 'found' : 'wrong') : (wantRight ? 'netHit' : 'netMiss')), `${label} t${turn} : type de capture enregistré`);
    if (wantRight) finds++;
    const nb = await notebookOK(page);
    check(nb.ok, `${label} t${turn} : carnet exact après la capture (attendu ${nb.exp} / carnet ${nb.got})`);
    if (turn + 1 < st.limit) { const D = await page.evaluate(l => window.__numero.dictionaries[l], lang); const want = players === 1 ? D.nextTurn : D.nextPlayer; check((await page.textContent('#next')).includes(want), `${label} t${turn} : bouton « ${want} »`); }
    check(g.secret >= 1 && g.secret <= max, `${label} t${turn} : secret toujours valide`);
    await page.click('#next');
  }
  st = await S(page);
  check(st.screen === 'end', `${label} : écran de victoire atteint`);
  check(st.captures === finds, `${label} : ${finds} captures comptées`);
  const endText = await page.textContent('#app');
  check(!/\{\w+\}/.test(endText), `${label} : aucun texte non traduit sur l'écran final`);
  check(await page.isVisible('#again') && await page.isVisible('#menu'), `${label} : boutons Rejouer / Accueil`);
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
  for (const players of [1, 2, 3, 4]) for (const level of ['junior', 'malin', 'expert']) {
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
      for (const level of ['junior', 'malin', 'expert']) for (let rep = 0; rep < 150; rep++) {
        const st = N.state; st.players = 1 + (rep % 4); st.level = level; N.start(); if (N.state.modal) N.state.modal = null;
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
          if (N.state.phase === 'result') { const sh = N.state.last.shift; if (Math.abs(sh) > RANGE[level]) errors.push('déplacement trop grand ' + sh); N.nextTurn(); }
          if (N.state.phase !== 'choose') errors.push('phase inattendue après aide');{const e=EXP(N);if(e.join()!==[...N.state.candidates].sort((a,b)=>a-b).join())errors.push('carnet faux après aide '+level)}
          const c = N.state.candidates; const pickN = c[Math.floor(Math.random() * c.length)]; if (Math.random() < .5) N.guess(Math.random() < .3 ? 1 + Math.floor(Math.random() * max) : pickN); else N.netCapture(1 + Math.floor(Math.random() * max)); if (N.state.last && N.state.last.type === 'netMiss' && N.state.last.nums.length !== N.netSize()) errors.push('taille de filet');
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
    await page.click('#namesGo'); await page.click('#handoffGo');
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

  // 3b) Chronos adaptés à l'âge : calcul + choix du numéro, pause
  {
    const before = failed;
    const { ctx, page } = await fresh(browser);
    const ages = await page.$$eval('.level .age', els => els.map(e => e.textContent));
    check(ages.length === 3 && ages[0].includes('5') && ages[2].includes('11'), 'Âges affichés sur les niveaux : ' + ages.join(' / '));
    for (const [level, mathS, turnS] of [['junior', 30, 40], ['malin', 30, 35], ['expert', 45, 30]]) {
      await page.evaluate(lv => { const N = window.__numero; N.state.players = 2; N.state.level = lv; N.state.timerMode = 'normal'; N.start(); }, level);
      await page.click('#handoffGo');
      await page.waitForTimeout(700);
      check(!(await page.$('#timer')) && (await S(page)).turnElapsed === 0, `${level} : pas de chrono pendant qu’on lit les questions`);
      await page.click('[data-tab="guess"]');
      check(await page.getAttribute('#timer', 'data-kind') === 'turn' && (await page.textContent('#timerText')).includes(String(turnS)), `${level} : le chrono « choisis ton numéro » (${turnS} s) démarre en ouvrant Deviner`);
      await page.waitForTimeout(1200);
      const te = (await S(page)).turnElapsed;
      check(te >= 800 && te <= 2000, `${level} : le chrono du tour avance (${te} ms)`);
      await page.click('#pause'); const p0 = (await S(page)).turnElapsed; await page.waitForTimeout(800);
      check((await S(page)).turnElapsed === p0, `${level} : PAUSE arrête le chrono`);
      await page.click('#resumeGame');
      await page.click('[data-tab="math"]');
      check(await page.getAttribute('#timer', 'data-kind') === 'math' && (await page.textContent('#timerText')).includes(String(mathS)), `${level} : chrono calcul ${mathS} s`);
      check(await page.isDisabled('[data-tab="question"]'), `${level} : pendant le calcul, pas d’indice en plus`);
      const st0 = await S(page);
      await page.evaluate(() => { const s = window.__numero.state; s.mathElapsed += window.__numero.mathLeft() - 150; });
      await page.waitForTimeout(700);
      let st = await S(page);
      check(st.phase === 'result' && st.last.timeout === true && st.stars[0] === st0.stars[0] && st.scores[0] === st0.scores[0], `${level} : calcul hors temps → pas d’étoile, pas de pénalité`);
      await page.click('#next');
      st = await S(page);
      check(st.phase === 'choose' && st.tab === 'guess' && st.turnElapsed < 1000 && await page.getAttribute('#timer', 'data-kind') === 'turn', `${level} : après le calcul, nouveau chrono pour choisir un numéro`);
      // Le joueur ne choisit pas : temps écoulé
      await page.evaluate(() => { const s = window.__numero.state; s.turnElapsed += window.__numero.turnLeft() - 150; });
      await page.waitForTimeout(700);
      st = await S(page);
      check(st.phase === 'result' && st.last.type === 'timeout' && st.scores.join() === st0.scores.join(), `${level} : pas de choix à temps → tour perdu (0 point)`);
      check(/TARD|⏱/.test(await page.textContent('.result-title')), `${level} : message « Trop tard ! »`);
      await page.click('#next');
      st = await S(page);
      check(st.turn === st0.turn + 1 && st.modal === 'handoff', `${level} : le tour passe au joueur suivant`);
      // Difficulté des calculs
      const ok = await page.evaluate(lv => { const N = window.__numero, out = []; for (let i = 0; i < 300; i++) { N.state.level = lv; N.state.screen = 'game'; N.state.phase = 'choose'; N.start(); const m = N.state.math; const txt = m.text; const val = Function('return ' + txt.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-'))(); if (val !== m.result || m.options.length !== (lv === 'expert' ? 6 : 3) || new Set(m.options).size !== m.options.length || m.options.some(o => o < 0) || !m.options.includes(m.result)) out.push(txt); if (lv === 'malin' && /^\d \+ \d$|^1\d \+ \d$/.test(txt)) out.push('trop facile ' + txt); if (lv === 'expert' && (txt.match(/[+−×÷]/g) || []).length < 2) out.push('pas assez mélangé ' + txt); } return out; }, level);
      check(ok.length === 0, `${level} : 300 calculs justes et adaptés ${ok.slice(0, 3).join(', ')}`);
    }
    await page.evaluate(() => { const N = window.__numero; N.state.level = 'junior'; N.state.players = 1; N.state.inGame = false; N.state.screen = 'home'; N.state.modal = null; N.render(); });
    await page.click('#openSettings'); await page.click('[data-timer="long"]'); await page.click('#closeSettings');
    await page.click('#start'); await page.click('[data-tab="guess"]');
    check((await page.textContent('#timerText')).includes('60'), 'Réglage « Plus de temps » : 60 s pour choisir (Petit)');
    await page.evaluate(() => { const N = window.__numero; N.state.screen = 'home'; N.render(); });
    await page.click('#openSettings'); await page.click('[data-timer="off"]'); await page.click('#closeSettings');
    await page.click('#start'); await page.waitForTimeout(400);
    check(!(await page.isVisible('#timer')), 'Réglage « Sans chrono » : aucun compte à rebours');
    check(page.errors.length === 0, 'Aucune erreur JavaScript (chronos) ' + page.errors.join(' | '));
    console.log(`${failed === before ? '✓' : '✗'} Chronos (calcul + choix du numéro), pause, difficulté des calculs`);
    await ctx.close();
  }

  // 3c) Captures animées, détective vivant, aide du carnet, animations réduites
  {
    const before = failed;
    const { ctx, page } = await fresh(browser);
    await page.evaluate(() => { const N = window.__numero; N.state.players = 1; N.state.level = 'junior'; N.start(); });
    const cls = () => page.getAttribute('.turn-card .detective-scene', 'class');
    check(/think/.test(await cls()) && /expr-curious/.test(await cls()), 'Détective : réfléchit (onglet Indice), expression curieuse');
    check((await page.textContent('.bubble .quip')).length > 3, 'Bulle de dialogue affichée : « ' + (await page.textContent('.bubble .quip')).trim() + ' »');
    await page.click('[data-tab="guess"]');
    check(await page.$$eval('.numtile.possible', e => e.length) === 0 && !(await page.$('#hints')), 'Par défaut, aucune aide : pas de numéros en vert, pas de pistes (même au niveau Petit)');
    check((await page.textContent('.pick-hint')).includes('⚡'), 'Deviner sans aide : avantage / inconvénient affichés');
    // bord : filet sur 9 → 8·9 ; sur 1 → 1·2
    await page.click('[data-guess="9"]');
    check((await page.$$eval('.numtile.in-net', els => els.map(e => e.textContent))).join() === '8,9', 'Filet (Petit) sur 9 → 8·9 (2 numéros, sans dépasser 9)');
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
    // filet raté, animé
    const miss = await page.evaluate(() => { const N = window.__numero; for (let n = 1; n <= 9; n++) if (!N.netRange(n).includes(N.state.secret)) return n; });
    await page.click('[data-tab="guess"]'); await page.click(`[data-guess="${miss}"]`); await page.click('#capNet');
    check(await page.$$eval('.numtile.hit-net', e => e.length) === 2, 'Animation du filet sur les 2 numéros');
    await page.waitForTimeout(1000);
    st = await S(page);
    check(st.last.type === 'netMiss' && st.scores[0] === 8 && /grimace/.test(await cls()) && /expr-grimace/.test(await cls()), 'Filet vide (2 numéros) −2 : grimace du détective');
    await page.click('#next');
    await page.click('[data-tab="math"]');
    check(/search/.test(await cls()), 'Détective : cherche avec sa loupe (calcul)');
    // Moyen : aide sur demande ; désactivée
    await page.evaluate(() => { const N = window.__numero; N.state.level = 'malin'; N.state.helpMode = 'auto'; N.start(); N.state.candidates = [7]; N.state.secret = 7; N.render(); });
    await page.click('[data-tab="guess"]');
    check(await page.$$eval('.numtile.possible', e => e.length) === 1 && !(await page.$('.banner.slim')), 'Aide automatique (option) : pistes en vert, mais jamais « il ne reste qu’un numéro »');
    await page.evaluate(() => { const N = window.__numero; N.state.helpMode = 'ask'; N.start(); });
    await page.click('[data-tab="guess"]');
    check(await page.$$eval('.numtile.possible', e => e.length) === 0 && await page.$('#hints'), 'Aide sur demande (option) : bouton Pistes');
    await page.click('#openNotebook');
    check(await page.isVisible('.nb-grid') && (await page.textContent('.nb-count')).includes('15'), 'Mon carnet : grille des possibles + compteur');
    await page.click('#closeModal');
    await page.evaluate(() => { const N = window.__numero; N.state.screen = 'settings'; N.state.settingsFrom = 'game'; N.render(); });
    await page.click('[data-help="off"]'); await page.click('#closeSettings');
    await page.click('[data-tab="guess"]');
    check(!(await page.$('#hints')), 'Aide désactivée : pas de pistes');
    await page.click('#openNotebook');
    check(!(await page.$('.nb-grid')) && await page.isVisible('.modal .history-items'), 'Aide désactivée : le carnet garde l’historique mais ne déduit rien');
    await page.click('#closeModal');
    // Encourager les questions : avantages/inconvénients + bonus +1
    await page.evaluate(() => { const N = window.__numero; N.state.level = 'malin'; N.state.helpMode = null; N.state.players = 1; N.start(); });
    check(await page.isVisible('.proscons .pro') && await page.isVisible('.proscons .con') && await page.isVisible('[data-tab="question"] .tab-badge'), 'Question : avantages, inconvénients et badge +1 visibles');
    await page.click('[data-tab="math"]');
    check(await page.isVisible('.mathbox .proscons') && await page.getAttribute('.gbar .brand-icon', 'class').then(c => /thinking/.test(c)) && await page.isVisible('.logo-bubble'), 'Calcul : avantages/inconvénients, et le logo « 9? » réfléchit');
    await page.evaluate(() => { const N = window.__numero; N.start(); });
    await page.click('[data-question]'); await page.click('#next');
    let sc0 = (await S(page)).scores[0];
    await page.evaluate(() => { window.__numero.state.reduceMotion = false; });
    await page.click(`[data-guess="${(await S(page)).secret}"]`); await page.click('#capPrecise');
    check(await page.isVisible('.numtile .loupe-fx'), 'Effet loupe sur le numéro au moment de la capture');
    await page.waitForTimeout(1000);
    st = await S(page);
    check(st.scores[0] - sc0 === 11 && st.last.bonus === 1 && await page.isVisible('.bonus-line') && await page.isVisible('.found-lens'), 'Question puis capture précise réussie : +10 +1 bonus = +11, grosse loupe sur le numéro attrapé');
    check((await page.textContent('.chip .delta')).includes('11') && /cheer/.test(await page.getAttribute('.gbar .brand-icon', 'class')), 'Badge +11 et logo qui fête la capture');
    await page.click('#next');
    await page.click('[data-question]'); await page.click('#next');
    sc0 = (await S(page)).scores[0];
    await page.evaluate(() => { const N = window.__numero; N.netCapture(N.state.secret); });
    st = await S(page);
    check(st.scores[0] - sc0 === 3, 'Question puis filet réussi : +2 +1 bonus = +3');
    await page.click('#next');
    sc0 = (await S(page)).scores[0];
    await page.evaluate(() => { const N = window.__numero; N.guess(N.state.secret); });
    check((await S(page)).scores[0] - sc0 === 10, 'Sans question : capture précise = +10 (pas de bonus)');
    // animations réduites
    await page.evaluate(() => { const N = window.__numero; N.state.screen = 'settings'; N.render(); });
    await page.click('#motionToggle');
    check(await page.evaluate(() => document.body.classList.contains('reduce-motion')), 'Option « Réduire les animations »');
    const an = await page.evaluate(() => getComputedStyle(document.querySelector('.detector-pupil')).animationName);
    check(an === 'none', 'Animations coupées quand l’option est active');
    check(page.errors.length === 0, 'Aucune erreur JavaScript (captures/détective/carnet) ' + page.errors.join(' | '));
    console.log(`${failed === before ? '✓' : '✗'} Captures animées, détective vivant, aide du carnet, animations réduites`);
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
    const { ctx, page } = await fresh(browser);
    await page.tap('#openSettings'); await page.waitForTimeout(500);
    const flashCheck = async label => { await page.waitForTimeout(60); const r = await page.evaluate(() => ({ cls: document.getElementById('app').classList.contains('screen-enter'), anim: [...document.querySelectorAll('#app > *')].some(el => el.getAnimations().some(a => a.animationName === 'screenIn')) })); check(!r.cls && !r.anim, `Réglages « ${label} » : pas de clignotement de l’écran`); };
    const taps = [
      ['[data-language="en"]', st => st.lang === 'en', 'English'], ['[data-language="ar"]', st => st.lang === 'ar', 'العربية'], ['[data-language="fr"]', st => st.lang === 'fr', 'Français'],
      ['#soundToggle', st => st.sound === false, 'Son coupé'], ['#soundToggle', st => st.sound === true, 'Son activé'],
      ['[data-timer="long"]', st => st.timerMode === 'long', 'Plus de temps'], ['[data-timer="off"]', st => st.timerMode === 'off', 'Sans chrono'], ['[data-timer="normal"]', st => st.timerMode === 'normal', 'Chrono normal'],
      ['[data-help="off"]', st => st.helpMode === 'off', 'Aide désactivée'], ['[data-help="auto"]', st => st.helpMode === 'auto', 'Aide auto'], ['[data-help="ask"]', st => st.helpMode === 'ask', 'Aide sur demande'],
      ['#motionToggle', st => st.reduceMotion === true, 'Animations réduites'], ['#motionToggle', st => st.reduceMotion === false, 'Animations normales'],
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
    await page.tap('#namesGo');
    const t0 = await page.textContent('.modal h2');
    check(t0.includes(`<b>Al'i</b>`), 'Prénom avec caractères spéciaux affiché tel quel (sécurité)');
    await page.tap('#handoffGo'); await page.tap('[data-tab="question"]'); await page.tap('[data-question]');
    await page.tap('#openNotebook');
    check((await page.textContent('.modal .history-items')).includes(`<b>Al'i</b>`), 'Prénom correct dans le carnet');
    check(page.errors.length === 0, 'Aucune erreur JavaScript (accueil/réglages/prénoms) ' + page.errors.join(' | '));
    console.log(`${failed === before ? '✓' : '✗'} Accueil sans défilement, réglages au toucher sans clignotement, prénoms`);
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
    await page.click('[data-players="3"]'); await page.click('[data-level="expert"]'); await page.click('#start'); await page.waitForTimeout(300); await shot(page, pre + '01b_prenoms'); await page.click('#namesGo'); await page.waitForTimeout(450);
    await shot(page, pre + '02_passe_le_telephone');
    await page.click('#handoffGo');
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
