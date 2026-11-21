/*
 * Carrière du mode Solo classique : score d'enquête, records par niveau, XP et rangs.
 *
 * Stockage séparé, versionné : localStorage « numeroEnFuiteCareerV1 ». Les anciennes clés
 * (partie en cours, records de tours `solo_*`, records des défis) ne sont ni remplacées ni purgées.
 *
 * Règles de sûreté :
 *   - chaque partie a un identifiant stable g.gameId (créé par start(), sauvegardé avec la partie) ;
 *   - settleSolo() n'attribue score, étoiles et XP qu'UNE fois par gameId (journal `processed`) :
 *     recharger, rouvrir le résultat ou appuyer sur Retour ne redonne rien ;
 *   - un abandon (Accueil pendant la partie) ne passe jamais par settleSolo() : 0 XP ;
 *   - ne concerne ni les défis, ni Course / Points (plusieurs joueurs).
 */

/** Barème du score Solo (cahier des charges V8.5). Prolonger d'un tour coûte 40, un calcul en rapporte au plus 20. */
const SOLO_SCORE = { win: 100, perTurnSaved: 40, perMath: 20, maxMath: 3, precise: 10, perMiss: 10 };
/** XP de fin de partie. */
/** XP d'une partie solo selon le niveau (V9.6) : un niveau plus dur rapporte plus. Avec l'aide : 0 XP. */
const SOLO_XP = {
  junior: { win: 10, recordBonus: 5, loss: 2 },
  malin: { win: 15, recordBonus: 8, loss: 3 },
  expert: { win: 20, recordBonus: 10, loss: 4 },
  genius: { win: 30, recordBonus: 15, loss: 5 }
};
/** Seuils d'XP des rangs (le libellé est la clé de traduction rank1…rank8). */
const RANKS = [0, 100, 250, 450, 700, 1000, 1400, 1900];
const CAREER_STORAGE = 'numeroEnFuiteCareerV1';
const CAREER_PROCESSED_MAX = 40; // taille du journal des parties déjà comptées

/** Étoiles de rapidité, inchangées : 3 si ≤ 3 tours, 2 si 4 à 6, 1 au-delà ; 0 en cas de défaite. */
const soloStars = (won, turns) => (!won ? 0 : turns <= 3 ? 3 : turns <= 6 ? 2 : 1);

/**
 * Score d'une enquête solo et son détail (lignes affichées sur l'écran de fin).
 * @param {{won:boolean, turns:number, limit:number, goodMath:number, finalCapture:'precise'|'net', misses:number}} p
 */
function scoreSolo({ won, turns, limit, goodMath, finalCapture, misses }) {
  if (!won) return { total: 0, lines: [] };
  const S = SOLO_SCORE,
    saved = Math.max(0, limit - turns),
    math = Math.min(S.maxMath, Math.max(0, goodMath));
  const lines = [
    ['scoreLineWin', S.win, {}],
    ['scoreLineSaved', S.perTurnSaved * saved, { n: saved }],
    ['scoreLineMath', S.perMath * math, { n: math }],
    ['scoreLinePrecise', finalCapture === 'precise' ? S.precise : 0, {}],
    ['scoreLineMiss', -S.perMiss * misses, { n: misses }]
  ].filter(([key, v]) => v !== 0 || key === 'scoreLineWin');
  return {
    total: Math.max(
      0,
      lines.reduce((s, l) => s + l[1], 0)
    ),
    lines
  };
}

/** Rang pour un total d'XP : { rank (1…), min, next (null au dernier rang), pct dans le rang }. */
function rankOf(xp) {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1]) i++;
  const min = RANKS[i],
    next = i + 1 < RANKS.length ? RANKS[i + 1] : null;
  return { rank: i + 1, min, next, pct: next ? Math.round(((xp - min) / (next - min)) * 100) : 100 };
}

const emptyLevel = () => ({
  bestScore: null,
  bestTurns: null,
  gamesPlayed: 0,
  wins: 0,
  stars: 0,
  helpWins: 0,
  bestHelped: false
});
function emptyCareer() {
  return {
    schemaVersion: 1,
    activeProfileId: 'local-default',
    profiles: {
      'local-default': {
        displayName: 'Détective',
        xpTotal: 0,
        totalWins: 0,
        totalHelpWins: 0, // V9.4 : victoires avec l'aide (numéros possibles en vert)
        totalLosses: 0,
        totalStars: 0,
        levels: Object.fromEntries(Object.keys(LEVELS).map(l => [l, emptyLevel()])),
        processed: {} // gameId → résumé déjà attribué (idempotence)
      }
    }
  };
}

/**
 * Lit la carrière ; à la première lecture, migre les meilleurs nombres de tours `solo_*`
 * des records V8.4 (sans inventer de score : bestScore reste null). Une donnée abîmée
 * est complétée champ par champ plutôt que jetée.
 */
function loadCareer() {
  let c = null;
  try {
    c = JSON.parse(localStorage.getItem(CAREER_STORAGE));
  } catch (e) {}
  const fresh = !c || c.schemaVersion !== 1 || !c.profiles;
  if (fresh) c = emptyCareer();
  const p = (c.profiles[c.activeProfileId] = {
    ...emptyCareer().profiles['local-default'],
    ...(c.profiles[c.activeProfileId] || {})
  });
  for (const k of ['xpTotal', 'totalWins', 'totalHelpWins', 'totalLosses', 'totalStars'])
    if (!Number.isFinite(p[k]) || p[k] < 0) p[k] = 0;
  if (!p.processed || typeof p.processed !== 'object') p.processed = {};
  p.levels = p.levels || {};
  for (const l of Object.keys(LEVELS)) p.levels[l] = { ...emptyLevel(), ...(p.levels[l] || {}) };
  normalizeOffice(p); // badges et missions (V8.15), complétés si absents
  normalizeChallenge(p); // V9.24 : compteurs des Défis (à zéro pour une ancienne carrière)
  if (fresh) {
    const r = records();
    for (const l of Object.keys(LEVELS))
      if (Number.isFinite(r['solo_' + l])) p.levels[l].bestTurns = r['solo_' + l];
  }
  return c;
}
const careerProfile = c => c.profiles[c.activeProfileId];
function saveCareer(c) {
  try {
    localStorage.setItem(CAREER_STORAGE, JSON.stringify(c));
  } catch (e) {} // stockage plein ou interdit : le jeu continue
  forgetRank();
}

/** Identifiant de partie : stable, sauvegardé avec la partie (reprise après fermeture). */
const newGameId = () => Date.now().toString(36) + '-' + rnd(1e9).toString(36);

/**
 * Clôt une partie solo classique (victoire ou défaite après la limite de tours) et renvoie son résumé.
 * Idempotent : un gameId déjà traité renvoie le résumé enregistré, sans rien attribuer de nouveau.
 */
function settleSolo(won) {
  const c = loadCareer(),
    p = careerProfile(c),
    id = g.gameId || newGameId();
  g.gameId = id;
  if (p.processed[id]) return (g.soloResult = p.processed[id]);
  const h = g.history,
    turns = won ? g.turn + 1 : g.limit,
    lv = p.levels[g.level] || (p.levels[g.level] = emptyLevel()),
    score = scoreSolo({
      won,
      turns,
      limit: g.limit || 12,
      goodMath: h.filter(e => e.type === 'math' && e.correct).length,
      finalCapture: g.last && g.last.type === 'netHit' ? 'net' : 'precise',
      misses: h.filter(e => e.type === 'wrong' || e.type === 'netMiss').length
    }),
    stars = soloStars(won, turns),
    prevBest = lv.bestScore,
    // V9.30 : partie jouée avec l'aide = NON COMPTÉE (ni XP, ni record, ni statistiques, ni badge, ni mission)
    helped = !!(g.playerHelp && g.playerHelp[0]),
    newRecord = !helped && won && (prevBest == null || score.total > prevBest), // strictement meilleur
    sx = SOLO_XP[g.level] || SOLO_XP.junior,
    xp = helped ? 0 : won ? sx.win + (newRecord ? sx.recordBonus : 0) : sx.loss,
    rankBefore = rankOf(p.xpTotal).rank;
  // (les anciens compteurs « avec aide » et records 💡 restent affichés tels quels, sans plus augmenter)
  if (!helped) {
    lv.gamesPlayed++;
    if (won) {
      lv.wins++;
      lv.stars += stars;
      p.totalWins++;
      p.totalStars += stars;
      if (newRecord) {
        lv.bestScore = score.total;
        lv.bestHelped = false;
      }
      if (lv.bestTurns == null || turns < lv.bestTurns) lv.bestTurns = turns;
    } else p.totalLosses++;
  }
  p.xpTotal += xp;
  // badges et missions : seulement sans l'aide (V9.6)
  const rewards = helped
    ? { newBadges: [], badgeTiers: {}, missionsDone: [], missionXp: 0, badgeTier: 0 }
    : settleOffice(p, gameFacts(won, turns, stars), lv);
  if (rankOf(p.xpTotal).rank > rankBefore)
    p.lastPromo = { rank: rankOf(p.xpTotal).rank, src: 'solo', level: g.level, d: todayKey() };
  const result = {
    won,
    helped,
    turns,
    level: g.level,
    stars,
    score: score.total,
    lines: score.lines,
    prevBest,
    newRecord,
    xp,
    xpTotal: p.xpTotal,
    rankUp: rankOf(p.xpTotal).rank > rankBefore,
    newBadges: rewards.newBadges,
    badgeTier: rewards.badgeTier || 0,
    badgeTiers: rewards.badgeTiers || {},
    missionsDone: rewards.missionsDone,
    missionXp: rewards.missionXp,
    tip: soloTip(won, turns, stars, g.history, g.last)
  };
  p.processed[id] = result;
  const ids = Object.keys(p.processed);
  for (const old of ids.slice(0, Math.max(0, ids.length - CAREER_PROCESSED_MAX))) delete p.processed[old];
  saveCareer(c);
  return (g.soloResult = result);
}

/** Une seule suggestion pour la prochaine enquête : utile, jamais mensongère (clé + variables). */
function soloTip(won, turns, stars, history, last) {
  const misses = history.filter(e => e.type === 'wrong' || e.type === 'netMiss').length;
  if (!won) return ['tipLoss', {}];
  if (misses >= 2) return ['tipMisses', {}];
  if (stars === 1) return ['tipTwoStars', {}];
  if (stars === 2) return ['tipThreeStars', { n: turns - 3 }];
  if (last && last.type === 'netHit') return ['tipPrecise', {}];
  if (misses === 1) return ['tipNoMiss', {}];
  const order = Object.keys(LEVELS),
    next = order[order.indexOf(g.level) + 1];
  const names = { junior: 'levelJunior', malin: 'levelMalin', expert: 'levelExpert', genius: 'levelGenius' };
  return next ? ['tipNextLevel', { levelKey: names[next] }] : ['tipPerfect', {}];
}

/*
 * Sauvegarde de secours des progrès (Réglages › Mes progrès) : un code texte à garder
 * (message, notes…) et à recoller après un changement de téléphone ou une réinstallation.
 *   Format : « NEF1-<données base64>-<contrôle> » ; contrôle = empreinte FNV-1a des données.
 *   Contenu : carrière solo (sans le journal des parties), records des défis, réglages.
 *   Jamais la partie en cours. Un code abîmé est refusé ; l'import demande confirmation.
 */
const BACKUP_PREFIX = 'NEF1';
const BACKUP_PREFS = ['lang', 'sound', 'timerMode', 'reduceMotion', 'replayAsk', 'tutSeen'];

/** Empreinte FNV-1a 32 bits (détecte un code tronqué ou modifié). */
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}
const toB64 = s => btoa(unescape(encodeURIComponent(s)));
const fromB64 = s => decodeURIComponent(escape(atob(s)));

/**
 * Code de sauvegarde des progrès actuels.
 * V9.26 (format v2) : ajoute l'historique du Défi du jour (résultats officiels et nombre d'essais) et les
 * statistiques « à plusieurs » de ce téléphone. Jamais la partie en cours ni une connexion Wi-Fi.
 */
function exportProgress() {
  const c = loadCareer(),
    p = careerProfile(c);
  const data = {
    v: BACKUP_VERSION,
    career: { ...c, profiles: { [c.activeProfileId]: { ...p, processed: {} } } },
    records: records(),
    daily: cleanDaily(loadDaily()),
    versus: cleanVersus(loadVersus()),
    prefs: Object.fromEntries(BACKUP_PREFS.map(k => [k, g[k]]))
  };
  const b = toB64(JSON.stringify(data));
  return `${BACKUP_PREFIX}-${b}-${fnv1a(b)}`;
}
const BACKUP_VERSION = 2;
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const natOrNull = v => (Number.isInteger(v) && v >= 0 ? v : null);
const natOr0 = v => (Number.isInteger(v) && v >= 0 ? v : 0);
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
/**
 * V9.30 : date « AAAA-MM-JJ » qui existe vraiment (pas de 31 février) et qui n'est pas dans le futur
 * (aucun résultat officiel ne peut venir d'un jour pas encore joué).
 */
function isValidDay(day) {
  if (typeof day !== 'string' || !DAY_KEY.test(day)) return false;
  const [y, m, d] = day.split('-').map(Number),
    dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d && day <= todayKey();
}
/** Historique du Défi du jour vérifié champ par champ (dates valides seulement). */
function cleanDaily(d) {
  if (!isObj(d)) return {};
  const out = {};
  for (const [day, e] of Object.entries(d)) {
    if (!isValidDay(day) || !isObj(e)) continue;
    out[day] = {
      won: !!e.won,
      turns: natOrNull(e.turns),
      secret: natOrNull(e.secret),
      tries: Math.max(1, natOr0(e.tries)),
      score: natOrNull(e.score),
      ms: natOrNull(e.ms),
      ...(e.helped ? { helped: true } : {})
    };
  }
  return out;
}
/** Statistiques « à plusieurs » vérifiées (prénoms, compteurs, face-à-face, parties déjà comptées). */
function cleanVersus(d) {
  const out = { players: {}, pairs: {}, processed: [] };
  if (!isObj(d)) return out;
  for (const [name, p] of Object.entries(isObj(d.players) ? d.players : {}))
    if (name && name.length <= 20 && isObj(p))
      out.players[name] = {
        games: natOr0(p.games),
        wins: Math.min(natOr0(p.wins), natOr0(p.games)),
        captures: natOr0(p.captures),
        streak: natOr0(p.streak),
        best: natOr0(p.best)
      };
  for (const [key, pr] of Object.entries(isObj(d.pairs) ? d.pairs : {})) {
    const names = key.split('|');
    if (names.length !== 2 || !isObj(pr)) continue;
    const w = {};
    for (const n of names) if (isObj(pr.w) && natOr0(pr.w[n])) w[n] = natOr0(pr.w[n]);
    out.pairs[key] = { games: natOr0(pr.games), w };
  }
  if (Array.isArray(d.processed)) out.processed = d.processed.filter(x => typeof x === 'string').slice(-60);
  return out;
}

/**
 * Lit un code de sauvegarde. Renvoie { ok: true, data, summary } ou { ok: false, error }.
 * error : 'format' (pas un code du jeu), 'damaged' (code incomplet ou modifié).
 */
function readBackup(code) {
  const m = String(code || '')
    .replace(/\s+/g, '')
    .match(/^NEF1-([A-Za-z0-9+/=]+)-([0-9a-z]+)$/);
  if (!m) return { ok: false, error: 'format' };
  if (fnv1a(m[1]) !== m[2]) return { ok: false, error: 'damaged' };
  let data;
  try {
    data = JSON.parse(fromB64(m[1]));
  } catch (e) {
    return { ok: false, error: 'damaged' };
  }
  const prof =
    isObj(data) && isObj(data.career) && isObj(data.career.profiles)
      ? data.career.profiles[data.career.activeProfileId]
      : null;
  if (!isObj(data) || ![1, 2].includes(data.v) || !isObj(prof) || !isObj(data.records))
    return { ok: false, error: 'damaged' };
  // V9.26 : un code v2 contient aussi le Défi du jour et les statistiques à plusieurs (vérifiés)
  if (
    data.v === 2 &&
    ((data.daily != null && !isObj(data.daily)) || (data.versus != null && !isObj(data.versus)))
  )
    return { ok: false, error: 'damaged' };
  const summary = progressSummary(prof);
  summary.full = data.v >= 2; // ancien code : Défi du jour et statistiques à plusieurs de ce téléphone gardés
  summary.days = Object.keys(cleanDaily(data.daily)).length;
  summary.players = Object.keys(cleanVersus(data.versus).players).length;
  return { ok: true, data, summary };
}

/** Résumé lisible d'une carrière : rang, XP, victoires. */
const progressSummary = p => ({
  rank: rankOf(p.xpTotal || 0).rank,
  xp: p.xpTotal || 0,
  wins: p.totalWins || 0
});

/*
 * V9.30 : fusion déterministe des données d'un code avec celles du téléphone (fonctions pures).
 *   Défi du jour : un résultat officiel déjà présent sur le téléphone n'est JAMAIS remplacé ; une date que le
 *     téléphone n'a pas est restaurée depuis le code ; le nombre d'essais garde le plus grand des deux.
 *   Records : le meilleur des deux pour chaque record (un import ne fait jamais baisser un record).
 *   Statistiques à plusieurs : pour chaque prénom / face-à-face, la fiche qui compte le plus de parties
 *     (jamais d'addition, donc aucune partie comptée deux fois) ; journal des parties comptées réuni.
 */
function mergeDaily(local, imported) {
  const out = { ...local };
  for (const [day, e] of Object.entries(imported)) {
    const mine = local[day];
    out[day] = mine ? { ...mine, tries: Math.max(mine.tries || 1, e.tries || 1) } : e;
  }
  return out;
}
function mergeRecords(local, imported) {
  const out = { ...local };
  for (const [k, v] of Object.entries(imported))
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && !(out[k] >= v)) out[k] = v;
  return out;
}
function mergeVersus(local, imported) {
  const richer = (a, b) => {
    const out = { ...a };
    for (const [k, v] of Object.entries(b)) if (!out[k] || v.games > out[k].games) out[k] = v;
    return out;
  };
  return {
    players: richer(local.players, imported.players),
    pairs: richer(local.pairs, imported.pairs),
    processed: [...new Set([...imported.processed, ...local.processed])].slice(-60)
  };
}
/**
 * Prépare tout ce que l'import écrira (sans rien écrire) : { clé: texte JSON }.
 * La carrière du code remplace celle du téléphone, mais garde le journal des parties déjà comptées ICI
 * (une partie terminée sur ce téléphone ne redonne ni XP, ni badge, ni mission).
 */
function restorePlan(data) {
  const career = JSON.parse(JSON.stringify(data.career)),
    prof = career.profiles[career.activeProfileId],
    keepProcessed = careerProfile(loadCareer()).processed || {};
  prof.processed = { ...(isObj(prof.processed) ? prof.processed : {}), ...keepProcessed };
  const plan = {
    [CAREER_STORAGE]: career,
    [RECORDS_STORAGE]: mergeRecords(records(), data.records)
  };
  // un code ancien (v1) n'a ni Défi du jour ni statistiques : ceux du téléphone restent tels quels
  if (data.v >= 2) {
    plan[DAILY_STORAGE] = mergeDaily(cleanDaily(loadDaily()), cleanDaily(data.daily));
    plan[VERSUS_STORAGE] = mergeVersus(cleanVersus(loadVersus()), cleanVersus(data.versus));
  }
  return Object.fromEntries(Object.entries(plan).map(([k, v]) => [k, JSON.stringify(v)]));
}
/** Écrit toutes les clés, ou aucune : en cas d'erreur, chaque clé reprend sa valeur d'avant. */
function writeAllOrNothing(plan) {
  const before = Object.fromEntries(Object.keys(plan).map(k => [k, localStorage.getItem(k)]));
  try {
    for (const [k, v] of Object.entries(plan)) localStorage.setItem(k, v);
    return true;
  } catch (e) {
    for (const [k, v] of Object.entries(before))
      try {
        if (v == null) localStorage.removeItem(k);
        else localStorage.setItem(k, v);
      } catch (e2) {}
    return false;
  }
}
/**
 * Restaure les progrès d'un code (après confirmation). Renvoie true si c'est fait.
 * Le code est entièrement vérifié et la fusion entièrement préparée AVANT la moindre écriture ; l'écriture
 * est « tout ou rien ». Importer deux fois le même code donne exactement le même résultat.
 */
function importProgress(code) {
  const r = readBackup(code);
  if (!r.ok) return false;
  let plan;
  try {
    plan = restorePlan(r.data);
  } catch (e) {
    return false;
  }
  if (!writeAllOrNothing(plan)) return false;
  forgetRank();
  loadCareer(); // complète un code ancien ou partiel champ par champ
  for (const k of BACKUP_PREFS) if (r.data.prefs && k in r.data.prefs) g[k] = r.data.prefs[k];
  return true;
}

/*
 * V9.17 : statistiques « à plusieurs », sur CE téléphone (aucun serveur). Clé à part, qui ne touche ni
 * à la sauvegarde de la partie ni à la carrière solo : numeroEnFuiteVersusV1.
 *   players : { prénom: { games, wins, captures, streak, best } }   (seulement les prénoms saisis)
 *   pairs   : { « A|B » (ordre alphabétique) : { games, w: { A: n, B: n } } }
 *   processed : derniers gameId comptés (une partie ne compte qu'une fois, même relue ou reçue en Wi-Fi)
 */
const VERSUS_STORAGE = 'numeroEnFuiteVersusV1';
function loadVersus() {
  try {
    const d = JSON.parse(localStorage.getItem(VERSUS_STORAGE));
    if (d && typeof d === 'object' && d.players && d.pairs && Array.isArray(d.processed)) return d;
  } catch (e) {
    // sauvegarde illisible : on repart de zéro
  }
  return { players: {}, pairs: {}, processed: [] };
}
/** V9.30 : un des joueurs de la partie a-t-il activé l'aide (numéros possibles) ? */
const anyHelped = () =>
  Array.from({ length: g.players || 1 }, (_, i) => !!(g.playerHelp && g.playerHelp[i])).some(Boolean);
/** Prénoms des joueurs qui ont activé l'aide. */
const helpedNames = () =>
  Array.from({ length: g.players || 1 }, (_, i) => i)
    .filter(i => g.playerHelp && g.playerHelp[i])
    .map(pname);
function versusRecord() {
  if (g.players < 2 || g.mode === 'challenge' || !g.gameId) return;
  const d = loadVersus();
  if (d.processed.includes(g.gameId)) return;
  d.processed = [...d.processed, g.gameId].slice(-60);
  // V9.30 : partie où un joueur a utilisé l'aide : notée comme vue, mais non comptée
  if (anyHelped()) {
    try {
      localStorage.setItem(VERSUS_STORAGE, JSON.stringify(d));
    } catch (e) {}
    return;
  }
  const name = i => String((g.names || [])[i] || '').trim();
  const named = Array.from({ length: g.players }, (_, i) => i).filter(i => name(i) && !isAbsent(i));
  const win = roundWinners();
  const caps = i =>
    (g.history || []).filter(e => e.player === i && ['found', 'netHit'].includes(e.type)).length;
  for (const i of named) {
    const p =
      d.players[name(i)] || (d.players[name(i)] = { games: 0, wins: 0, captures: 0, streak: 0, best: 0 });
    p.games++;
    p.captures += caps(i);
    if (win.includes(i)) {
      p.wins++;
      p.streak++;
      p.best = Math.max(p.best, p.streak);
    } else p.streak = 0;
  }
  for (const a of named)
    for (const b of named) {
      if (a >= b || name(a) === name(b)) continue;
      const [x, y] = [name(a), name(b)].sort();
      const key = x + '|' + y,
        pr = d.pairs[key] || (d.pairs[key] = { games: 0, w: {} });
      pr.games++;
      const wa = win.includes(a),
        wb = win.includes(b);
      if (wa && !wb) pr.w[name(a)] = (pr.w[name(a)] || 0) + 1;
      if (wb && !wa) pr.w[name(b)] = (pr.w[name(b)] || 0) + 1;
    }
  try {
    localStorage.setItem(VERSUS_STORAGE, JSON.stringify(d));
  } catch (e) {
    // stockage plein : les statistiques ne sont pas enregistrées, le jeu continue
  }
}
