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
  for (let a = 2; a < max - 1; a += 2) {
    const b = Math.min(a + 3, max);
    add(`range_${a}`, 'typeRange', '🎯', 'qBetween', { a, b }, n => n >= a && n <= b);
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
    for (const k of [10, 15, 20, 25])
      add(`near${k}`, 'typeDistance', '📍', 'qNear', { k }, n => Math.abs(n - k) < 4);
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
  let candidates = shuffle(unused.filter(qualifies));
  if (candidates.length < 3)
    candidates = candidates.concat(
      shuffle(
        pool.filter(q => qualifies(q) && !g.choices.includes(q.id) && !candidates.some(c => c.id === q.id))
      )
    );
  if (candidates.length < 3)
    candidates = candidates.concat(shuffle(unused.filter(q => !candidates.some(c => c.id === q.id))));
  const chosen = [];
  const types = new Set();
  for (const q of candidates) {
    if (!types.has(q.type)) {
      chosen.push(q);
      types.add(q.type);
    }
    if (chosen.length >= 3) break;
  }
  for (const q of candidates) {
    if (chosen.length >= 3) break;
    if (!chosen.some(c => c.id === q.id)) chosen.push(q);
  }
  g.choices = chosen.slice(0, 3).map(q => q.id);
  g.shownIds.push(...g.choices);
}
