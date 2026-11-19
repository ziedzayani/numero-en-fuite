/*
 * « Mon bureau » V8.15 : badges, missions et chapeau du détective (mode Solo classique).
 *
 * Tout est rangé dans la carrière (numeroEnFuiteCareerV1, profil actif) et donc aussi dans le
 * code de sauvegarde « Mes progrès » :
 *   p.badges   = { id: palier }                     palier 1–4 = niveau le plus haut où le badge est gagné
 *                                                   (🥉 Petit, 🥈 Moyen, 🥇 Grand, 💎 Génie ; jamais retiré)
 *   p.missions = [{ k, level?, n?, min?, progress, goal }] 3 missions ; `min` = niveau minimum (0–3)
 *   p.missionSeq                                     compteur pour tirer les missions suivantes
 * Une mission réussie rapporte MISSION_XP et laisse sa place à une nouvelle.
 * Rien n'est payant, rien n'expire, rien ne se perd.
 */

const MISSION_XP = 20;
/** Ordre des niveaux (indice 0–3) et médaille de chaque palier de badge. */
const LEVEL_ORDER = ['junior', 'malin', 'expert', 'genius'];
const TIER_MEDALS = ['', '🥉', '🥈', '🥇', '💎'];
const levelIdx = l => Math.max(0, LEVEL_ORDER.indexOf(l));
/** Niveau où le joueur joue le plus (pour adapter les missions). */
function mainLevel(p) {
  let best = 0,
    n = -1;
  LEVEL_ORDER.forEach((l, i) => {
    const c = (p.levels && p.levels[l] && p.levels[l].gamesPlayed) || 0;
    if (c >= n) [best, n] = [c > n ? i : best, Math.max(n, c)];
  });
  return best;
}

/**
 * Les 6 badges. `test(f, lv)` reçoit les faits de la partie (voir gameFacts) et les compteurs du niveau.
 * Les textes sont les clés badge_<id> (nom) et badgeHow_<id> (comment l'obtenir).
 */
const BADGES = [
  { id: 'lynx', icon: '👁️', test: f => f.won && f.misses === 0 && f.finalCapture === 'precise' },
  { id: 'flash', icon: '⚡', test: f => f.won && f.turns <= 3 },
  { id: 'brain', icon: '🧠', test: f => f.goodMath >= 3 },
  { id: 'net', icon: '🕸️', test: f => f.won && f.finalCapture === 'net' },
  { id: 'hound', icon: '🐾', test: f => f.won && f.level === 'genius' && !f.usedNet },
  { id: 'ace', icon: '🃏', test: (f, lv) => lv.wins >= 10 }
];

/** Modèles de missions, tirés à tour de rôle (jamais deux fois la même en même temps). */
// ordre de tirage : les 3 premières (mener 3 enquêtes, décaler ses marques, gagner au niveau Moyen) sont pour débuter
const MISSION_KINDS = ['play', 'shift', 'winLevel', 'math', 'precise', 'fast', 'noMiss', 'stars'];
function makeMission(kind, seq, min = 0) {
  // V9.6 : chaque mission vise le niveau du joueur (ou le suivant, pour progresser) ; `min` = niveau minimum
  switch (kind) {
    case 'winLevel':
      return { k: kind, level: LEVEL_ORDER[Math.min(3, min + 1)], progress: 0, goal: 1 };
    case 'math':
      return { k: kind, n: 2, min, progress: 0, goal: 1 };
    case 'fast':
      return { k: kind, n: 5, min, progress: 0, goal: 1 };
    case 'play':
      return { k: kind, n: 3, min, progress: 0, goal: 3 };
    default:
      return { k: kind, min, progress: 0, goal: 1 };
  }
}
/** Une partie fait-elle avancer la mission ? (nombre de pas gagnés) */
function missionStep(m, f) {
  if (m.min && levelIdx(f.level) < m.min) return 0; // partie jouée à un niveau trop facile
  switch (m.k) {
    case 'winLevel':
      return f.won && f.level === m.level ? 1 : 0;
    case 'math':
      return f.goodMath >= m.n ? 1 : 0;
    case 'precise':
      return f.won && f.finalCapture === 'precise' ? 1 : 0;
    case 'fast':
      return f.won && f.turns <= m.n ? 1 : 0;
    case 'shift':
      return f.shifted ? 1 : 0;
    case 'play':
      return 1;
    case 'noMiss':
      return f.won && f.misses === 0 ? 1 : 0;
    case 'stars':
      return f.won && f.stars === 3 ? 1 : 0;
    default:
      return 0;
  }
}
const missionKey = m => m.k + (m.level ? ':' + m.level : '');

/** Prochaine mission : la suivante du cycle qui n'est pas déjà en cours. */
function nextMission(p) {
  const current = new Set((p.missions || []).map(missionKey));
  for (let tries = 0; tries < MISSION_KINDS.length * 4; tries++) {
    const seq = p.missionSeq || 0;
    p.missionSeq = seq + 1;
    const main = mainLevel(p),
      min = seq % 2 ? Math.min(3, main + 1) : main; // une mission sur deux pousse au niveau suivant
    const m = makeMission(
      MISSION_KINDS[seq % MISSION_KINDS.length],
      Math.floor(seq / MISSION_KINDS.length),
      min
    );
    if (!current.has(missionKey(m))) return m;
  }
  return makeMission('play', 0);
}
/** Complète badges et missions d'un profil (ancienne sauvegarde, code importé, donnée abîmée). */
function normalizeOffice(p) {
  if (!p.badges || typeof p.badges !== 'object' || Array.isArray(p.badges)) p.badges = {};
  // anciens badges (date d'obtention, V8.15) : gardés, au palier 🥉
  for (const id of Object.keys(p.badges)) {
    const v = p.badges[id];
    if (!(Number.isInteger(v) && v >= 1 && v <= 4)) p.badges[id] = 1;
  }
  if (!Array.isArray(p.missions)) p.missions = [];
  p.missions = p.missions.filter(m => m && MISSION_KINDS.includes(m.k) && m.goal > 0 && m.progress < m.goal);
  while (p.missions.length < 3) p.missions.push(nextMission(p));
  return p;
}

/** Faits d'une partie solo terminée, lus dans l'état du jeu. */
function gameFacts(won, turns, stars) {
  const h = g.history;
  return {
    won,
    turns,
    stars,
    level: g.level,
    goodMath: h.filter(e => e.type === 'math' && e.correct).length,
    misses: h.filter(e => e.type === 'wrong' || e.type === 'netMiss').length,
    usedNet: h.some(e => e.type === 'netMiss' || e.type === 'netHit'),
    finalCapture: g.last && g.last.type === 'netHit' ? 'net' : 'precise',
    shifted: !!g.usedShift
  };
}

/**
 * Appelée UNE fois par partie (dans settleSolo, protégée par le journal `processed`) :
 * nouveaux badges, missions avancées / réussies (remplacées), XP des missions.
 */
function settleOffice(p, f, lv) {
  normalizeOffice(p);
  // palier du badge = niveau de la partie (🥉 Petit … 💎 Génie) ; nouveau si plus haut que l'actuel
  const badgeTier = levelIdx(f.level) + 1;
  const newBadges = BADGES.filter(b => (p.badges[b.id] || 0) < badgeTier && b.test(f, lv)).map(b => b.id);
  for (const id of newBadges) p.badges[id] = badgeTier;
  const done = [];
  p.missions = p.missions.map(m => {
    const progress = Math.min(m.goal, m.progress + missionStep(m, f));
    if (progress < m.goal) return { ...m, progress };
    done.push({ ...m, progress });
    return null;
  });
  p.missions = p.missions.filter(Boolean);
  while (p.missions.length < 3) p.missions.push(nextMission(p));
  const missionXp = done.length * MISSION_XP;
  p.xpTotal += missionXp;
  return { newBadges, missionsDone: done, missionXp, badgeTier };
}

/** Texte d'une mission (traduit). */
const LEVEL_NAME_KEYS = {
  junior: 'levelJunior',
  malin: 'levelMalin',
  expert: 'levelExpert',
  genius: 'levelGenius'
};
const missionText = m =>
  t('mission_' + m.k, { n: m.n, level: m.level ? t(LEVEL_NAME_KEYS[m.level]) : '' }) +
  (m.min ? ' ' + t('missionMinLevel', { level: t(LEVEL_NAME_KEYS[LEVEL_ORDER[m.min]]) }) : '');

/** Rang du joueur, gardé en mémoire (le chapeau du détective en dépend à chaque affichage). */
let rankCache = null;
const heroRank = () => {
  if (rankCache === null) rankCache = rankOf(careerProfile(loadCareer()).xpTotal).rank;
  return rankCache;
};
const forgetRank = () => (rankCache = null);
