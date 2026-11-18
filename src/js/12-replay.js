/*
 * Film du parcours du numéro (« Revoir l'évasion ») : une étape toutes les RP_STEP ms
 * (ou bouton par bouton), avec le déplacement, le choix de chaque joueur et la capture finale.
 */

let replayTimer = null;
const RP_STEP = 6000;
/** Étapes du film : départ, chaque déplacement (ou gel), capture. */
function rpFrames() {
  const h = g.lastHunt;
  if (!h) return [];
  return [
    { k: 'start', n: h.start },
    ...h.steps.map(st => ({ k: st.frozen ? 'frozen' : 'move', ...st })),
    { k: 'end', n: h.end.n, ev: h.end }
  ];
}
function rpIcon(e) {
  return e
    ? { question: '💡', math: '🧮', wrong: '🎯', netMiss: '🕸️', timeout: '⏱', found: '🎉', netHit: '🕸️' }[
        e.type
      ] || '•'
    : '👣';
}
/** Fenêtre du film pour l'étape g.rpIdx. */
function replayView() {
  const fr = rpFrames(),
    i = Math.min(g.rpIdx || 0, fr.length - 1),
    f = fr[i],
    h = g.lastHunt,
    max = h.max,
    cur = f.k === 'start' || f.k === 'end' ? f.n : f.to;
  const visited = new Set([h.start]);
  for (let j = 1; j <= i; j++) {
    const x = fr[j];
    if (x.k === 'move' || x.k === 'frozen') {
      visited.add(x.from);
      visited.add(x.to);
    }
  }
  const dir = f.k === 'move' ? moveDir(f.shift) : 0,
    anim =
      f.k === 'end'
        ? 'rp-win'
        : f.k === 'frozen'
          ? 'rp-freeze'
          : f.k === 'start'
            ? 'rp-in'
            : dir < 0
              ? 'rp-left'
              : dir > 0
                ? 'rp-right'
                : 'rp-hop';
  let cap = '';
  if (f.k === 'start') cap = '🕵️ ' + t('rpStart', { n: f.n });
  else if (f.k === 'end') cap = '🎉 ' + t('rpCaught', { n: f.n, player: pname(f.ev.player) });
  else {
    let ht = f.ev ? historyText(f.ev) : '';
    const sym = f.ev && f.ev.shift != null ? ' · ' + shiftSymbol(f.ev.shift) : '';
    if (sym && ht.endsWith(sym)) ht = ht.slice(0, -sym.length);
    cap = f.ev ? rpIcon(f.ev) + ' ' + ht : '';
  }
  const shLabel =
    typeof f.shift === 'number'
      ? f.shift > 0
        ? '+' + f.shift
        : '−' + Math.abs(f.shift)
      : f.shift && f.shift.op === '+'
        ? f.shift.k > 0
          ? '+' + f.shift.k
          : '−' + Math.abs(f.shift.k)
        : f.shift && f.shift.op === 'mirror'
          ? '🪞'
          : f.shift
            ? f.shift.op + f.shift.k
            : '';
  const sk = typeof f.shift === 'number' ? f.shift : f.shift && f.shift.op === '+' ? f.shift.k : 0,
    wraps = f.k === 'move' && sk !== 0 && ((sk < 0 && f.to > f.from) || (sk > 0 && f.to < f.from));
  const mv =
    f.k === 'move'
      ? `<div class="rp-move" dir="ltr"><span>${f.from}</span><b class="mv-arrow"><i>${shLabel}</i><em>➜</em></b><span>${f.to}</span></div>` +
        (wraps
          ? `<div class="rp-hint wrap">${t(sk < 0 ? 'mvWrapDown' : 'mvWrapUp', { max })}</div>`
          : moveHint(f.shift)
            ? `<div class="rp-hint">${moveHint(f.shift)}</div>`
            : '')
      : f.k === 'frozen'
        ? `<div class="rp-move frozen">🧊 ${t('rpFrozen', { n: f.to })}</div>`
        : '';
  const ev = f.ev,
    pk =
      ev &&
      (ev.type === 'wrong'
        ? { bad: true, txt: '🎯 ' + ev.n, cells: [ev.n] }
        : ev.type === 'netMiss'
          ? { bad: true, txt: '🕸️ ' + ev.nums.join('·'), cells: ev.nums }
          : ev.type === 'math' && !ev.correct && ev.picked != null
            ? { bad: true, txt: '🧮 ' + ev.picked, cells: [] }
            : ev.type === 'found'
              ? { bad: false, txt: '🎯 ' + ev.n, cells: [ev.n] }
              : ev.type === 'netHit'
                ? { bad: false, txt: '🕸️ ' + ev.nums.join('·'), cells: ev.nums }
                : null);
  const pickHTML = pk
    ? `<div class="rp-pick ${pk.bad ? 'bad' : 'good'}" dir="ltr"><b>${esc(pname(ev.player))}</b> ${pk.txt} ${pk.bad ? '✗' : '✓'}</div>${pk.bad && f.k === 'move' && pk.cells.length ? `<div class="rp-was">${t('rpWas', { n: f.from })}</div>` : ''}`
    : '';
  const pickCells = new Set(pk ? pk.cells : []);
  return `<div class="rp-head"><h2>🎬 ${t('rpTitle')}</h2><span class="rp-step">${t('rpStep', { i: i + 1, n: fr.length })}</span></div>
 <div class="rp-stage ${f.k === 'end' ? 'win' : ''} ${g.reduceMotion ? 'still' : ''}">${f.k === 'move' && !g.reduceMotion ? `<div class="rp-from ${dir < 0 ? 'go-left' : dir > 0 ? 'go-right' : 'go-up'}" dir="ltr">${f.from}</div><div class="rp-trail ${dir < 0 ? 'left' : 'right'}" aria-hidden="true">👣</div>` : ''}<div class="rp-num ${g.reduceMotion ? '' : anim + ' delayed'}" dir="ltr" data-i="${i}">${cur}</div>${pickHTML}${f.k === 'end' && !g.reduceMotion ? confetti() : ''}${g.rpPlaying && i < fr.length - 1 ? `<i class="rp-bar" style="animation-duration:${RP_STEP}ms"></i>` : ''}</div>
 ${mv}<p class="rp-cap">${cap}</p>
 <div class="rp-track ${max > 15 ? 'dense' : ''} ${max > 50 ? 'xdense' : ''}" dir="ltr">${all(max)
   .map(
     n =>
       `<span class="${n === cur ? 'cur' : visited.has(n) ? 'trail' : ''} ${n === h.start ? 'st' : ''} ${pickCells.has(n) ? (pk.bad ? 'miss' : 'hit') : ''}">${max <= 50 || n === cur || visited.has(n) || pickCells.has(n) ? n : ''}</span>`
   )
   .join('')}</div>
 <div class="rp-dots">${fr.map((_, j) => `<i class="${j < i ? 'done' : j === i ? 'on' : ''}"></i>`).join('')}</div>
 <div class="rp-mode" role="radiogroup"><button role="radio" class="${g.rpAuto !== false ? 'on' : ''}" aria-checked="${g.rpAuto !== false}" id="rpModeAuto">▶ ${t('rpAuto')}</button><button role="radio" class="${g.rpAuto === false ? 'on' : ''}" aria-checked="${g.rpAuto === false}" id="rpModeManual">👆 ${t('rpManual')}</button></div><div class="rp-ctrl ${g.rpAuto === false ? 'manual' : ''}" dir="ltr"><button class="key rp-restart" id="rpRestart" aria-label="⏮" title="⏮">⏮</button><button class="key rp-prev" id="rpPrev" aria-label="${t('rpPrev')}" title="${t('rpPrev')}" ${i === 0 ? 'disabled' : ''}><span>◀</span><span class="lbl">${t('rpPrev')}</span></button>${g.rpAuto === false ? '' : `<button class="key rp-play" id="rpPlay" aria-label="⏯">${g.rpPlaying ? '⏸' : '▶'}</button>`}<button class="key rp-next" id="rpNext" ${i >= fr.length - 1 ? 'disabled' : ''}>${t('rpNext')} <span>▶</span></button></div>
 <button class="bigbtn light" id="rpClose">${t('close')}</button>`;
}
/** Programme l'étape suivante en mode automatique (appelée à chaque render()). */
function rpSchedule() {
  clearTimeout(replayTimer);
  if (g.modal !== 'replay' || !g.rpPlaying) return;
  replayTimer = setTimeout(() => {
    if (g.modal !== 'replay' || !g.rpPlaying) return;
    const n = rpFrames().length;
    if ((g.rpIdx || 0) < n - 1) {
      g.rpIdx++;
      sfx(g.rpIdx === n - 1 ? 'win' : 'move');
    }
    if (g.rpIdx >= n - 1) g.rpPlaying = false;
    render();
  }, RP_STEP);
}
function openReplay() {
  g.modal = 'replay';
  g.rpIdx = 0;
  g.rpPlaying = g.rpAuto !== false;
  render();
}
