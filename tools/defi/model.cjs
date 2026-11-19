// Modèle du mode Défi (1–100) pour tester des règles sans toucher au jeu.
// Validé contre le vrai moteur (règles V8.17, 120 parties par cas) : écart < 0,2 tour sur la moyenne.
// Les règles V8.18 du jeu sont vérifiées, elles, par tests/game.test.cjs (équilibrage sur le moteur).
'use strict';
const MAX = 100;
const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
const shuffle = a => {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const wrap = n => ((n - 1 + MAX * 500) % MAX) + 1;
const ALL = Array.from({ length: MAX }, (_, i) => i + 1);

// ---- déplacements ----
function moveFn(m) {
  if (m.op === '+') return n => wrap(n + m.k);
  if (m.op === '×') return n => wrap(n * m.k); // actuel : 2 → 1 (perd de l'incertitude)
  if (m.op === '÷') return n => Math.ceil(n / m.k); // actuel : 2 → 1
  if (m.op === '×101') return n => (n * m.k) % 101; // bijectif sur 1..100 (101 premier)
  if (m.op === 'mirror') return n => MAX + 1 - n;
  if (m.op === 'seq') {
    const fs = m.steps.map(moveFn);
    return n => fs.reduce((x, f) => f(x), n);
  }
  if (m.op === '±') return n => wrap(n + m.k * (m.dir || 1));
  throw new Error('op ' + m.op);
}
const CURRENT_MOVES = [
  { op: '+', k: 7 },
  { op: '+', k: -7 },
  { op: '+', k: 11 },
  { op: '+', k: -13 },
  { op: '+', k: 9 },
  { op: '×', k: 2 },
  { op: '÷', k: 2 },
  { op: 'mirror' }
];

// ---- questions (port de qpool pour max = 100) ----
function qpool(level) {
  const max = MAX,
    pool = [];
  const add = (id, type, test) => pool.push({ id, type, test });
  for (let k = 2; k < max; k++) {
    add('above' + k, 'cmp', n => n > k);
    add('below' + k, 'cmp', n => n < k);
  }
  add('even', 'trick', n => n % 2 === 0);
  add('odd', 'trick', n => n % 2 !== 0);
  for (let k = 1; k <= 3; k++)
    for (let v = 4; v <= max + 3; v += 2) add(`plus${k}_${v}`, 'math', n => n + k > v);
  for (let k = 4; k <= max * 2 - 2; k += 2) add('double' + k, 'math', n => 2 * n > k);
  const width = Math.max(4, Math.round(max / 4));
  for (let a = 2; a + width - 1 <= max; a += 2) {
    const b = a + width - 1;
    add(`range${a}`, 'range', n => n >= a && n <= b);
  }
  if (level !== 'junior') {
    add('mult3', 'trick', n => n % 3 === 0);
    for (let k = 1; k <= 3; k++)
      for (let v = 2; v <= max - 2; v += 2) add(`minus${k}_${v}`, 'math', n => n - k >= v);
  }
  if (level === 'expert') {
    for (const k of [4, 5, 6]) add('mult' + k, 'div', n => n % k === 0);
    for (const k of [4, 6, 8, 10])
      add(
        'ds' + k,
        'digits',
        n =>
          String(n)
            .split('')
            .reduce((a, b) => a + +b, 0) > k
      );
    const r = Math.max(4, Math.round(max / 8));
    for (const c of [10, 15, 20, 25, 30, 35, 40]) add(`near${c}`, 'dist', n => Math.abs(n - c) < r);
  }
  return pool;
}
const POOLS = { junior: qpool('junior'), malin: qpool('malin'), expert: qpool('expert') };
/** 3 questions de types différents, chacune utile pour les candidats réels C (comme makeChoices). */
function choices(level, C, shown) {
  const pool = POOLS[level];
  let unused = pool.filter(q => !shown.has(q.id));
  if (unused.length < 3) {
    shown.clear();
    unused = pool;
  }
  const ok = q => C.some(n => q.test(n)) && C.some(n => !q.test(n));
  const cands = shuffle(unused.filter(ok));
  const chosen = [],
    types = new Set();
  for (const q of cands) {
    if (!types.has(q.type)) {
      chosen.push(q);
      types.add(q.type);
    }
    if (chosen.length >= 3) break;
  }
  for (const q of cands) {
    if (chosen.length >= 3) break;
    if (!chosen.includes(q)) chosen.push(q);
  }
  chosen.forEach(q => shown.add(q.id));
  return chosen;
}

// ---- croyance du joueur ----
// 'exact'   : connaît exactement l'ensemble des possibles (carnet parfait / bouton « Décaler »)
// 'interval': ne retient qu'un intervalle [lo, hi] (un enfant sans carnet) ; un saut qui éparpille
//             l'intervalle (×2, ×3…) ou le coupe au bord (on repart à 1) lui fait perdre l'info.
function beliefMove(B, m, mode) {
  if (mode === 'exact') return imageSet(B, m);
  if (m.op === 'seq') {
    for (const s of m.steps) B = beliefMove(B, s, mode);
    return B;
  }
  if (m.op === '±') {
    const lo = B[0] - m.k,
      hi = B[B.length - 1] + m.k;
    return lo >= 1 && hi <= MAX ? range(lo, hi) : ALL.slice();
  }
  const lo = B[0],
    hi = B[B.length - 1],
    f = moveFn(m);
  if (m.op === '+') {
    const a = lo + m.k,
      b = hi + m.k;
    if (a >= 1 && b <= MAX) return range(a, b);
    return ALL.slice(); // a franchi le bord : l'enfant « perd le fil »
  }
  if (m.op === 'mirror') return range(MAX + 1 - hi, MAX + 1 - lo);
  if (m.op === '÷') return range(Math.ceil(lo / m.k), Math.ceil(hi / m.k));
  // ×k : intervalle conservé seulement s'il ne déborde pas (sinon éparpillé)
  if (hi * m.k <= MAX) return range(lo * m.k, hi * m.k);
  return ALL.slice();
}
function imageSet(S, m) {
  if (m.op === 'seq') {
    for (const x of m.steps) S = imageSet(S, x);
    return S;
  }
  if (m.op === '±') return [...new Set(S.flatMap(n => [wrap(n + m.k), wrap(n - m.k)]))].sort((a, b) => a - b);
  return [...new Set(S.map(moveFn(m)))].sort((a, b) => a - b);
}
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
function beliefFilter(B, test, mode) {
  const f = B.filter(test);
  if (mode === 'exact' || !f.length) return f.length ? f : B;
  return range(f[0], f[f.length - 1]); // garde l'enveloppe
}

// ---- une partie ----
/**
 * R = règles : { moves(turn) → déplacement, level, freeze: Infinity|n, mathClue: 'median'|'choose',
 *                optionalCapture, doubleMoveRate, nets }
 * P = joueur : { clue: 'math'|'question'|'none', p, net: 'full'|'smart'|'never', belief: 'exact'|'interval' }
 */
function play(R, P, cap = 60) {
  let secret = 1 + rnd(MAX),
    C = ALL.slice(),
    B = ALL.slice();
  let turn = 0,
    nets = R.nets ?? 3,
    freezes = R.freeze ?? Infinity,
    maths = 0,
    goodMath = 0,
    wrongMath = 0,
    questions = 0,
    misses = 0,
    netMiss = 0,
    netsUsed = 0,
    luck = null,
    lost = 0;
  const shown = new Set();
  const doMove = () => {
    let m = R.moves();
    if (R.doubleMoveRate && Math.random() < R.doubleMoveRate) m = { op: 'seq', steps: [m, R.moves()] };
    if (m.op === '±') m = { ...m, dir: Math.random() < 0.5 ? 1 : -1 };
    if (m.op === 'seq')
      m = { ...m, steps: m.steps.map(x => (x.op === '±' ? { ...x, dir: Math.random() < 0.5 ? 1 : -1 } : x)) };
    const f = moveFn(m);
    // comme le moteur : un saut doit vraiment déplacer le numéro
    for (let i = 0; i < 20 && f(secret) === secret; i++) return doMove();
    secret = f(secret);
    C = imageSet(C, m);
    const before = B.length;
    B = beliefMove(B, m, P.belief);
    // la croyance doit rester compatible avec la réalité (l'enfant peut se tromper : on la recale sur ALL)
    if (!B.includes(secret)) B = ALL.slice();
    if (B.length === MAX && before < MAX) lost++;
  };
  const coverage = (S, n) => {
    const a = Math.min(Math.max(1, n - 1), MAX - 2);
    return [a, a + 1, a + 2].filter(x => S.includes(x)).length;
  };
  const bestNet = S => {
    let bn = S[0],
      bc = -1;
    for (const n of S) {
      const c = coverage(S, n);
      if (c > bc) {
        bc = c;
        bn = n;
      }
    }
    return [bn, bc];
  };
  const wantsNet = S => {
    if (!nets || S.length < 2) return false;
    const [, c] = bestNet(S);
    return P.net === 'full'
      ? c === S.length
      : P.net === 'smart'
        ? c === S.length || c / S.length >= 0.5
        : false;
  };
  while (turn < cap) {
    turn++;
    // 1) indice (sauf si le joueur peut déjà conclure)
    if (B.length > 1 && !wantsNet(B) && P.clue !== 'none') {
      if (P.clue === 'math') {
        maths++;
        if (Math.random() < P.p) {
          goodMath++;
          let test;
          if (R.mathClue === 'choose') {
            const qs = choices(R.level, C, shown);
            if (!qs.length) qs.push({ test: () => true });
            const q = qs.reduce(
              (best, q) => {
                const y = B.filter(q.test).length,
                  s = Math.min(y, B.length - y);
                return s > best.s ? { q, s } : best;
              },
              { q: qs[0], s: -1 }
            ).q;
            const ans = q.test(secret);
            test = n => q.test(n) === ans;
          } else {
            const s = C.length > 1 ? C[Math.floor((C.length - 1) / 2)] : 50,
              ans = secret > s;
            test = n => n > s === ans;
          }
          C = C.filter(test);
          B = beliefFilter(B, test, P.belief);
          if (freezes > 0) freezes--;
          else doMove();
        } else {
          wrongMath++;
          doMove();
        }
      } else {
        questions++;
        const qs = choices(R.level, C, shown);
        if (!qs.length) qs.push({ test: () => true });
        const q = qs.reduce(
          (best, q) => {
            const y = B.filter(q.test).length,
              s = Math.min(y, B.length - y);
            return s > best.s ? { q, s } : best;
          },
          { q: qs[0], s: -1 }
        ).q;
        const ans = q.test(secret),
          test = n => q.test(n) === ans;
        C = C.filter(test);
        B = beliefFilter(B, test, P.belief);
        doMove();
      }
    }
    // 2) capture
    if (
      R.optionalCapture &&
      P.clue !== 'none' &&
      B.length > 3 &&
      !(B.length <= 6 && P.net === 'smart' && nets)
    ) {
      doMove();
      continue;
    } // « je laisse filer » : pas de pénalité, le numéro bouge
    let hit;
    if (wantsNet(B)) {
      const [n, c] = bestNet(B);
      nets--;
      netsUsed++;
      const a = Math.min(Math.max(1, n - 1), MAX - 2),
        nums = [a, a + 1, a + 2];
      hit = nums.includes(secret);
      luck = c / B.length;
      if (!hit) {
        netMiss++;
        C = C.filter(x => !nums.includes(x));
        B = B.filter(x => !nums.includes(x));
        if (!B.length) B = ALL.slice();
        doMove();
      }
    } else {
      const g = pick(B);
      hit = g === secret;
      luck = 1 / B.length;
      if (!hit) {
        misses++;
        C = C.filter(x => x !== g);
        B = B.filter(x => x !== g);
        if (!B.length) B = ALL.slice();
        doMove();
      }
    }
    if (hit) {
      const S = {
        start: 1000,
        perTurn: 45,
        question: 5,
        wrongMath: 10,
        goodMath: 10,
        miss: 20,
        netMiss: 40,
        netWin: 50
      };
      let score =
        S.start -
        S.perTurn * (turn - 1) -
        S.question * questions -
        S.wrongMath * wrongMath +
        S.goodMath * goodMath -
        S.miss * misses -
        S.netMiss * netMiss;
      return { won: true, turn, score: Math.max(0, score), luck, maths, goodMath, netsUsed, lost };
    }
  }
  return { won: false, turn, score: 0, luck: null, maths, netsUsed, lost };
}

function stats(runs) {
  const w = runs.filter(r => r.won),
    t = w.map(r => r.turn).sort((a, b) => a - b),
    q = f => t[Math.floor(t.length * f)];
  const avg = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
  const sc = w.map(r => r.score).sort((a, b) => a - b);
  return {
    win: +(w.length / runs.length).toFixed(3),
    mean: +avg(t).toFixed(2),
    med: q(0.5),
    p10: q(0.1),
    p90: q(0.9),
    le4: +(t.filter(x => x <= 4).length / runs.length).toFixed(2),
    ge15: +(runs.filter(r => !r.won || r.turn >= 15).length / runs.length).toFixed(3),
    score: sc[Math.floor(sc.length / 2)],
    lucky: +(w.filter(r => r.luck < 1 / 3).length / (w.length || 1)).toFixed(2),
    maths: +avg(runs.map(r => r.maths)).toFixed(1),
    nets: +avg(runs.map(r => r.netsUsed)).toFixed(2),
    lost: +avg(runs.map(r => r.lost)).toFixed(2)
  };
}
module.exports = { play, stats, CURRENT_MOVES, pick, moveFn, ALL, imageSet };
