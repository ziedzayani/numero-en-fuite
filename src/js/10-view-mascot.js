/*
 * Le détective violet (dessiné en HTML/CSS) et les effets de fête.
 * mascot(state) choisit l'animation : idle, think, aim, caught, grimace, dash-left…
 */

const EXPR = {
  idle: 'happy',
  think: 'curious',
  search: 'curious',
  aim: 'curious',
  caught: 'proud',
  proud: 'proud',
  grimace: 'grimace',
  'dash-left': 'surprised',
  'dash-right': 'surprised',
  hop: 'surprised',
  worried: 'worried',
  cheer: 'wink', // défaite : clin d'œil d'encouragement (V8.15)
  record: 'proud' // nouveau record : saut de joie et trophée
};
function mascot(state = 'idle', party = false, expr = null) {
  const e = expr || EXPR[state] || 'happy';
  // chapeau selon le rang du joueur (V8.15) : le rang 1 garde le chapeau d'origine
  return `<div class="detective-scene ${state} expr-${e} hat-r${heroRank()}" role="img" aria-label="${esc(t('title'))}"><span class="detector-orbit one">3</span><span class="detector-orbit two">?</span><span class="detector-orbit three">7</span><div class="detective-shadow"></div><div class="think-dots" aria-hidden="true"><i></i><i></i><i></i></div><div class="dt-rig"><div class="detector-magnifier"></div><div class="detector-hat"></div><div class="detector-brim"></div><div class="detective"><span class="detector-brow left"></span><span class="detector-brow right"></span><span class="detector-pupil left"></span><span class="detector-pupil right"></span><span class="detector-blush left"></span><span class="detector-blush right"></span><span class="detector-smile"></span><span class="detector-mouth"></span><span class="detector-tongue"></span></div><div class="detector-body"></div><div class="detector-hand left"></div><div class="detector-hand right"></div><div class="detector-leg left"></div><div class="detector-leg right"></div><div class="detector-foot left"></div><div class="detector-foot right"></div></div>${state === 'caught' || party ? confetti() : ''}</div>`;
}
/** Phrase du détective : variante choisie de façon stable pendant un même tour. */
function quip(key) {
  const list = t(key).split('|');
  return list[(g.turn * 7 + g.history.length * 3 + (g.tab || '').length) % list.length];
}
function confettiRain() {
  return `<div class="rain" aria-hidden="true">${Array.from({ length: 36 }, (_, i) => `<i style="left:${(i * 37) % 100}%;--d:${(i % 9) * 0.25}s;--t:${2.6 + (i % 5) * 0.5}s;--c:${['#ffd84d', '#f36ab6', '#7d67ee', '#4ce08a', '#46b4ff', '#ff8a4c'][i % 6]};--w:${6 + (i % 3) * 3}px"></i>`).join('')}</div>`;
}
function confetti() {
  return `<div class="confetti" aria-hidden="true">${Array.from({ length: 22 }, (_, i) => {
    const a = (i / 22) * Math.PI * 2,
      dist = 55 + (i % 4) * 14;
    return `<i style="--x:${Math.round(Math.cos(a) * dist)}px;--y:${Math.round(Math.sin(a) * dist)}px;--r:${(i * 39) % 550}deg;--delay:${(i % 5) * 32}ms;--c:${['#fdbb59', '#fa75a1', '#7d67f4', '#51ceb1', '#80d8ff'][i % 5]}"></i>`;
  }).join('')}</div>`;
}
