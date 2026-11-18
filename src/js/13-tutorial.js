/*
 * Tutoriel : une mini-enquête ENTIÈREMENT scriptée, avec un numéro visible.
 * Elle montre en une minute ce qu'une vraie partie cache : la question raye des numéros,
 * puis le numéro s'enfuit et tout le carnet se décale avec lui, puis on choisit sa capture.
 * Elle n'utilise pas le moteur du jeu (aucun risque de toucher à une partie en cours) :
 * son seul état est g.tut = { step, sel, miss }.
 */

/** Scénario : niveau Petit (1–9), le numéro est sur le 4, la question « plus grand que 5 ? », puis +1. */
const TUT = { max: 9, start: 4, threshold: 5, shift: 1, netSize: 2, steps: 6 };
const tutSecret = () => (g.tut.step >= 3 ? TUT.start + TUT.shift : TUT.start);
/** Numéros encore possibles dans le carnet à l'étape en cours. */
function tutPossible() {
  const s = g.tut.step;
  if (s <= 1) return all(TUT.max);
  const kept = all(TUT.max).filter(n => n <= TUT.threshold);
  return s === 2 ? kept : kept.map(n => n + TUT.shift);
}
/** Numéros couverts par le filet du tutoriel (même règle que netRange au niveau Petit). */
const tutNet = n => {
  const first = Math.min(Math.max(1, n), TUT.max - TUT.netSize + 1);
  return Array.from({ length: TUT.netSize }, (_, i) => first + i);
};

function openTutorial() {
  g.tut = { step: 0, sel: null, miss: null };
  g.modal = 'tutorial';
  sfx('tap');
  render();
}
function tutNext() {
  g.tut.step = Math.min(TUT.steps - 1, g.tut.step + 1);
  g.tut.sel = null;
  g.tut.miss = null;
  sfx('tap');
  render();
}
/** Capture du tutoriel : réussie → dernière étape ; ratée → explication et nouvel essai. */
function tutCapture(mode) {
  const n = g.tut.sel;
  if (g.tut.step !== 4 || n == null) return;
  const nums = mode === 'net' ? tutNet(n) : [n];
  if (nums.includes(tutSecret())) {
    g.tut.win = mode;
    g.tut.step = 5;
    sfx('win');
  } else {
    g.tut.miss = { mode, nums };
    g.tut.sel = null;
    sfx('bad');
  }
  render();
}

/** HTML de la fenêtre du tutoriel. */
function tutorialView() {
  const { step, sel, miss } = g.tut,
    possible = tutPossible(),
    secret = tutSecret(),
    net = step === 4 && sel != null ? tutNet(sel) : [];
  const grid = `<div class="tut-grid" dir="ltr">${all(TUT.max)
    .map(n => {
      const cls = [
        possible.includes(n) ? '' : 'out',
        n === secret ? 'secret' : '',
        n === sel ? 'sel' : net.includes(n) ? 'in-net' : '',
        step === 3 && n === secret ? 'arrived' : ''
      ].join(' ');
      return step === 4
        ? `<button class="tut-cell ${cls}" data-tutpick="${n}">${n}</button>`
        : `<span class="tut-cell ${cls}">${n}</span>`;
    })
    .join('')}</div>`;
  const legend = `<p class="tut-legend"><span class="tut-dot secret"></span>${t('tutLegendSecret')} <span class="tut-dot out"></span>${t('tutLegendOut')}</p>`;
  let body = '',
    actions = `<button class="bigbtn" id="tutNext">${t('tutNext')} ▶</button>`;
  if (step === 0) body = `<p>${t('tut0', { n: TUT.start, max: TUT.max })}</p>${grid}${legend}`;
  else if (step === 1) {
    body = `<p>${t('tut1')}</p>${grid}`;
    actions = `<button class="qbtn tut-q" id="tutAsk"><span class="qicon">📏</span><span class="qtext">${t('qGreater', { k: TUT.threshold })}</span></button>`;
  } else if (step === 2)
    body = `<div class="result-title">${t('noAnswer')}</div><p>${t('tut2', { k: TUT.threshold })}</p>${grid}${legend}`;
  else if (step === 3)
    body = `<div class="move-line">${blindJump(TUT.shift)}<span>${t('tut3', { from: TUT.start, to: secret })}</span></div>${grid}`;
  else if (step === 4) {
    body = `<p>${miss ? t(miss.mode === 'net' ? 'tutMissNet' : 'tutMiss', { nums: miss.nums.join('·'), n: secret }) : t('tut4')}</p>${grid}`;
    actions = `<div class="capture-row"><button class="capbtn precise" id="tutPrecise" ${sel == null ? 'disabled' : ''}><span>🎯 ${t('captPrecise')}</span><small><bdi dir="ltr">+${SCORE.precise}</bdi></small></button><button class="capbtn net" id="tutNet" ${sel == null ? 'disabled' : ''}><span>🕸️ ${sel != null ? `<bdi dir="ltr">${net.join('·')}</bdi>` : t('captNet')}</span><small><bdi dir="ltr">+${SCORE.net}</bdi></small></button></div>`;
  } else {
    body = `<div class="hero-mascot small-mascot">${mascot('caught')}</div><div class="result-title">🎉 ${t('bravo')}</div><p>${t(g.tut.win === 'net' ? 'tutWinNet' : 'tutWin', { n: secret })}</p><div class="help-detail">${t('tut5')}</div>`;
    actions = `<button class="bigbtn green" id="tutPlay">▶ ${t('play')}</button>`;
  }
  return `<div class="tut-head"><h2>🎓 ${t('tutTitle')}</h2><span class="rp-step">${t('rpStep', { i: step + 1, n: TUT.steps })}</span></div><div class="tut-body">${body}</div>${actions}<button class="mini-btn" id="tutClose">${t('close')}</button>`;
}
