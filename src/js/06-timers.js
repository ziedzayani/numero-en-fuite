/*
 * Chronos. Ils n'avancent que si la partie est visible et qu'aucune fenêtre n'est ouverte
 * (pause, carnet, film…). tick() tourne toutes les 200 ms.
 *   global  : tout le tour (aide + choix du numéro) ; à 0, le tour est perdu et le numéro bouge ;
 *   answer  : choisir une question ; math : répondre au calcul ;
 *   challenge / chUp : défi chronométré (compte à rebours) / sans limite (temps écoulé).
 * Réglage « long » : ×1,5 ; « off » : aucun chrono (hors défi).
 */
/** Durées en secondes, par niveau. */
const LIMITS = {
  junior: { answer: 25, math: 30, global: 75 },
  malin: { answer: 20, math: 30, global: 70 },
  expert: { answer: 20, math: 45, global: 90 },
  genius: { answer: 20, math: 45, global: 100 }
};
const limitOf = k =>
  k === 'challenge'
    ? CH_TIME
    : LIMITS[g.level][k === 'turn' ? 'global' : k] * (g.timerMode === 'long' ? 1.5 : 1) * 1000;
const mathLimit = () => limitOf('math');
const mathLeft = () => Math.max(0, mathLimit() - g.mathElapsed);
const turnLeft = () => Math.max(0, limitOf('global') - g.turnElapsed);
const answerLeft = () => Math.max(0, limitOf('answer') - g.answerElapsed);
/** Chronos visibles en ce moment, du plus général au plus précis. */
function activeTimers() {
  if (g.screen !== 'game' || g.capturing) return [];
  if (g.mode === 'challenge') return [g.chKind === 'timed' ? 'challenge' : 'chUp'];
  if (g.timerMode === 'off' || g.phase !== 'choose' || !g.math) return [];
  const l = ['global'];
  if (!g.helpUsed) {
    if (g.tab === 'math' && g.mathStarted) l.push('math');
    else if (g.tab === 'question') l.push('answer');
  }
  return l;
}
function timerLeft(k) {
  return k === 'global'
    ? turnLeft()
    : k === 'math'
      ? mathLeft()
      : k === 'answer'
        ? answerLeft()
        : k === 'challenge'
          ? Math.max(0, CH_TIME - g.chElapsed)
          : g.chElapsed;
}
function timerText(k, left) {
  return k === 'challenge' || k === 'chUp' ? fmtTime(left) : t('seconds', { n: Math.ceil(left / 1000) });
}
/** Barres des chronos ; tick() les met à jour directement, sans render() complet. */
function timersHTML() {
  const l = activeTimers();
  if (!l.length) return '';
  const lab = {
    global: ['🕐', t('timerGlobal')],
    answer: ['💬', t('timerAnswer')],
    math: ['🧮', t('timerMathLabel')],
    challenge: ['🏆', t('chTimed')],
    chUp: ['⏱', '']
  };
  return `<div class="timers">${l
    .map(k => {
      const left = timerLeft(k),
        pct = k === 'chUp' ? 100 : Math.round((left / limitOf(k)) * 100);
      return `<div class="tmr ${k} ${k !== 'chUp' && left <= 5000 ? 'hurry' : ''}" data-tk="${k}" role="timer"><span class="tmr-l">${lab[k][0]} ${lab[k][1]}</span>${k === 'chUp' ? '' : `<div class="timer-bar" dir="ltr"><span style="width:${pct}%"></span></div>`}<b>${timerText(k, left)}</b></div>`;
    })
    .join('')}</div>`;
}
let lastTick = Date.now(),
  lastSec = null;
/** Avance les chronos actifs, met à jour les barres, déclenche les fins de temps. */
function tick() {
  const now = Date.now(),
    dt = Math.min(1000, now - lastTick);
  lastTick = now;
  const l = activeTimers();
  if (!l.length || g.modal || document.hidden) return;
  // Défi : le chrono s'arrête pendant la lecture du résultat (temps de lecture non pénalisé).
  if (g.mode === 'challenge' && g.phase !== 'choose') return;
  for (const k of l) {
    if (k === 'global') g.turnElapsed += dt;
    else if (k === 'math') g.mathElapsed += dt;
    else if (k === 'answer') g.answerElapsed += dt;
    else g.chElapsed += dt;
  }
  for (const k of l) {
    const el = document.querySelector(`[data-tk="${k}"]`);
    if (!el) continue;
    const left = timerLeft(k);
    const bar = el.querySelector('.timer-bar span');
    if (bar) bar.style.width = Math.round((left / limitOf(k)) * 100) + '%';
    el.querySelector('b').textContent = timerText(k, left).replace(/&[^;]+;/g, '');
    if (k !== 'chUp') el.classList.toggle('hurry', left <= 5000);
  }
  const urgent = l.filter(k => k !== 'chUp').map(timerLeft);
  if (urgent.length) {
    const sec = Math.ceil(Math.min(...urgent) / 1000);
    if (sec !== lastSec && sec <= 3 && sec > 0) sfx('tap');
    lastSec = sec;
  }
  if (l.includes('challenge') && timerLeft('challenge') <= 0) {
    finishChallenge(false);
    render();
    return;
  }
  if (l.includes('global') && turnLeft() <= 0) {
    turnTimeout();
    return;
  }
  if (l.includes('math') && mathLeft() <= 0) {
    mathTimeout();
    return;
  }
  if (l.includes('answer') && answerLeft() <= 0) {
    answerTimeout();
  }
}
/** Temps écoulé pour la question : l'aide est perdue, il reste à choisir un numéro. */
function answerTimeout() {
  if (g.screen !== 'game' || g.phase !== 'choose' || g.helpUsed) return;
  g.helpUsed = true;
  g.helpKind = null;
  g.answerLost = true;
  g.tab = 'guess';
  sfx('bad');
  render();
}
/** Temps écoulé pour le calcul : compté comme une réponse sans indice. */
function mathTimeout() {
  if (g.screen !== 'game' || g.phase !== 'choose' || g.helpUsed || !g.math) return;
  const player = active();
  g.helpUsed = true;
  g.helpKind = 'math';
  sfx('bad');
  const shift = nextMove();
  g.last = { type: 'math', player, correct: false, timeout: true, answer: null, shift, math: { ...g.math } };
  pushHist();
  g.phase = 'result';
  g.showHints = false;
  render();
}
/** Temps du tour écoulé : le numéro s'échappe et on passe au joueur suivant. */
function turnTimeout() {
  if (g.screen !== 'game' || g.phase !== 'choose') return;
  const player = active();
  sfx('bad');
  const shift = nextMove();
  g.last = { type: 'timeout', player, shift };
  pushHist();
  g.phase = 'result';
  g.showHints = false;
  render();
}
setInterval(tick, 200);
document.addEventListener('touchstart', () => {}, { passive: true });
document.addEventListener('visibilitychange', () => {
  lastTick = Date.now();
  if (document.hidden) {
    if (g.screen === 'game' && !g.modal && g.phase === 'choose') {
      g.modal = 'pause';
      render();
    }
    save();
  }
});
