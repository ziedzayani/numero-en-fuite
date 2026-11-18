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
/** Score du défi ; withBonus ajoute le bonus de temps restant. */
function chScore(withBonus = false) {
  const h = g.history,
    n = f => h.filter(f).length;
  let sc =
    1000 -
    25 * g.turn -
    10 * n(e => e.type === 'question' || (e.type === 'math' && !e.correct)) -
    20 * n(e => e.type === 'wrong') -
    40 * n(e => e.type === 'netMiss') +
    (g.chBonus || 0);
  if (withBonus) {
    if (g.last && g.last.type === 'netHit') sc -= 50;
    if (g.chKind === 'timed') sc += 2 * Math.ceil(Math.max(0, CH_TIME - g.chElapsed) / 1000);
  }
  return Math.max(0, sc);
}
/** Durée en m:ss. */
const fmtTime = ms => {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
};
/** Lance un défi ('timed' | 'endless') en mémorisant niveau et joueurs pour les restaurer ensuite. */
function startChallenge(kind) {
  g.playerHelp = [false, false, false, false];
  const prevLevel = g.mode === 'challenge' ? g.prevLevel : g.level,
    prevPlayers = g.mode === 'challenge' ? g.prevPlayers : g.players;
  g.players = 1;
  g.level = 'expert';
  start();
  g.mode = 'challenge';
  g.chKind = kind;
  g.prevLevel = prevLevel;
  g.prevPlayers = prevPlayers;
  g.limit = 0;
  g.chElapsed = 0;
  g.chBonus = 0;
  g.chStreak = 0;
  g.netsLeft = [3];
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
  g.chSecret = g.last && won ? g.last.n : g.secret;
  g.chFinal = won ? chScore(true) : 0;
  g.chRecordNew = false;
  if (won) {
    const r = records(),
      best = r[g.chKind] || 0;
    if (g.chFinal > best) {
      r[g.chKind] = g.chFinal;
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
    showInfo
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
  g.gameMode = gameMode === 'score' ? 'score' : 'race';
  g.starter = players > 1 ? (starter || 0) % players : 0;
  g.playerHelp = Array.isArray(playerHelp) ? playerHelp.slice(0, 4) : [false, false, false, false];
  g.mode = 'normal';
  g.netsLeft = Array(players).fill(3);
  g.screen = 'game';
  g.inGame = true;
  g.modal = players > 1 && skipHandoff !== true ? 'handoff' : null;
  g.limit = [0, 12, 16, 18, 20][players];
  g.secret = 1 + rnd(maxN());
  g.scores = Array(players).fill(0);
  g.stars = Array(players).fill(0);
  g.candidates = all(maxN());
  prepareTurn();
  render();
}
