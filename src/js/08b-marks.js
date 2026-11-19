/*
 * Carnet d'enquête « à la main » (V8.14) : c'est l'ENFANT qui barre les numéros.
 *
 * Le carnet automatique (g.candidates) existe toujours pour l'aide « numéros possibles » ;
 * ici, rien n'est barré tout seul. Chaque joueur a ses propres marques :
 *   g.marks[joueur] = { gid, cap, step, out: [numéros barrés] }
 *     gid  : partie à laquelle appartiennent les marques (nouvelle partie → carnet vierge) ;
 *     cap  : nombre de captures au moment des marques (Course : nouveau numéro → carnet vierge) ;
 *     step : nombre de déplacements du parcours déjà appliqués aux marques.
 * Quand le numéro bouge, les marques NE bougent PAS d'elles-mêmes : le bouton « Décaler mes marques »
 * applique les sauts en attente (±k, ×2, ÷2, miroir) exactement comme pour le vrai numéro.
 * En Wi-Fi, les marques restent sur le téléphone de chacun (NET_LOCAL_KEYS).
 */

/** Joueur dont on affiche le carnet : celui de CE téléphone en Wi-Fi, sinon celui dont c'est le tour. */
const marksOwner = () => (g.net && Number.isInteger(g.net.seat) ? g.net.seat : active());
/**
 * Sauts du numéro en cours : g.hunt chez l'arbitre (solo, un téléphone, hôte Wi-Fi) ;
 * g.huntPublic chez un joueur Wi-Fi (seulement le type de saut, jamais la position).
 */
const publicSteps = () =>
  g.hunt && Array.isArray(g.hunt.steps) ? g.hunt.steps : Array.isArray(g.huntPublic) ? g.huntPublic : [];
const huntSteps = () => publicSteps().length;

/** Marques du joueur pour le numéro EN COURS (remises à zéro si la partie ou le numéro a changé). */
function marksOf(p = marksOwner()) {
  if (!Array.isArray(g.marks)) g.marks = [];
  const m = g.marks[p];
  if (!m || m.gid !== g.gameId || m.cap !== g.captures || !Array.isArray(m.out) || m.step > huntSteps())
    g.marks[p] = { gid: g.gameId, cap: g.captures, step: huntSteps(), out: [] };
  return g.marks[p];
}
/** Sauts que le joueur n'a pas encore appliqués à ses marques (le « gel » du Défi ne compte pas). */
function pendingMoves(p = marksOwner()) {
  const m = marksOf(p);
  return publicSteps()
    .slice(m.step)
    .map(s => s.shift)
    .filter(s => s !== 0);
}
/**
 * Point de départ d'un carnet vierge : l'étape du DERNIER indice (ou tentative ratée).
 * Un indice décrit la place du numéro AVANT le saut qui le suit : ce saut reste donc à appliquer.
 */
function lastClueStep() {
  const steps = publicSteps();
  for (let i = steps.length - 1; i >= 0; i--) if (steps[i].ev) return i;
  return steps.length;
}
/** Numéros que le joueur considère encore possibles. */
function marksPossible(p = marksOwner()) {
  const out = new Set(marksOf(p).out);
  return all(maxN()).filter(n => !out.has(n));
}
/** Barre / rétablit des numéros. Premières marques : elles partent du dernier indice. */
function toggleMarks(nums, cross) {
  const m = marksOf(),
    out = new Set(m.out);
  if (!out.size) m.step = lastClueStep();
  for (const n of nums) {
    if (n < 1 || n > maxN()) continue;
    if (cross) out.add(n);
    else out.delete(n);
  }
  m.out = [...out].sort((a, b) => a - b);
}
function toggleMark(n) {
  toggleMarks([n], !marksOf().out.includes(n));
}
/** Plage a–b : tout barrer, ou tout rétablir si elle l'est déjà entièrement. */
function toggleRange(a, b) {
  const nums = all(maxN()).filter(n => n >= a && n <= b),
    out = new Set(marksOf().out);
  toggleMarks(nums, !nums.every(n => out.has(n)));
}
/** « Décaler mes marques » : applique les sauts en attente aux numéros encore possibles. */
function shiftMarks() {
  const m = marksOf(),
    moves = pendingMoves();
  if (!moves.length) return false;
  let possible = marksPossible();
  for (const mv of moves) possible = [...new Set(possible.map(moveFn(mv)))];
  const keep = new Set(possible);
  m.out = all(maxN()).filter(n => !keep.has(n));
  m.step = huntSteps();
  g.usedShift = true; // mission « Décale tes marques » (V8.15)
  return true;
}
function clearMarks() {
  const m = marksOf();
  m.out = [];
  m.step = huntSteps();
}
