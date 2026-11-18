/*
 * Tutoriel : une mini-enquête ENTIÈREMENT scriptée, avec un numéro visible.
 * Elle montre en une minute ce qu'une vraie partie cache : la question raye des numéros,
 * puis le numéro s'enfuit et tout le carnet se décale avec lui, le parcours tourne en boucle
 * (après 9 on revient à 1), puis on choisit sa capture.
 * Elle n'utilise pas le moteur du jeu (aucun risque de toucher à une partie en cours) :
 * son seul état est g.tut = { step, sel, miss, loopOk, win }.
 */

/** Scénario : niveau Petit (1–9), le numéro est sur le 4, la question « plus grand que 5 ? », puis +1. */
const TUT = { max: 9, start: 4, threshold: 5, shift: 1, netSize: 2 };
/** Étapes, dans l'ordre. */
const TUT_STEPS = ['intro', 'ask', 'answer', 'move', 'loop', 'capture', 'done'];
const tutStep = () => TUT_STEPS[g.tut.step];
const tutAfter = name => g.tut.step >= TUT_STEPS.indexOf(name);
const tutSecret = () => (tutAfter('move') ? TUT.start + TUT.shift : TUT.start);
/** Numéros encore possibles dans le carnet à l'étape en cours. */
function tutPossible() {
  if (!tutAfter('answer')) return all(TUT.max);
  const kept = all(TUT.max).filter(n => n <= TUT.threshold);
  return tutAfter('move') ? kept.map(n => n + TUT.shift) : kept;
}
/** Numéros couverts par le filet du tutoriel (même règle que netRange au niveau Petit). */
const tutNet = n => {
  const first = Math.min(Math.max(1, n), TUT.max - TUT.netSize + 1);
  return Array.from({ length: TUT.netSize }, (_, i) => first + i);
};

function openTutorial() {
  g.tut = { step: 0, sel: null, miss: null, loopOk: false };
  g.tutSeen = true;
  g.modal = 'tutorial';
  sfx('tap');
  render();
}
function tutNext() {
  if (tutStep() === 'loop' && !g.tut.loopOk) return;
  g.tut.step = Math.min(TUT_STEPS.length - 1, g.tut.step + 1);
  g.tut.sel = null;
  g.tut.miss = null;
  sfx('tap');
  render();
}
/** Étape « boucle » : le joueur touche la case où arrive un numéro parti du 9 avec +1. */
function tutLoopPick(n) {
  if (tutStep() !== 'loop') return;
  g.tut.sel = n;
  g.tut.loopOk = n === 1;
  sfx(g.tut.loopOk ? 'win' : 'bad');
  render();
}
/** Capture du tutoriel : réussie → dernière étape ; ratée → explication et nouvel essai. */
function tutCapture(mode) {
  const n = g.tut.sel;
  if (tutStep() !== 'capture' || n == null) return;
  const nums = mode === 'net' ? tutNet(n) : [n];
  if (nums.includes(tutSecret())) {
    g.tut.win = mode;
    g.tut.step = TUT_STEPS.indexOf('done');
    sfx('win');
  } else {
    g.tut.miss = { mode, nums };
    g.tut.sel = null;
    sfx('bad');
  }
  render();
}

/** Grille 1–9 du carnet du tutoriel ; `clickable` rend les cases cliquables (data-tutpick). */
function tutGrid(cellClass, clickable) {
  return `<div class="tut-grid" dir="ltr">${all(TUT.max)
    .map(n =>
      clickable
        ? `<button class="tut-cell ${cellClass(n)}" data-tutpick="${n}">${n}</button>`
        : `<span class="tut-cell ${cellClass(n)}">${n}</span>`
    )
    .join('')}</div>`;
}

/** HTML de la fenêtre du tutoriel. */
function tutorialView() {
  const { sel, miss } = g.tut,
    step = tutStep(),
    possible = tutPossible(),
    secret = tutSecret(),
    net = step === 'capture' && sel != null ? tutNet(sel) : [];
  const grid = tutGrid(
    n =>
      [
        possible.includes(n) ? '' : 'out',
        n === secret ? 'secret' : '',
        n === sel ? 'sel' : net.includes(n) ? 'in-net' : '',
        step === 'move' && n === secret ? 'arrived' : '',
        step === 'move' && possible.includes(n) ? 'shifted' : ''
      ].join(' '),
    step === 'capture'
  );
  const legend = `<p class="tut-legend"><span class="tut-dot secret"></span>${t('tutLegendSecret')} <span class="tut-dot out"></span>${t('tutLegendOut')}</p>`;
  const next = () => `<button class="bigbtn" id="tutNext">${t('tutNext')} ▶</button>`;
  let body = '',
    actions = next();
  if (step === 'intro') body = `<p>${t('tut0', { n: TUT.start, max: TUT.max })}</p>${grid}${legend}`;
  else if (step === 'ask') {
    body = `<p>${t('tut1')}</p>${grid}`;
    actions = `<button class="qbtn tut-q" id="tutAsk"><span class="qicon">📏</span><span class="qtext">${t('qGreater', { k: TUT.threshold })}</span></button>`;
  } else if (step === 'answer')
    body = `<div class="result-title">${t('noAnswer')}</div><p>${t('tut2', { k: TUT.threshold })}</p>${grid}${legend}`;
  else if (step === 'move')
    body = `<div class="move-line">${blindJump(TUT.shift)}<span>${t('tut3', { from: TUT.start, to: secret })}</span></div>${grid}`;
  else if (step === 'loop') {
    // Démonstration à part : un numéro sur 8 fait +1 (→ 9), puis encore +1 : après 9, on revient à 1.
    const loopGrid = tutGrid(
      n =>
        [
          n === 8 ? 'loop-a' : '',
          n === 9 ? 'loop-b' : '',
          n === sel ? (g.tut.loopOk ? 'sel' : 'wrong') : ''
        ].join(' '),
      true
    );
    body = `<p>${t('tutLoop')}</p><div class="tut-loop ${sel != null ? 'answered' : ''}">${loopGrid}<svg class="loop-arrow" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true"><path d="M95 2 C95 22 5 22 5 2" /></svg></div><p class="tut-loop-msg">${sel == null ? t('tutLoopAsk') : g.tut.loopOk ? t('tutLoopOk') : t('tutLoopNo')}</p>`;
    actions = g.tut.loopOk ? next() : ''; // « Suivant » n'apparaît qu'après la bonne case
  } else if (step === 'capture') {
    body = `<p>${miss ? t(miss.mode === 'net' ? 'tutMissNet' : 'tutMiss', { nums: miss.nums.join('·'), n: secret }) : t('tut4')}</p>${grid}`;
    actions = `<div class="capture-row"><button class="capbtn precise" id="tutPrecise" ${sel == null ? 'disabled' : ''}><span>🎯 ${t('captPrecise')}</span><small><bdi dir="ltr">+${SCORE.precise}</bdi></small></button><button class="capbtn net" id="tutNet" ${sel == null ? 'disabled' : ''}><span>🕸️ ${sel != null ? `<bdi dir="ltr">${net.join('·')}</bdi>` : t('captNet')}</span><small><bdi dir="ltr">+${SCORE.net}</bdi></small></button></div>`;
  } else {
    body = `<div class="hero-mascot small-mascot">${mascot('caught')}</div><div class="result-title">🎉 ${t('bravo')}</div><p>${t(g.tut.win === 'net' ? 'tutWinNet' : 'tutWin', { n: secret })}</p><div class="help-detail">${t('tut5')}</div>`;
    actions = `<button class="bigbtn green" id="tutPlay">▶ ${t('play')}</button><button class="bigbtn light" id="tutRestart">🔁 ${t('tutRestart')}</button>`;
  }
  return `<div class="tut-head"><h2>🎓 ${t('tutTitle')}</h2><span class="rp-step">${t('rpStep', { i: g.tut.step + 1, n: TUT_STEPS.length })}</span><button class="tut-close" id="tutClose" aria-label="${t('close')}">✕</button></div><div class="tut-body">${body}</div>${actions}`;
}

/** Fenêtre proposée au tout premier lancement : le tutoriel est conseillé, jamais imposé. */
function tutInviteView() {
  return `<div class="hero-mascot small-mascot">${mascot('think')}</div><h2>👋 ${t('tutInviteTitle')}</h2><p>${t('tutInviteText')}</p><button class="bigbtn green" id="inviteTutorial">🎓 ${t('tutTry')}</button><button class="bigbtn light" id="closeModal">${t('tutLater')}</button>`;
}
