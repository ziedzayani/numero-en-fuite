/*
 * Démarrage et points d'entrée externes.
 */

function back() {
  if (['rules', 'names', 'challenge'].includes(g.modal) && g.screen === 'home') {
    g.modal = null;
    render();
    return true;
  }
  if (g.screen === 'game' && g.modal === 'quit') {
    g.modal = 'pause';
    render();
    return true;
  }
  if (g.screen === 'game' && ['replay', 'replayAsk'].includes(g.modal)) {
    g.rpPlaying = false;
    g.modal = null;
    render();
    return true;
  }
  if (g.screen === 'game' && ['pause', 'notebook'].includes(g.modal)) {
    g.modal = null;
    lastTick = Date.now();
    render();
    return true;
  }
  if (g.screen === 'game' && g.modal === 'handoff') return true;
  if (g.screen === 'settings') {
    g.screen = ['home', 'game', 'end'].includes(g.settingsFrom) ? g.settingsFrom : 'home';
    render();
    return true;
  }
  if (g.screen === 'game') {
    g.modal = 'pause';
    render();
    return true;
  }
  if (g.screen === 'end') {
    g.screen = 'home';
    render();
    return true;
  }
  return false;
}
load();
if (g.screen === 'game' && g.phase === 'choose' && (!g.math || !g.choices.length)) prepareTurn();
render();
/**
 * API publique du jeu :
 *   - back() est appelée par l'application Android (bouton Retour, MainActivity.java) ;
 *   - le reste sert aux tests automatiques (tests/game.test.cjs) pour lire l'état et jouer des coups.
 * Ne pas renommer sans mettre à jour ces deux fichiers.
 */
window.__numero = {
  get state() {
    return g;
  },
  start,
  ask,
  guess,
  mathAnswer,
  nextTurn,
  maxN,
  qbyid,
  wrap,
  dictionaries,
  render,
  back,
  netsLeft,
  openReplay,
  rpFrames,
  RP_STEP,
  mathTimeout,
  mathLeft,
  tick,
  turnTimeout,
  turnLeft,
  limitOf,
  answerLeft,
  answerTimeout,
  startChallenge,
  finishChallenge,
  chScore,
  pressKey,
  moveFn,
  nextMove,
  records,
  netCapture,
  netRange,
  netSize,
  launchCapture,
  helpMode
};
window.__numeroV5 = window.__numero;
