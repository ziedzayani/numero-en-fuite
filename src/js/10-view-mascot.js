/*
 * Le détective de « The Number Hunt » (image du logo, V9.2) et les effets de fête.
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
/** Image du détective selon l'expression : celle du logo, « Bravo » (pouce levé) ou « Oups » (main sur la tête). */
const HUNTER_PIC = { proud: 'bravo', wink: 'oups', grimace: 'oups', worried: 'oups' };
/**
 * Le détective de « The Number Hunt » (V9.2) : le personnage du logo, dans un médaillon doré.
 *   état (classe de .detective-scene) : idle, think, search, aim, caught, proud, grimace, dash-left,
 *     dash-right, hop, worried, cheer, record → petit mouvement du médaillon (09-hunter.css)
 *   expression (expr-*) : choisit l'image (logo, Bravo, Oups) ; chapeau du rang : hat-r1 … hat-r8 (liseré)
 */
function mascot(state = 'idle', party = false, expr = null) {
  const e = expr || EXPR[state] || 'happy',
    pic = HUNTER_PIC[e] || 'main';
  return `<div class="detective-scene ${state} expr-${e} hat-r${heroRank()}" role="img" aria-label="${esc(t('title'))}"><div class="dt-rig"><span class="hp hp-${pic}"></span></div>${state === 'caught' || party ? confetti() : ''}</div>`;
}
/** Phrase du détective : variante choisie de façon stable pendant un même tour. */
function quip(key) {
  const list = t(key).split('|');
  return list[(g.turn * 7 + g.history.length * 3 + (g.tab || '').length) % list.length];
}
function confettiRain() {
  return `<div class="rain" aria-hidden="true">${Array.from({ length: 36 }, (_, i) => `<i style="left:${(i * 37) % 100}%;--d:${(i % 9) * 0.25}s;--t:${2.6 + (i % 5) * 0.5}s;--c:${['#ffc83d', '#ff8a3d', '#7d67ee', '#4ce08a', '#46b4ff', '#ffe08a'][i % 6]};--w:${6 + (i % 3) * 3}px"></i>`).join('')}</div>`;
}
function confetti() {
  return `<div class="confetti" aria-hidden="true">${Array.from({ length: 22 }, (_, i) => {
    const a = (i / 22) * Math.PI * 2,
      dist = 55 + (i % 4) * 14;
    return `<i style="--x:${Math.round(Math.cos(a) * dist)}px;--y:${Math.round(Math.sin(a) * dist)}px;--r:${(i * 39) % 550}deg;--delay:${(i % 5) * 32}ms;--c:${['#fdbb59', '#ff9f43', '#7d67f4', '#51ceb1', '#80d8ff'][i % 5]}"></i>`;
  }).join('')}</div>`;
}
