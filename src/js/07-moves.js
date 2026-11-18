/*
 * Déplacements du numéro et journal de la chasse.
 * Après chaque indice ou tentative ratée, le numéro bouge. Le carnet (g.candidates)
 * subit EXACTEMENT le même déplacement : il reste toujours juste.
 */
const CH_MOVES = [
  { op: '+', k: 7 },
  { op: '+', k: -7 },
  { op: '+', k: 11 },
  { op: '+', k: -13 },
  { op: '+', k: 9 },
  { op: '×', k: 2 },
  { op: '÷', k: 2 },
  { op: 'mirror' }
];
/** Fonction de déplacement : nombre (décalage) ou { op: '+', k } | { op: '×', k } | { op: '÷', k } | { op: 'mirror' }. */
function moveFn(m) {
  const max = maxN();
  if (typeof m === 'number') return n => wrap(n + m, max);
  if (m.op === '+') return n => wrap(n + m.k, max);
  if (m.op === '×') return n => wrap(n * m.k, max);
  if (m.op === '÷') return n => Math.ceil(n / m.k);
  return n => max + 1 - n;
}
/** Déplace le secret et tous les candidats. */
function applyMove(m) {
  const f = moveFn(m);
  g.secret = f(g.secret);
  g.candidates = [...new Set(g.candidates.map(f))].sort((a, b) => a - b);
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
    m = { ...pick(g.mode === 'challenge' ? CH_MOVES : GENIUS_MOVES) };
    applyMove(m);
  } else {
    const range = g.level === 'junior' ? 1 : 2;
    m = 0;
    while (m === 0) m = rnd(2 * range + 1) - range;
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
