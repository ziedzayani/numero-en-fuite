/*
 * Calculs adaptés à l'âge (bonne réponse = étoile + indice gratuit) et préparation d'un tour.
 *   Petit : + et − jusqu'à 10 · Moyen : retenues et tables · Grand / Génie : priorités opératoires.
 * Les mauvaises réponses proposées sont des erreurs plausibles (±1, ±10, chiffres inversés,
 * calcul fait de gauche à droite sans les priorités…).
 */

function mathText(m) {
  return m.text || `${m.a} ${m.op} ${m.b}`;
}
/** Crée le calcul du tour dans g.math : { text, result, options, threshold }. */
function makeMath() {
  let text, result;
  const r = (a, b) => a + rnd(b - a + 1);
  if (g.level === 'junior') {
    // 5–7 ans : + et − jusqu'à 10
    if (rnd(3) < 2) {
      const a = r(1, 9),
        b = r(1, 10 - a);
      text = `${a} + ${b}`;
      result = a + b;
    } else {
      const a = r(4, 10),
        b = r(1, a - 1);
      text = `${a} − ${b}`;
      result = a - b;
    }
  } else if (g.level === 'malin') {
    // 8–10 ans : retenues, tables de multiplication
    const m = rnd(3);
    if (m === 0) {
      const ua = r(2, 9),
        ub = r(10 - ua, 9);
      const a = 10 * r(1, 5) + ua,
        b = 10 * r(1, 3) + ub;
      text = `${a} + ${b}`;
      result = a + b;
    } else if (m === 1) {
      const ta = r(3, 9),
        ua = r(0, 7),
        tb = r(1, ta - 1),
        ub = r(ua + 1, 9);
      const a = 10 * ta + ua,
        b = 10 * tb + ub;
      text = `${a} − ${b}`;
      result = a - b;
    } else {
      const a = r(3, 9),
        b = r(3, 9);
      text = `${a} × ${b}`;
      result = a * b;
    }
  } else {
    // 11 ans et + : opérations mélangées (priorités), 6 propositions
    let lr = null;
    for (let tries = 0; tries < 50; tries++) {
      const m = rnd(5);
      if (m === 0) {
        const a = r(4, 9),
          b = r(3, 9),
          d = r(2, 6),
          q = r(2, 9);
        if (a * b - q < 0) continue;
        text = `${a} × ${b} − ${d * q} ÷ ${d}`;
        result = a * b - q;
        const v = (a * b - d * q) / d;
        lr = Number.isInteger(v) ? v : null;
      } else if (m === 1) {
        const b = r(2, 9),
          q = r(3, 12),
          c = r(2, 9);
        const d = r(3, Math.min(25, q * c));
        text = `${b * q} ÷ ${b} × ${c} − ${d}`;
        result = q * c - d;
        const v = (b * q) / (b * c) - d;
        lr = Number.isInteger(v) ? v : null;
      } else if (m === 2) {
        const a = r(5, 12),
          b = r(3, 9),
          c = r(3, 9),
          d = r(2, 6);
        if (a * b <= c * d) continue;
        text = `${a} × ${b} − ${c} × ${d}`;
        result = a * b - c * d;
        lr = (a * b - c) * d;
      } else if (m === 3) {
        const b = r(3, 9),
          c = r(3, 9),
          a = r(b * c + 2, 99),
          d = r(2, 9);
        text = `${a} − ${b} × ${c} + ${d}`;
        result = a - b * c + d;
        lr = (a - b) * c + d;
      } else {
        const a = r(2, 9),
          b = r(2, 9),
          c = r(3, 9),
          d = r(2, 15);
        text = `(${a} + ${b}) × ${c} − ${d}`;
        result = (a + b) * c - d;
        lr = a + b * c - d;
      }
      if (result >= 0) break;
    }
    g._lr = lr;
  }
  const deltas =
    g.level === 'junior'
      ? [1, -1, 2, -2, 3, -3]
      : ['expert', 'genius'].includes(g.level)
        ? [1, -1, 2, -2, 10, -10, 3, -3, 5, -5, 4, -4, 20, -20]
        : [1, -1, 2, -2, 10, -10, 3, -3];
  const nWrong = ['expert', 'genius'].includes(g.level) ? 5 : 2;
  const cands = shuffle(deltas).map(d => result + d);
  const sw = Number(String(result).split('').reverse().join(''));
  if (result >= 12 && sw !== result) cands.unshift(sw);
  if (['expert', 'genius'].includes(g.level) && g._lr != null && g._lr >= 0 && g._lr !== result)
    cands.unshift(g._lr);
  delete g._lr;
  const wrong = [];
  for (const c of cands) {
    if (c >= 0 && c !== result && !wrong.includes(c)) wrong.push(c);
    if (wrong.length === nWrong) break;
  }
  const threshold = pick([
    ...new Set([
      Math.floor(maxN() / 2),
      Math.floor(maxN() / 3),
      Math.ceil((maxN() * 2) / 3),
      Math.ceil((maxN() * 3) / 4)
    ])
  ]);
  g.math = { text, result, options: shuffle([result, ...wrong]), threshold };
}
/** Remet à zéro tout ce qui est propre à un tour (aide, chronos, sélection) et tire questions + calcul. */
function prepareTurn() {
  g.helpKind = null;
  g.answerElapsed = 0;
  g.answerLost = false;
  g.typed = '';
  g.sel = null;
  g.capturing = null;
  g.mathElapsed = 0;
  g.mathStarted = false;
  g.turnElapsed = 0;
  g.tab = 'question';
  g.helpUsed = false;
  g.choices = [];
  g.rerolled = false;
  g.showHints = false;
  g.showHistory = false;
  makeChoices();
  makeMath();
}
