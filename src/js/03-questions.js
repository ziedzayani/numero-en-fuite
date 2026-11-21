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
/**
 * V9.26 : nombre minimal de numéros de chaque côté d'une question, sur la plage entière du niveau
 * (1 sur 1–9, 2 sur 1–15, 4 sur 1–30, 6 sur 1–50, 12 sur 1–100).
 */
const questionMinSide = (max = maxN()) => Math.max(1, Math.round(max * QUESTION_MIN_SIDE));
/**
 * V9.26 : questions PROPOSABLES pour la plage — celles dont le seuil n'est pas collé à une limite
 * (sinon la réponse est presque toujours la même et l'autre réponse révèle un numéro d'un coup).
 * Même règle pour toutes les catégories (comparaison, +, −, double, multiples, chiffres, proche de…).
 */
function qpoolBalanced() {
  const max = maxN(),
    min = questionMinSide(max),
    range = Array.from({ length: max }, (_, i) => i + 1);
  return qpool().filter(q => {
    const yes = range.filter(n => q.test(n)).length;
    return yes >= min && max - yes >= min;
  });
}
/** Choisit les 3 questions du tour dans g.choices (en évitant celles déjà montrées). */
function makeChoices() {
  // V9.22 : en équipes, les questions utiles se calculent avec ce que SAIT l'équipe du joueur actif
  if (isTeams() && !makeChoices.inner) {
    const full = g.candidates;
    g.candidates = teamCandidates(teamOf(active()));
    makeChoices.inner = true;
    try {
      makeChoices();
    } finally {
      makeChoices.inner = false;
      g.candidates = full;
    }
    return;
  }
  const pool = qpoolBalanced();
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
  g.choices = coverChoices(chosen.slice(0, 3), candidates, pool).map(q => q.id);
  g.shownIds.push(...g.choices);
}
/**
 * V9.15 : « au moins une question à réponse OUI », sans rien révéler.
 * Les 3 questions doivent COUVRIR tous les numéros encore possibles : quel que soit le numéro caché,
 * au moins une répond OUI. Le trio ne dépend donc pas du numéro caché (aucune déduction gratuite,
 * contrairement à « remplacer une question si les 3 répondent NON », qui éliminerait des numéros).
 * OUI/OUI/OUI, OUI/OUI/NON et OUI/NON/NON restent possibles.
 */
function coverChoices(chosen, ordered, pool) {
  const cands = g.candidates.length ? g.candidates : [g.secret];
  const covers = qs => cands.every(n => qs.some(q => q.test(n)));
  if (chosen.length < 3 || covers(chosen)) return chosen;
  if (cands.length < 2) {
    // un seul numéro possible : aucune question ne peut plus couper en deux ; une question vraie suffit
    const yes = shuffle(pool).find(q => !chosen.includes(q) && q.test(cands[0]));
    return yes ? [chosen[0], chosen[1], yes] : chosen;
  }
  const useful = q => g.candidates.some(n => q.test(n)) && g.candidates.some(n => !q.test(n));
  // comme makeChoices : d'abord les questions « fortes » (au moins 2 × filet numéros de chaque côté)
  const side = q => {
    const yes = g.candidates.filter(n => q.test(n)).length;
    return Math.min(yes, g.candidates.length - yes);
  };
  const every = [...ordered, ...shuffle(pool.filter(q => useful(q) && !ordered.includes(q)))].filter(useful);
  // V9.30 : à force égale, d'abord les questions pas encore montrées (variété, surtout en 1–9)
  const seen = q => g.shownIds.includes(q.id);
  const freshFirst = list => [...list.filter(q => !seen(q)), ...list.filter(seen)];
  const pref = [
    ...freshFirst(every.filter(q => side(q) >= 2 * netSize())),
    ...freshFirst(every.filter(q => side(q) < 2 * netSize()))
  ];
  const fresh = q => !chosen.includes(q);
  const safe2 = () => 2 * netSize();
  const strong = q => side(q) >= safe2();
  const keep = chosen.slice(0, 2),
    head = chosen[0],
    rest = cands.filter(n => !head.test(n));
  const tryTier = list => {
    // 1) on garde les deux premières, la troisième couvre ce qui manque
    const third = list.find(q => fresh(q) && covers([...keep, q]));
    if (third) return [...keep, third];
    // 2) on garde la première, on cherche une paire qui couvre le reste
    const sub = list.filter(q => fresh(q) && rest.some(n => q.test(n))).slice(0, 60);
    for (let i = 0; i < sub.length; i++)
      for (let j = i + 1; j < sub.length; j++)
        if (rest.every(n => sub[i].test(n) || sub[j].test(n))) return [head, sub[i], sub[j]];
    return null;
  };
  // 3) toujours possible : « plus grand que k » et « plus petit que k+1 » couvrent tout ;
  //    k coupe les numéros possibles le plus près possible de la moitié
  const full = qpool();
  // V9.26 : d'abord avec les questions proposables ; en fin d'enquête près d'une limite, avec toutes
  // (une question très précise est alors légitime) : la paire couvre toujours tous les possibles
  const splitIn = list => {
    let best = null;
    for (let k = 2; k <= maxN() - 2; k++) {
      const a = list.find(q => q.id === `above${k}`),
        b = list.find(q => q.id === `below${k + 1}`);
      if (!a || !b || !useful(a)) continue;
      if (!best || side(a) > side(best[0])) best = [a, b];
    }
    if (!best) return null;
    const other = chosen.find(q => q.id !== best[0].id && q.id !== best[1].id);
    return other ? [best[0], best[1], other] : null;
  };
  const unseen = list => list.filter(q => !seen(q));
  const split = () => splitIn(unseen(pool)) || splitIn(pool) || splitIn(unseen(full)) || splitIn(full);
  // V9.26 : avant une question faible (presque toujours OUI, très révélatrice si NON), on préfère la paire
  // équilibrée « plus grand que k / plus petit que k+1 » ; une question faible ne sert qu'en fin d'enquête,
  // quand plus aucune ne coupe vraiment les possibles en deux.
  const strongOnes = pref.filter(strong);
  const sp = split();
  const weakOk = q => side(q) >= Math.min(safe2(), Math.floor(g.candidates.length / 4));
  return tryTier(strongOnes) || sp || tryTier(pref.filter(weakOk)) || tryTier(pref) || chosen;
}
