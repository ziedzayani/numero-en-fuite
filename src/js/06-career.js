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
const SOLO_XP = { win: 40, recordBonus: 10, loss: 10 };
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

const emptyLevel = () => ({ bestScore: null, bestTurns: null, gamesPlayed: 0, wins: 0, stars: 0 });
function emptyCareer() {
  return {
    schemaVersion: 1,
    activeProfileId: 'local-default',
    profiles: {
      'local-default': {
        displayName: 'Détective',
        xpTotal: 0,
        totalWins: 0,
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
  for (const k of ['xpTotal', 'totalWins', 'totalLosses', 'totalStars'])
    if (!Number.isFinite(p[k]) || p[k] < 0) p[k] = 0;
  if (!p.processed || typeof p.processed !== 'object') p.processed = {};
  p.levels = p.levels || {};
  for (const l of Object.keys(LEVELS)) p.levels[l] = { ...emptyLevel(), ...(p.levels[l] || {}) };
  normalizeOffice(p); // badges et missions (V8.15), complétés si absents
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
    newRecord = won && (prevBest == null || score.total > prevBest), // strictement meilleur
    xp = won ? SOLO_XP.win + (newRecord ? SOLO_XP.recordBonus : 0) : SOLO_XP.loss,
    rankBefore = rankOf(p.xpTotal).rank;
  lv.gamesPlayed++;
  if (won) {
    lv.wins++;
    lv.stars += stars;
    p.totalWins++;
    p.totalStars += stars;
    if (newRecord) lv.bestScore = score.total;
    if (lv.bestTurns == null || turns < lv.bestTurns) lv.bestTurns = turns;
  } else p.totalLosses++;
  p.xpTotal += xp;
  const rewards = settleOffice(p, gameFacts(won, turns, stars), lv); // badges, missions (+XP)
  const result = {
    won,
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

/** Code de sauvegarde des progrès actuels. */
function exportProgress() {
  const c = loadCareer(),
    p = careerProfile(c);
  const data = {
    v: 1,
    career: { ...c, profiles: { [c.activeProfileId]: { ...p, processed: {} } } },
    records: records(),
    prefs: Object.fromEntries(BACKUP_PREFS.map(k => [k, g[k]]))
  };
  const b = toB64(JSON.stringify(data));
  return `${BACKUP_PREFIX}-${b}-${fnv1a(b)}`;
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
    data && data.career && data.career.profiles && data.career.profiles[data.career.activeProfileId];
  if (!data || data.v !== 1 || !prof || typeof data.records !== 'object')
    return { ok: false, error: 'damaged' };
  return { ok: true, data, summary: progressSummary(prof) };
}

/** Résumé lisible d'une carrière : rang, XP, victoires. */
const progressSummary = p => ({
  rank: rankOf(p.xpTotal || 0).rank,
  xp: p.xpTotal || 0,
  wins: p.totalWins || 0
});

/** Remplace les progrès par ceux du code (après confirmation). Renvoie true si c'est fait. */
function importProgress(code) {
  const r = readBackup(code);
  if (!r.ok) return false;
  try {
    localStorage.setItem(CAREER_STORAGE, JSON.stringify(r.data.career));
    forgetRank();
    localStorage.setItem(RECORDS_STORAGE, JSON.stringify(r.data.records));
  } catch (e) {
    return false;
  }
  loadCareer(); // complète un code ancien ou partiel champ par champ
  for (const k of BACKUP_PREFS) if (r.data.prefs && k in r.data.prefs) g[k] = r.data.prefs[k];
  return true;
}
