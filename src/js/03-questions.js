/*
 * Questions-indices (« Est-il plus grand que 7 ? »…).
 * Chaque tour propose 3 questions de types différents, toutes UTILES : chacune
 * sépare les numéros encore possibles en deux groupes non vides.
 */

/** Toutes les questions possibles pour le niveau : { id, type, icon, text, test(n) }. */
function qpool() {
  const max = maxN(),
    pool = [];
  const add = (id, type, icon, key, values, test) =>
    pool.push({ id, type: t(type), icon, text: t(key, values), test });
  for (let k = 2; k < max; k++) {
    add(`above${k}`, 'typeCompare', '📏', 'qGreater', { k }, n => n > k);
    add(`below${k}`, 'typeCompare', '🔎', 'qLess', { k }, n => n < k);
  }
  add('even', 'typeTrick', '🟣', 'qEven', {}, n => n % 2 === 0);
  add('odd', 'typeTrick', '🟡', 'qOdd', {}, n => n % 2 !== 0);
  for (let k = 1; k <= 3; k++)
    for (let v = 4; v <= max + 3; v += 2)
      add(`plus${k}_${v}`, 'typeMath', '➕', 'qPlus', { k, v }, n => n + k > v);
  for (let k = 4; k <= max * 2 - 2; k += 2)
    add(`double_${k}`, 'typeMath', '✖️', 'qDouble', { k }, n => 2 * n > k);
  // Intervalle ≈ un quart des numéros, et au moins 2 fois le filet (V8.17) : « entre 10 et 13 » + filet
  // de 3 gagnait presque à coup sûr ; « entre 10 et 15 » laisse encore une vraie enquête.
  const width = Math.max(2 * netSize(), Math.round(max / 4));
  for (let a = 2; a + width - 1 <= max; a += 2) {
    const b = a + width - 1;
    add(`range${width}_${a}`, 'typeRange', '🎯', 'qBetween', { a, b }, n => n >= a && n <= b);
  }
  if (g.level !== 'junior') {
    add('mult3', 'typeTrick', '🧩', 'qMult3', {}, n => n % 3 === 0);
    for (let k = 1; k <= 3; k++)
      for (let v = 2; v <= max - 2; v += 2)
        add(`minus${k}_${v}`, 'typeMath', '➖', 'qMinus', { k, v }, n => n - k >= v);
  }
  if (['expert', 'genius'].includes(g.level)) {
    for (const k of [4, 5, 6]) add(`mult${k}`, 'typeDiv', '🧠', 'qMultiple', { k }, n => n % k === 0);
    for (const k of [4, 6, 8, 10])
      add(
        `digitsum${k}`,
        'typeDigits',
        '🔢',
        'qDigitSum',
        { k },
        n =>
          String(n)
            .split('')
            .reduce((a, b) => a + Number(b), 0) > k
      );
    // « proche de k » : écart proportionnel au niveau (4 en Grand, 6 en Génie)
    const r = Math.max(4, Math.round(max / 8));
    for (const c of [10, 15, 20, 25, 30, 35, 40].filter(x => x + r <= max))
      add(`near${r}_${c}`, 'typeDistance', '📍', 'qNear', { k: c, r }, n => Math.abs(n - c) < r);
  }
  return pool;
}
/** Question à partir de son identifiant (stable, sauvegardé dans l'historique). */
function qbyid(id) {
  return qpool().find(q => q.id === id);
}
/** Choisit les 3 questions du tour dans g.choices (en évitant celles déjà montrées). */
function makeChoices() {
  const pool = qpool();
  let unused = pool.filter(q => !g.shownIds.includes(q.id));
  if (unused.length < 3) {
    g.shownIds = [];
    unused = pool;
  }
  const qualifies = q => g.candidates.some(n => q.test(n)) && g.candidates.some(n => !q.test(n));
  // V8.17 : une question ne doit pas, à elle seule, réduire les possibles à la portée du filet.
  // On propose d'abord celles qui laissent au moins 2 × filet numéros quelle que soit la réponse,
  // puis (fin d'enquête) celles qui en laissent le plus.
  const side = q => {
    const yes = g.candidates.filter(n => q.test(n)).length;
    return Math.min(yes, g.candidates.length - yes);
  };
  const safe = 2 * netSize();
  const byTier = list => {
    const sh = shuffle(list);
    const strong = sh.filter(q => side(q) >= safe);
    if (strong.length >= 3) return strong;
    return strong.concat(sh.filter(q => side(q) < safe).sort((a, b) => side(b) - side(a)));
  };
  let candidates = byTier(unused.filter(qualifies));
  if (candidates.length < 3)
    candidates = candidates.concat(
      byTier(
        pool.filter(q => qualifies(q) && !g.choices.includes(q.id) && !candidates.some(c => c.id === q.id))
      )
    );
  if (candidates.length < 3)
    candidates = candidates.concat(shuffle(unused.filter(q => !candidates.some(c => c.id === q.id))));
  // types variés, mais jamais une question « trop forte » à la place d'une sûre
  const chosen = [];
  const types = new Set();
  const safeOnes = candidates.filter(q => g.candidates.length && qualifies(q) && side(q) >= safe);
  for (const group of [safeOnes, candidates]) {
    for (const q of group) {
      if (chosen.length >= 3) break;
      if (!types.has(q.type) && !chosen.includes(q)) {
        chosen.push(q);
        types.add(q.type);
      }
    }
    for (const q of group) {
      if (chosen.length >= 3) break;
      if (!chosen.includes(q)) chosen.push(q);
    }
  }
  g.choices = chosen.slice(0, 3).map(q => q.id);
  g.shownIds.push(...g.choices);
}
