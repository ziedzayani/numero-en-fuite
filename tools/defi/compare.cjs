// Compare l'ancien Défi (V8.17) et le nouveau (V8.18) sur 3 000 parties par cas.
//   node tools/defi/compare.cjs
// Joueurs : calculatrice 100 %, calculs 70 %, questions, captures sans indice, filet malin ;
// croyance « exact » (carnet parfait / « Décaler mes marques ») ou « interval » (de tête).
// Voir docs/DEFI.md pour la lecture des résultats.
const { play, stats, CURRENT_MOVES, pick } = require('./model.cjs');
const N = 3000,
  sh = ks =>
    ks.flatMap(k => [
      { op: '+', k },
      { op: '+', k: -k }
    ]);
const hide = (m, p) => (m.op === '+' && Math.random() < p ? { op: '±', k: Math.abs(m.k) } : m);
const SETS = {
  actuel: {
    Facile: { moves: () => pick(CURRENT_MOVES), level: 'junior', mathClue: 'median' },
    Moyen: { moves: () => pick(CURRENT_MOVES), level: 'malin', mathClue: 'median' },
    Difficile: { moves: () => pick(CURRENT_MOVES), level: 'expert', mathClue: 'median' }
  },
  propose: {
    Facile: { moves: () => pick(sh([3, 5, 7])), level: 'junior', mathClue: 'median', optionalCapture: true },
    Moyen: {
      moves: () => hide(pick([...sh([7, 9, 11, 13]), { op: 'mirror' }, { op: '×101', k: 2 }]), 0.2),
      level: 'malin',
      mathClue: 'median',
      freeze: 3,
      optionalCapture: true
    },
    Difficile: {
      moves: () =>
        hide(
          pick([...sh([7, 9, 11, 13]), { op: 'mirror' }, { op: '×101', k: 2 }, { op: '×101', k: 3 }]),
          0.3
        ),
      level: 'expert',
      mathClue: 'choose',
      freeze: 1,
      doubleMoveRate: 0.1,
      optionalCapture: true
    }
  }
};
const PL = {
  'calculatrice 100 %': { clue: 'math', p: 1, net: 'full' },
  'calculs 70 %': { clue: 'math', p: 0.7, net: 'full' },
  questions: { clue: 'question', net: 'full' },
  'captures sans indice': { clue: 'none', net: 'never' },
  'filet malin': { clue: 'math', p: 1, net: 'smart' }
};
const res = {};
for (const belief of ['exact', 'interval'])
  for (const [sn, set] of Object.entries(SETS))
    for (const d of Object.keys(set))
      for (const [pn, P] of Object.entries(PL)) {
        const runs = Array.from({ length: N }, () => play(set[d], { ...P, belief }, 40));
        const v = stats(runs);
        // contre la montre : 17 s par tour, +15 s (V8.17) ou +8 s (V8.18) rendues par calcul juste, 180 s au départ
        const timed =
          runs.filter(r => r.won && 17 * r.turn - (sn === 'actuel' ? 15 : 8) * (r.goodMath || 0) <= 180)
            .length / N;
        res[`${belief}|${sn}|${d}|${pn}`] = {
          win40: v.win,
          mean: v.mean,
          med: v.med ?? '-',
          p90: v.p90 ?? '-',
          'tours≥15': v.ge15,
          chance: v.lucky,
          score: v.score ?? 0,
          perdFil: v.lost,
          chrono: +timed.toFixed(2)
        };
      }
for (const belief of ['exact', 'interval']) {
  console.log('\n=== ' + belief + ' ===');
  console.table(
    Object.fromEntries(
      Object.entries(res)
        .filter(([k]) => k.startsWith(belief))
        .map(([k, v]) => [k.slice(belief.length + 1), v])
    )
  );
}
