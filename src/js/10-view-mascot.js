/*
 * Le détective de « The Number Hunt » (SVG, V9) et les effets de fête.
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
let mascotSeq = 0; // identifiants uniques (motif écossais du chapeau) quand plusieurs détectives sont affichés
/**
 * Le détective de « The Number Hunt » (V9), dessiné en SVG d'après le logo : casquette de chasseur
 * à carreaux, imperméable, cravate, loupe. Mêmes états et expressions que l'ancien détective violet :
 *   état (classe de .detective-scene) : idle, think, search, aim, caught, proud, grimace, dash-left,
 *     dash-right, hop, worried, cheer, record → animation de tout le personnage (09-hunter.css)
 *   expression (expr-*) : happy, curious, proud, grimace, surprised, worried, wink → yeux, sourcils, bouche
 *   chapeau : couleurs du rang (hat-r1 … hat-r8, variables --hat-base / --hat-top / --hat-brim)
 */
function mascot(state = 'idle', party = false, expr = null) {
  const e = expr || EXPR[state] || 'happy',
    id = 'nh' + ++mascotSeq;
  const svg = `<svg class="nh" viewBox="0 0 150 150" aria-hidden="true" focusable="false"><defs><pattern id="${id}p" width="8" height="8" patternUnits="userSpaceOnUse"><rect class="nh-plaid-a" width="8" height="8"/><path class="nh-plaid-b" d="M0 4H8M4 0V8"/></pattern><radialGradient id="${id}g" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#e9f6ff"/><stop offset=".45" stop-color="#5fb0ff"/><stop offset="1" stop-color="#1d4fa8"/></radialGradient></defs>
<ellipse class="nh-shadow" cx="75" cy="144" rx="34" ry="5"/>
<g class="nh-all">
<g class="nh-legs"><path class="nh-leg l" d="M61 118h10v22h-10z"/><path class="nh-leg r" d="M79 118h10v22h-10z"/><ellipse class="nh-shoe" cx="64" cy="141" rx="9" ry="4"/><ellipse class="nh-shoe" cx="87" cy="141" rx="9" ry="4"/></g>
<g class="nh-arm-l"><path class="nh-sleeve" d="M53 86c-7 4-11 15-12 27l9 2c1-9 4-17 8-21z"/><circle class="nh-skin" cx="45" cy="117" r="5.5"/></g>
<path class="nh-coat" d="M56 80h38c8 3 12 10 13 20l2 24c-11 5-57 5-68 0l2-24c1-10 5-17 13-20z"/>
<path class="nh-coat-dark" d="M43 104h64v6H43z"/>
<path class="nh-shirt" d="M66 80h18l-9 18z"/><path class="nh-tie" d="M73 82h4l2 4-4 12-4-12z"/>
<path class="nh-lapel" d="M66 80l9 18-13-6 1-12zM84 80l-9 18 13-6-1-12z"/>
<circle class="nh-button" cx="68" cy="116" r="1.8"/><circle class="nh-button" cx="82" cy="116" r="1.8"/>
<g class="nh-head"><circle class="nh-skin" cx="54" cy="55" r="4.5"/><circle class="nh-skin" cx="96" cy="55" r="4.5"/>
<path class="nh-skin nh-face" d="M54 48c0-14 9-22 21-22s21 8 21 22v6c0 13-9 22-21 22s-21-9-21-22z"/>
<path class="nh-hair" d="M54 50c0-6 2-11 6-14l3 2c-3 4-4 8-4 14zM96 50c0-6-2-11-6-14l-3 2c3 4 4 8 4 14z"/>
<g class="nh-eyes"><ellipse class="nh-eye" cx="66.5" cy="53" rx="4.4" ry="4.8"/><ellipse class="nh-eye" cx="83.5" cy="53" rx="4.4" ry="4.8"/><circle class="nh-pupil left" cx="67" cy="54" r="2.4"/><circle class="nh-pupil right" cx="84" cy="54" r="2.4"/><path class="nh-lid" d="M62 53q4.5 4 9 0M79 53q4.5 4 9 0"/><path class="nh-wink" d="M79.5 54q4 3 8 0"/></g>
<path class="nh-brow l" d="M61 45.5q5-3 10 0"/><path class="nh-brow r" d="M79 45.5q5-3 10 0"/>
<path class="nh-nose" d="M75 55q-2 5 0 7"/>
<path class="nh-mouth smile" d="M67 66q8 6 16 0"/><path class="nh-mouth grin" d="M66 64.5q9 9 18 0z"/><ellipse class="nh-mouth oh" cx="75" cy="67" rx="3.5" ry="4.2"/><path class="nh-mouth flat" d="M68 67.5q7-4 14 0"/>
</g>
<g class="nh-hat"><path class="nh-brim-back" d="M50 41q25-10 50 0l2 4q-27-7-54 0z"/><path fill="url(#${id}p)" class="nh-crown" d="M51 42q-1-27 24-28q25 1 24 28q-24-7-48 0z"/><path class="nh-crown-line" d="M75 15v21"/><path class="nh-brim" d="M49 40q26-6 52 0l3 6q-29-6-58 0z"/><path class="nh-bow" d="M75 15c-6-6-11-3-9 1 2 3 6 1 9-1zm0 0c6-6 11-3 9 1-2 3-6 1-9-1z"/><text class="nh-star" x="75" y="34" text-anchor="middle">★</text></g>
<g class="nh-arm-r"><path class="nh-sleeve" d="M97 86c7 2 12 8 13 16l-9 3c-1-5-3-8-7-10z"/><g class="nh-glass"><path class="nh-handle" d="M106 101l7-12"/><circle class="nh-ring" cx="119" cy="78" r="12"/><circle cx="119" cy="78" r="9" fill="url(#${id}g)"/><path class="nh-shine" d="M113 74q3-5 8-5"/></g><circle class="nh-skin" cx="106" cy="102" r="5.5"/></g>
</g></svg>`;
  return `<div class="detective-scene ${state} expr-${e} hat-r${heroRank()}" role="img" aria-label="${esc(t('title'))}"><span class="detector-orbit one">7</span><span class="detector-orbit two">?</span><span class="detector-orbit three">5</span><div class="think-dots" aria-hidden="true"><i></i><i></i><i></i></div><div class="dt-rig">${svg}</div>${state === 'caught' || party ? confetti() : ''}</div>`;
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
