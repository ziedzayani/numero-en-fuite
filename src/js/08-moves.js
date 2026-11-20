/*
 * Déplacements du numéro et journal de la chasse.
 * Après chaque indice ou tentative ratée, le numéro bouge. Le carnet (g.candidates)
 * subit EXACTEMENT le même déplacement : il reste toujours juste.
 */
/**
 * Défi (V8.18) : règles par difficulté, choisies par simulation (voir docs/DEFI.md).
 *   moves    sauts possibles, tirés au hasard
 *   hidden   part des décalages dont le SENS est caché (« un saut de 7… mais vers où ? »)
 *   double   part des tours où le numéro fait deux sauts d'affilée (annoncés tous les deux)
 *   freezes  gels disponibles par partie (null : un gel à chaque calcul juste)
 *   pickClue un calcul juste laisse CHOISIR sa question parmi 3 (au lieu du meilleur seuil)
 * ×2 et ×3 sont « modulo 101 » : au-delà de 100 on retire 101. Deux numéros n'arrivent jamais sur la
 * même case (l'ancien ×2 et ÷2 en fusionnaient, ce qui facilitait le jeu au lieu de le compliquer).
 */
const pm = ks =>
  ks.flatMap(k => [
    { op: '+', k },
    { op: '+', k: -k }
  ]);
const CH_RULES = {
  easy: { moves: pm([3, 5, 7]), hidden: 0, double: 0, freezes: null, pickClue: false },
  medium: {
    moves: [...pm([7, 9, 11, 13]), { op: 'mirror' }, { op: '×m', k: 2 }],
    hidden: 0.2,
    double: 0,
    freezes: 3,
    pickClue: false
  },
  hard: {
    moves: [...pm([7, 9, 11, 13]), { op: 'mirror' }, { op: '×m', k: 2 }, { op: '×m', k: 3 }],
    hidden: 0.3,
    double: 0.1,
    freezes: 1,
    pickClue: true
  }
};
const chRules = () => CH_RULES[g.chDiff] || CH_RULES.medium;
/**
 * Fonction de déplacement : nombre (décalage) ou { op: '+', k } | { op: '×', k } | { op: '÷', k } | { op: 'mirror' }
 * | { op: '×m', k } (× k modulo 101) | { op: '±', k, dir } (sens caché ; dir = vrai sens) | { op: 'seq', steps }.
 */
function moveFn(m) {
  const max = maxN();
  if (typeof m === 'number') return n => wrap(n + m, max);
  if (m.op === '+') return n => wrap(n + m.k, max);
  if (m.op === '±') return n => wrap(n + m.k * (m.dir || 1), max);
  if (m.op === '×m') return n => (n * m.k) % (max + 1) || max;
  if (m.op === 'seq') {
    const fs = m.steps.map(moveFn);
    return n => fs.reduce((x, f) => f(x), n);
  }
  if (m.op === '×') return n => wrap(n * m.k, max);
  if (m.op === '÷') return n => Math.ceil(n / m.k);
  return n => max + 1 - n;
}
/**
 * Image d'un ensemble de numéros par un saut, tel que le JOUEUR le connaît : pour un sens caché,
 * les deux sens restent possibles (union). Sert au carnet automatique et à « Décaler mes marques ».
 */
function moveImage(set, m) {
  if (m && m.op === 'seq') return m.steps.reduce((s, st) => moveImage(s, st), set);
  if (m && m.op === '±') {
    const max = maxN();
    return [...new Set(set.flatMap(n => [wrap(n + m.k, max), wrap(n - m.k, max)]))].sort((a, b) => a - b);
  }
  const f = moveFn(m);
  return [...new Set(set.map(f))].sort((a, b) => a - b);
}
/** Saut tel qu'on peut le montrer : jamais le vrai sens d'un saut caché. */
const publicShift = m =>
  m && m.op === '±'
    ? { op: '±', k: m.k }
    : m && m.op === 'seq'
      ? { op: 'seq', steps: m.steps.map(publicShift) }
      : m;
/** Déplace le secret et tous les candidats. */
function applyMove(m) {
  g.secret = moveFn(m)(g.secret);
  g.candidates = moveImage(g.candidates, m);
}
/** Défi : tire un saut selon la difficulté (sens parfois caché, parfois deux sauts). */
function drawChallengeMove() {
  const R = chRules();
  const one = () => {
    const m = { ...pick(R.moves) };
    return m.op === '+' && Math.random() < R.hidden ? { op: '±', k: Math.abs(m.k), dir: Math.sign(m.k) } : m;
  };
  return Math.random() < R.double ? { op: 'seq', steps: [one(), one()] } : one();
}
const GENIUS_MOVES = [
  { op: '+', k: 3 },
  { op: '+', k: -3 },
  { op: '+', k: 5 },
  { op: '+', k: -5 },
  { op: '×', k: 2 },
  { op: 'mirror' }
];
/** Tire le prochain déplacement (jamais nul), l'applique et l'ajoute au parcours (film). */
function nextMove() {
  if (!g.hunt) g.hunt = { start: g.secret, steps: [] };
  const from = g.secret;
  let m;
  if (g.mode === 'challenge' || g.level === 'genius') {
    // Un saut annoncé doit vraiment déplacer le numéro : ÷2 sur 1 (1 → 1) ou ×2 sur le maximum
    // (50 → 50) le laisseraient sur place ; on tire alors un autre saut.
    for (let tries = 0; tries < 20; tries++) {
      m = g.mode === 'challenge' ? drawChallengeMove() : { ...pick(GENIUS_MOVES) };
      if (moveFn(m)(g.secret) !== g.secret) break;
    }
    applyMove(m);
  } else {
    const range = g.level === 'junior' ? 1 : 2;
    m = 0;
    const draw = g.daily ? dailyRnd : rnd; // V9.21 : sauts du défi du jour identiques pour tous
    while (m === 0) m = draw(2 * range + 1) - range;
    applyShift(m);
  }
  g.hunt.steps.push({ from, to: g.secret, shift: m, ev: null });
  return m;
}
/** Ajoute g.last au carnet et l'attache à l'étape du parcours ; une capture clôt le parcours (g.lastHunt). */
function pushHist() {
  const e = { ...g.last };
  g.history.push(e);
  if (!g.hunt) g.hunt = { start: e.type === 'found' || e.type === 'netHit' ? e.n : g.secret, steps: [] };
  const st = g.hunt.steps[g.hunt.steps.length - 1];
  if (e.type === 'found' || e.type === 'netHit') {
    g.lastHunt = { start: g.hunt.start, steps: g.hunt.steps, end: e, max: maxN() };
    g.hunt = null;
    return;
  }
  if (e.frozen) {
    g.hunt.steps.push({ from: g.secret, to: g.secret, shift: 0, frozen: true, ev: e });
    return;
  }
  if (st && !st.ev) st.ev = e;
}
/** Sens d'un déplacement : −1, 0 ou +1 (pour l'animation). */
const moveDir = m => (typeof m === 'number' ? Math.sign(m) : m && m.op === '+' ? Math.sign(m.k) : 0);
/** Décalage simple ±k avec tour complet. */
function applyShift(shift) {
  g.secret = wrap(g.secret + shift, maxN());
  g.candidates = [...new Set(g.candidates.map(n => wrap(n + shift, maxN())))].sort((a, b) => a - b);
}
/** Applique un indice (garde les candidats qui le vérifient) puis fait bouger le numéro. */
function afterClue(test) {
  g.candidates = g.candidates.filter(test);
  return nextMove();
}
