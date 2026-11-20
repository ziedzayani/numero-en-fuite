/*
 * Défi solo (1 à 100, déplacements « fous » +7, ×2, miroir…), chronométré (3 min) ou sans limite.
 * Le score part de 1000 et baisse avec les tours, aides et erreurs ; les bons calculs
 * donnent des avantages (gel du numéro, combo, +15 s).
 * Contient aussi start(), qui lance toute nouvelle partie.
 */
const CH_TIME = 180000;
/** Meilleurs scores / tours, par défi et par niveau solo. */
function records() {
  try {
    return JSON.parse(localStorage.getItem(RECORDS_STORAGE)) || {};
  } catch (e) {
    return {};
  }
}
/** Clé des records d'un défi : un record par variante et par difficulté. */
// V8.18 : nouvelles règles → nouveaux records (« -v2 ») ; les anciens restent affichés pour mémoire
const chRecordKey = (kind = g.chKind, diff = g.chDiff) => `${kind}-${diff}-v2`;
/**
 * Score du défi (voir CHALLENGE_SCORE). withBonus ajoute les éléments de fin de partie :
 * pénalité de victoire au filet et bonus des secondes restantes.
 */
function chScore(withBonus = false) {
  const S = CHALLENGE_SCORE,
    n = f => g.history.filter(f).length;
  let sc =
    S.start -
    S.perTurn * g.turn -
    S.question * n(e => e.type === 'question') -
    S.wrongMath * n(e => e.type === 'math' && !e.correct) +
    S.goodMath * n(e => e.type === 'math' && e.correct) -
    S.miss * n(e => e.type === 'wrong') -
    S.netMiss * n(e => e.type === 'netMiss');
  if (withBonus) {
    if (g.last && g.last.type === 'netHit') sc -= S.netWin;
    if (g.chKind === 'timed') sc += S.perSecond * Math.ceil(Math.max(0, CH_TIME - g.chElapsed) / 1000);
  }
  return Math.max(0, sc);
}
/** Durée en m:ss. */
const fmtTime = ms => {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
};
/**
 * Lance un défi ('timed' | 'endless') à la difficulté 'easy' | 'medium' | 'hard',
 * en mémorisant niveau et joueurs pour les restaurer ensuite.
 */
function startChallenge(kind, diff = g.chDiffPref) {
  if (!(diff in CHALLENGE_DIFFS)) diff = 'medium';
  g.playerHelp = [false, false, false, false];
  const prevLevel = g.mode === 'challenge' ? g.prevLevel : g.level,
    prevPlayers = g.mode === 'challenge' ? g.prevPlayers : g.players;
  g.players = 1;
  g.level = CHALLENGE_DIFFS[diff];
  g.chDiffPref = diff;
  start();
  g.mode = 'challenge';
  g.chKind = kind;
  g.chDiff = diff;
  g.prevLevel = prevLevel;
  g.prevPlayers = prevPlayers;
  g.limit = 0;
  g.chElapsed = 0;
  g.chStreak = 0;
  g.chFreezes = chRules().freezes; // null : un gel à chaque calcul juste (Facile)
  g.netsLeft = [NETS_MAX];
  g.modal = null;
  g.secret = 1 + rnd(100);
  g.candidates = all(100);
  g.shownIds = [];
  prepareTurn();
  sfx('tap');
  render();
}
/** Termine le défi, calcule le score final et enregistre un éventuel record. */
function finishChallenge(won) {
  g.screen = 'end';
  g.inGame = false;
  g.modal = null;
  g.chWon = won;
  if (!won) revealEscaped(); // V9.4 : film de l'évasion aussi quand le défi est perdu
  g.chSecret = g.last && won ? g.last.n : g.secret;
  g.chFinal = won ? chScore(true) : 0;
  g.chRecordNew = false;
  if (won) {
    const r = records(),
      best = r[chRecordKey()] || 0;
    if (g.chFinal > best) {
      r[chRecordKey()] = g.chFinal;
      g.chRecordNew = true;
      try {
        localStorage.setItem(RECORDS_STORAGE, JSON.stringify(r));
      } catch (e) {}
    }
    sfx('win');
  } else sfx('bad');
}
/** De retour à l'accueil après un défi : rétablit le niveau et le nombre de joueurs d'avant. */
function restoreFromChallenge() {
  if (g.mode === 'challenge') {
    g.mode = 'normal';
    if (g.prevLevel) g.level = g.prevLevel;
    if (g.prevPlayers) g.players = g.prevPlayers;
    g.chKind = null;
  }
}
/**
 * Lance une nouvelle partie en gardant les réglages (langue, son, noms, aides, mode…).
 * Sans skipHandoff, une partie à plusieurs commence par la fenêtre « passe le téléphone ».
 */
function start(skipHandoff = false) {
  const {
    players,
    level,
    lang,
    sound,
    timerMode,
    reduceMotion,
    names,
    replayAsk,
    rpAuto,
    gameMode,
    starter,
    playerHelp,
    showInfo,
    chDiffPref,
    tutSeen,
    lastMulti,
    tipsSeen,
    myName,
    seriesPref,
    series,
    seriesContinue
  } = g;
  g = initial();
  g.players = players;
  g.level = level;
  g.lang = lang;
  g.sound = sound;
  g.timerMode = timerMode;
  g.reduceMotion = reduceMotion;
  g.names = names;
  g.replayAsk = replayAsk;
  g.rpAuto = rpAuto;
  g.showInfo = !!showInfo;
  g.tutSeen = !!tutSeen;
  g.lastMulti = lastMulti;
  g.myName = typeof myName === 'string' ? myName : ''; // prénom de CE téléphone en Wi-Fi
  g.tipsSeen = tipsSeen && typeof tipsSeen === 'object' ? tipsSeen : {};
  g.chDiffPref = chDiffPref in CHALLENGE_DIFFS ? chDiffPref : 'medium';
  g.gameMode = gameMode === 'score' ? 'score' : 'race';
  g.starter = players > 1 ? (starter || 0) % players : 0;
  g.playerHelp = Array.isArray(playerHelp) ? playerHelp.slice(0, 4) : [false, false, false, false];
  g.mode = 'normal';
  g.gameId = newGameId(); // identifiant stable : les récompenses solo ne sont attribuées qu'une fois
  // V9.16 : séries « premier à 2 / 3 victoires ». « Manche suivante » garde la série (mêmes joueurs,
  // même niveau, même mode) ; tout autre lancement en commence une nouvelle (ou aucune).
  g.seriesPref = [2, 3].includes(seriesPref) ? seriesPref : 0;
  const key = [players, level, g.gameMode, ...(names || []).slice(0, players)].join('|');
  if (players > 1 && g.seriesPref) {
    const keep = seriesContinue && series && series.key === key && !series.done;
    g.series = keep
      ? { ...series, wins: series.wins.slice(), round: series.round + 1, last: null }
      : { target: g.seriesPref, wins: Array(players).fill(0), round: 1, key, done: false, last: null };
  } else g.series = null;
  g.netsLeft = Array(players).fill(NETS_MAX);
  g.screen = 'game';
  g.inGame = true;
  g.modal = players > 1 && skipHandoff !== true ? 'handoff' : null;
  g.limit = TURN_LIMITS[players]; // V8.14 : 10 essais chacun à 2 (au lieu de 8)
  g.secret = 1 + rnd(maxN());
  g.scores = Array(players).fill(0);
  g.stars = Array(players).fill(0);
  g.candidates = all(maxN());
  prepareTurn();
  render();
}
