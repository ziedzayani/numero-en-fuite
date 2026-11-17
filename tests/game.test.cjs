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
  if (lang !== 'fr') { await page.click('#openSettings'); await page.click(`[data-language="${lang}"]`); await page.click('#closeSettings'); }
  await page.click(`[data-players="${players}"]`);
  await page.click(`[data-level="${level}"]`);
  await page.click('#start');
  let st = await S(page);
  const max = MAX[level];
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
        check(st.math.options.includes(st.math.result) && new Set(st.math.options).size === 3, `${label} t${turn} : calcul avec 3 réponses dont la bonne`);
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
    // Alterne bonnes et mauvaises tentatives
    const wantRight = turn % 4 === 1 || turn % 4 === 2;
    const n = wantRight ? st.secret : (st.secret % max) + 1;
    if (st.tab !== 'guess') await page.click('#jumpguess');
    await page.click(`[data-guess="${n}"]`);
    guessCount++;
    const g = await S(page);
    const delta = g.scores[player] - st.scores[player];
    check(delta === (wantRight ? 3 : -1), `${label} t${turn} : points ${wantRight ? '+3' : '−1'} (obtenu ${delta})`);
    if (wantRight) finds++;
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
    const res = await page.evaluate(({ MAX, RANGE }) => {
      const N = window.__numero, errors = []; let informative = 0, total = 0;
      for (const level of ['junior', 'malin', 'expert']) for (let rep = 0; rep < 150; rep++) {
        const st = N.state; st.players = 1 + (rep % 4); st.level = level; N.start(); if (N.state.modal) N.state.modal = null;
        for (let i = 0; i < 40 && N.state.screen === 'game'; i++) {
          const s = N.state, max = MAX[level];
          if (!s.candidates.includes(s.secret)) errors.push('secret hors pistes ' + level);
          const qs = s.choices.map(N.qbyid);
          if (qs.some(q => !q)) errors.push('question introuvable');
          for (const q of qs) { total++; if (s.candidates.some(n => q.test(n)) && s.candidates.some(n => !q.test(n))) informative++; }
          if (/\{\w+\}/.test(qs.map(q => q.text).join())) errors.push('question non remplie');
          const r = Math.random();
          if (r < .4) N.ask(s.choices[0]);
          else if (r < .7) { N.mathAnswer(Math.random() < .7 ? s.math.result : s.math.options[0]); }
          if (N.state.phase === 'result') { const sh = N.state.last.shift; if (Math.abs(sh) > RANGE[level]) errors.push('déplacement trop grand ' + sh); N.nextTurn(); }
          if (N.state.phase !== 'choose') errors.push('phase inattendue après aide');
          const c = N.state.candidates; N.guess(c[Math.floor(Math.random() * c.length)]);
          if (N.state.phase !== 'result') errors.push('tentative refusée');
          N.nextTurn(); if (N.state.modal) N.state.modal = null;
        }
      }
      return { errors: [...new Set(errors)], informative, total };
    }, { MAX, RANGE });
    check(res.errors.length === 0, 'Simulation de 450 parties sans incohérence : ' + res.errors.join(', '));
    check(res.informative / res.total > 0.9, `Questions utiles (qui départagent les pistes) : ${Math.round(100 * res.informative / res.total)} %`);
    console.log(`${failed === before ? '✓' : '✗'} Simulation logique (450 parties) — questions utiles : ${Math.round(100 * res.informative / res.total)} %`);
    await ctx.close();
  }

  // 3) Changement de langue en cours de partie, sauvegarde, reprise, bouton Retour
  {
    const before = failed;
    const { ctx, page } = await fresh(browser);
    await page.click('[data-players="2"]'); await page.click('[data-level="malin"]'); await page.click('#start');
    await page.click('#handoffGo');
    let st = await S(page);
    await page.click(`[data-question="${st.choices[0]}"]`);
    const mid = await S(page);
    await page.click('#openSettings');
    await page.click('[data-language="ar"]');
    check(await page.evaluate(() => document.documentElement.dir) === 'rtl', 'Arabe : affichage de droite à gauche');
    await shot(page, '07_reglages_arabe');
    await page.click('#closeSettings'); await page.waitForTimeout(450);
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
    check(handled && (await S(page)).modal === 'quit', 'Retour en partie : demande de confirmation (fenêtre du jeu, pas de boîte native)');
    await page.click('#quitNo');
    check((await S(page)).screen === 'game', 'Confirmation « Non » : on reste dans la partie');
    await page.click('#quit'); await page.click('#quitYes');
    check((await S(page)).screen === 'home' && await page.isVisible('#resume'), 'Quitter : retour à l’accueil avec « Reprendre la partie »');
    await page.click('#resume');
    now = await S(page);
    check(now.screen === 'game' && now.turn === mid.turn, 'Reprise de la partie depuis l’accueil');
    await page.evaluate(() => window.__numero.back());
    await page.click('#quitYes');
    handled = await page.evaluate(() => window.__numero.back());
    check(handled === false, 'Retour sur l’accueil : l’application peut se fermer');
    check(page.errors.length === 0, 'Aucune erreur JavaScript (langue/sauvegarde) ' + page.errors.join(' | '));
    console.log(`${failed === before ? '✓' : '✗'} Langue en cours de partie, sauvegarde, reprise, bouton Retour`);
    await ctx.close();
  }

  // 3b) Chrono des calculs adapté à l'âge
  {
    const before = failed;
    const { ctx, page } = await fresh(browser);
    const ages = await page.$$eval('.level .age', els => els.map(e => e.textContent));
    check(ages.length === 3 && ages[0].includes('5') && ages[2].includes('11'), 'Âges affichés sur les niveaux : ' + ages.join(' / '));
    for (const [level, secs] of [['junior', 30], ['malin', 25], ['expert', 20]]) {
      await page.evaluate(lv => { const N = window.__numero; N.state.players = 1; N.state.level = lv; N.state.timerMode = 'normal'; N.start(); }, level);
      check(!(await page.isVisible('#mathTimer')), `${level} : le chrono n'est pas lancé avant d'ouvrir le calcul`);
      await page.click('[data-tab="math"]');
      const txt = await page.textContent('#mathTimerText');
      check(txt.includes(String(secs)), `${level} : ${secs} s pour répondre (affiché « ${txt.trim()} »)`);
      await page.waitForTimeout(1300);
      const el = await page.evaluate(() => window.__numero.state.mathElapsed);
      check(el >= 900 && el <= 2000, `${level} : le chrono avance (${el} ms)`);
      // Pause pendant la fenêtre « Quitter ? »
      await page.click('#quit'); const p0 = await page.evaluate(() => window.__numero.state.mathElapsed);
      await page.waitForTimeout(800); const p1 = await page.evaluate(() => window.__numero.state.mathElapsed);
      check(p1 === p0, `${level} : chrono en pause pendant la confirmation`);
      await page.click('#quitNo');
      const st0 = await S(page);
      await page.evaluate(() => { const s = window.__numero.state; s.mathElapsed = 1e9 - 1e9 + (window.__numero.mathLeft() + s.mathElapsed) - 150; });
      await page.waitForTimeout(700);
      const st = await S(page);
      check(st.phase === 'result' && st.last.type === 'math' && st.last.timeout === true, `${level} : temps écoulé → résultat « Temps écoulé »`);
      check(st.stars[0] === st0.stars[0] && st.scores[0] === st0.scores[0], `${level} : temps écoulé = pas d'étoile, pas de pénalité`);
      check(/TEMPS|⏱/.test(await page.textContent('.result-title')), `${level} : titre « Temps écoulé » affiché`);
      await page.click('#next');
      const after = await S(page);
      check(after.phase === 'choose' && after.tab === 'guess' && after.turn === st0.turn, `${level} : après le chrono, le joueur doit encore tenter un numéro`);
    }
    // Réglages : plus de temps / sans chrono
    await page.evaluate(() => { const N = window.__numero; N.state.level = 'junior'; N.state.screen = 'home'; N.render(); });
    await page.click('#openSettings'); await page.click('[data-timer="long"]'); await page.click('#closeSettings');
    await page.click('#start'); await page.click('[data-tab="math"]');
    check((await page.textContent('#mathTimerText')).includes('45'), 'Réglage « Plus de temps » : 45 s au niveau Petit');
    await page.evaluate(() => { const N = window.__numero; N.state.screen = 'home'; N.render(); });
    await page.click('#openSettings'); await page.click('[data-timer="off"]'); await page.click('#closeSettings');
    await page.click('#start'); await page.click('[data-tab="math"]');
    await page.waitForTimeout(400);
    check(!(await page.isVisible('#mathTimer')) && (await S(page)).phase === 'choose', 'Réglage « Sans chrono » : aucun compte à rebours');
    check(page.errors.length === 0, 'Aucune erreur JavaScript (chrono) ' + page.errors.join(' | '));
    console.log(`${failed === before ? '✓' : '✗'} Chrono des calculs (30/25/20 s, plus de temps, sans chrono, pause)`);
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
    await page.click('[data-players="3"]'); await page.click('[data-level="expert"]'); await page.click('#start'); await page.waitForTimeout(450);
    await shot(page, pre + '02_passe_le_telephone');
    await page.click('#handoffGo');
    await noOverflow(page, `Partie ${vp.tag}px`); await shot(page, pre + '03_questions');
    await page.click('[data-tab="math"]'); await page.waitForTimeout(1500); await shot(page, pre + '04_calcul');
    const st = await S(page);
    await page.click(`[data-math="${st.math.result}"]`); await page.waitForTimeout(400); await shot(page, pre + '05_calcul_reussi');
    await page.click('#next'); await page.click('#hints'); await noOverflow(page, `Grille 1-30 ${vp.tag}px`); await shot(page, pre + '06_grille_grand');
    const t = await page.$eval('[data-guess="30"]', el => el.getBoundingClientRect());
    check(t.width >= 44 && t.height >= 44, `Cases numéros 1-30 assez grandes (${Math.round(t.width)}×${Math.round(t.height)} px)`);
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
