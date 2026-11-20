/*
 * V9.24 : les Défis dans la carrière (même XP, mêmes rangs, même coffre à badges, mêmes missions
 * que le Solo classique — pas de deuxième système).
 *
 * Rangé dans le profil de la carrière (numeroEnFuiteCareerV1), champ ajouté sans changer de schéma :
 *   p.challenge = {
 *     runs: { 'easy-timed': { played, wins }, … 'hard-endless': … }   6 variantes
 *     easyDay: { d: 'AAAA-MM-JJ', n }   Défis Faciles qui ont rapporté de l'XP ce jour-là (anti-abus)
 *   }
 *   p.lastPromo = { rank, src: 'solo' | 'challenge', level?, diff?, kind?, d }   dernière montée de rang
 * Les records des Défis restent dans numeroEnFuiteRecords (clé chRecordKey), comme avant.
 * Une ancienne carrière reçoit des compteurs à zéro : aucune récompense n'est attribuée après coup.
 * settleChallenge() n'attribue rien deux fois (journal `processed`, par gameId), comme settleSolo().
 */
const CH_VARIANTS = CH_DIFF_ORDER.flatMap(d => ['timed', 'endless'].map(k => d + '-' + k));
const nonNeg = v => (Number.isInteger(v) && v >= 0 ? v : 0);

/** Complète (ou répare) les compteurs de Défi d'un profil. */
function normalizeChallenge(p) {
  const c = p.challenge && typeof p.challenge === 'object' && !Array.isArray(p.challenge) ? p.challenge : {},
    runs = c.runs && typeof c.runs === 'object' ? c.runs : {};
  p.challenge = {
    runs: Object.fromEntries(
      CH_VARIANTS.map(v => {
        const r = runs[v] && typeof runs[v] === 'object' ? runs[v] : {},
          played = nonNeg(r.played);
        return [v, { played, wins: Math.min(played, nonNeg(r.wins)) }];
      })
    ),
    easyDay:
      c.easyDay && typeof c.easyDay.d === 'string'
        ? { d: c.easyDay.d, n: nonNeg(c.easyDay.n) }
        : { d: '', n: 0 }
  };
  const lp = p.lastPromo;
  if (!(lp && typeof lp === 'object' && Number.isInteger(lp.rank) && ['solo', 'challenge'].includes(lp.src)))
    p.lastPromo = null;
  return p;
}
/** Victoires en Défi, toutes variantes confondues. */
const chWinsTotal = p =>
  p.challenge ? CH_VARIANTS.reduce((s, v) => s + ((p.challenge.runs[v] || {}).wins || 0), 0) : 0;

/**
 * XP d'un Défi terminé (voir CHALLENGE_XP), avec ses lignes de détail [clé, xp].
 * capped : Défi Facile au-delà de CH_EASY_XP_PER_DAY ce jour-là → 0 XP (le reste compte).
 */
function challengeXp({ diff, kind, won, base, newRecord, helped, easyCount }) {
  const X = CHALLENGE_XP[diff] || CHALLENGE_XP.medium;
  if (helped) return { xp: 0, lines: [], capped: false };
  const lines = won
    ? [
        ['chXpWin', X.win],
        newRecord && ['chXpRecord', X.recordBonus],
        base >= CH_EXCELLENT_SCORE && ['chXpExcellent', X.excellent],
        kind === 'timed' && ['chXpTimed', X.timed]
      ].filter(Boolean)
    : [['chXpLoss', X.loss]];
  const capped = diff === 'easy' && easyCount >= CH_EASY_XP_PER_DAY;
  return { xp: capped ? 0 : lines.reduce((s, l) => s + l[1], 0), lines, capped };
}

/**
 * Clôt un Défi (appelée par finishChallenge) : compteurs, XP, badges, missions, rang.
 * Idempotent : un gameId déjà traité renvoie le résumé enregistré, sans rien attribuer de nouveau.
 * parts = chScoreParts(true) (mêmes chiffres que l'écran et le record).
 */
function settleChallenge(won, parts, prevBest, newRecord) {
  const c = loadCareer(),
    p = careerProfile(c),
    id = g.gameId || newGameId();
  g.gameId = id;
  if (p.processed[id]) return (g.chResult = p.processed[id]);
  const diff = g.chDiff in CHALLENGE_XP ? g.chDiff : 'medium',
    kind = g.chKind === 'timed' ? 'timed' : 'endless',
    day = todayKey(),
    run = p.challenge.runs[diff + '-' + kind],
    h = g.history,
    helped = !!(g.playerHelp && g.playerHelp[0]);
  if (p.challenge.easyDay.d !== day) p.challenge.easyDay = { d: day, n: 0 };
  const rankBefore = rankOf(p.xpTotal).rank,
    xp = challengeXp({
      diff,
      kind,
      won,
      base: parts.base,
      newRecord,
      helped,
      easyCount: p.challenge.easyDay.n
    });
  run.played++;
  if (won) run.wins++;
  if (diff === 'easy' && !helped && !xp.capped) p.challenge.easyDay.n++;
  p.xpTotal += xp.xp;
  const facts = { challenge: true, won, diff, kind, base: parts.base, score: parts.total, level: g.level };
  const rewards = helped
    ? { newBadges: [], badgeTiers: {}, missionsDone: [], missionXp: 0 }
    : settleOffice(p, facts, null);
  const rank = rankOf(p.xpTotal).rank;
  if (rank > rankBefore) p.lastPromo = { rank, src: 'challenge', diff, kind, d: day };
  const result = {
    challenge: true,
    won,
    helped,
    kind,
    diff,
    score: parts.total,
    base: parts.base,
    lines: parts.lines,
    prevBest: prevBest || null,
    newRecord: !!newRecord,
    turns: g.turn + 1,
    timeMs: Math.round(g.chElapsed || 0),
    goodMath: h.filter(e => e.type === 'math' && e.correct).length,
    errors: h.filter(e => (e.type === 'math' && !e.correct) || e.type === 'wrong' || e.type === 'netMiss')
      .length,
    xp: xp.xp,
    xpLines: xp.lines,
    xpCapped: xp.capped,
    xpTotal: p.xpTotal,
    rankUp: rank > rankBefore,
    rank,
    newBadges: rewards.newBadges,
    badgeTiers: rewards.badgeTiers,
    missionsDone: rewards.missionsDone,
    missionXp: rewards.missionXp
  };
  p.processed[id] = result;
  const ids = Object.keys(p.processed);
  for (const old of ids.slice(0, Math.max(0, ids.length - CAREER_PROCESSED_MAX))) delete p.processed[old];
  saveCareer(c);
  return (g.chResult = result);
}
