/*
 * Écrans. Chaque fonction RENVOIE du HTML (chaîne) à partir de `g` ; aucune ne modifie
 * l'état. Les clics sont branchés ensuite par bind() (13-render.js) grâce aux id et data-*.
 * Tout texte venant de l'utilisateur passe par esc() ; les traductions par t().
 */

/** Pastilles des joueurs : score, étoiles, joueur actif. */
function scoreboard() {
  if (g.mode === 'challenge') return '';
  return `<div class="chips" style="grid-template-columns:repeat(${g.players},minmax(0,1fr))">${g.scores.map((s, i) => `<div class="chip ${active() === i ? 'current' : ''} ${g.phase === 'result' && g.last && g.last.player === i && ['found', 'netHit', 'wrong', 'netMiss'].includes(g.last.type) ? 'bump' : ''}"><span class="cname"><i class="player-dot" style="background:${colors[i]}"></i>${esc(pname(i))}</span><span class="cscore"><b>${s}</b> <small>⭐${g.stars[i]}</small></span>${scoreDelta(i)}</div>`).join('')}</div>`;
}
/** Gain / perte du dernier coup (+10, +4, −1…) affiché sur la pastille. */
function scoreDelta(i) {
  const x = g.last;
  if (g.phase !== 'result' || !x || x.player !== i) return '';
  const d = {
    found: SCORE.precise + (x.bonus || 0),
    netHit: SCORE.net + (x.bonus || 0),
    wrong: SCORE.miss,
    netMiss: SCORE.miss * (x.nums || []).length
  }[x.type];
  return d ? `<i class="delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : '−'}${Math.abs(d)}</i>` : '';
}
function brand() {
  return `<div class="brand"><span class="brand-icon" dir="ltr">9?</span><span><small>${t('eyebrow')}</small><b>${t('title')}</b></span></div>`;
}
function settingsButton(compact = false) {
  return compact
    ? `<button class="mini-btn icon-btn" id="openSettings" type="button" aria-label="${t('settings')}" title="${t('settings')}">⚙️</button>`
    : `<button class="mini-btn settings-button" id="openSettings" type="button" aria-label="${t('settings')}">⚙️ <span>${t('settings')}</span></button>`;
}
/** Accueil : nombre de joueurs, niveau, Jouer, défi, règles. */
function home() {
  return `<header class="top">${brand()}${settingsButton()}</header><section class="hero hero-row"><div class="hero-mascot">${mascot()}</div><h1>${t('hero1')}<br><span>${t('hero2')}</span></h1></section><section class="panel start-panel"><div class="label">👥 ${t('players')}</div><div class="selector">${[1, 2, 3, 4].map(n => `<button class="seg ${g.players === n ? 'is-selected' : ''}" data-players="${n}" aria-pressed="${g.players === n}"><b>${n}</b><small>${n === 1 ? t('onePlayer') : t('multiplayer')}</small></button>`).join('')}</div><div class="label">✨ ${t('levels')}</div><div class="difficulty">${[
    ['junior', '🐣', 'levelJunior', 'levJuniorSub', '1–9'],
    ['malin', '🧠', 'levelMalin', 'levMalinSub', '1–15'],
    ['expert', '🚀', 'levelExpert', 'levExpertSub', '1–30'],
    ['genius', '🦉', 'levelGenius', 'levGeniusSub', '1–50']
  ]
    .map(
      ([id, emoji, k, sub, range]) =>
        `<button class="level ${g.level === id ? 'is-selected' : ''}" data-level="${id}" aria-pressed="${g.level === id}"><span class="level-emoji">${emoji}</span><strong>${t(k)}</strong><span class="level-range" dir="ltr">${range}</span><small class="lvl-sub">${t(sub)}</small></button>`
    )
    .join(
      ''
    )}</div><button class="bigbtn" id="start">▶ ${t('play')}</button><div class="home-row"><button class="mini-btn rules-btn" id="openRules">📖 ${t('rulesTitle')}</button><button class="mini-btn ch-btn" id="openChallenge">🏆 ${t('chBtn')}</button><button class="mini-btn tut-btn" id="openTutorial">🎓 ${t('tutBtn')}</button></div></section><footer class="footer">${t('homeFooter')} · V${APP_VERSION}</footer>`;
}
/** Réglages : langue, chronos, son, mouvements réduits, film. */
function settings() {
  return `<header class="top">${brand()}<button class="mini-btn" id="closeSettings">${g.lang === 'ar' ? '›' : '‹'} ${t('back')}</button></header><section class="hero settings-hero"><div class="hero-mascot small-mascot">${mascot()}</div><h1>⚙️ ${t('settings')}</h1></section><section class="panel settings-panel"><div class="panel-title">🌍 ${t('language')}</div><p class="sub">${t('languageHint')}</p><div class="lang-list">${[
    ['fr', '🇫🇷', 'Français'],
    ['en', '🇬🇧', 'English'],
    ['ar', '🇸🇦', 'العربية']
  ]
    .map(
      ([code, flag, label]) =>
        `<button class="lang-choice ${g.lang === code ? 'is-selected' : ''}" data-language="${code}" lang="${code}" dir="${code === 'ar' ? 'rtl' : 'ltr'}" aria-pressed="${g.lang === code}"><span class="flag">${flag}</span><strong>${label}</strong><span class="checkmark">${g.lang === code ? '✓' : ''}</span></button>`
    )
    .join(
      ''
    )}</div><div class="banner" style="margin-top:16px">💡 ${t('settingsTip')}</div></section><section class="panel settings-panel"><div class="panel-title">🔊 ${t('sound')}</div><p class="sub">${t('soundHint')}</p><button class="toggle-row" id="soundToggle" role="switch" aria-checked="${g.sound}"><span class="flag">${g.sound ? '🔊' : '🔇'}</span><strong>${t('sound')}</strong><span class="switch ${g.sound ? 'on' : ''}"></span></button></section><section class="panel settings-panel"><div class="panel-title">⏱ ${t('timerTitle')}</div><p class="sub">${t('timerHint')}</p><div class="choice-row">${[
    ['normal', 'timerNormal'],
    ['long', 'timerLong'],
    ['off', 'timerOff']
  ]
    .map(
      ([m, k]) =>
        `<button class="mini-btn ${g.timerMode === m ? 'is-selected' : ''}" data-timer="${m}" aria-pressed="${g.timerMode === m}">${t(k)}</button>`
    )
    .join(
      ''
    )}</div></section><section class="panel settings-panel"><div class="panel-title">✨ ${t('motionTitle')}</div><p class="sub">${t('motionHint')}</p><button class="toggle-row" id="motionToggle" role="switch" aria-checked="${g.reduceMotion}"><span class="flag">${g.reduceMotion ? '🐢' : '💃'}</span><strong>${t('motionReduce')}</strong><span class="switch ${g.reduceMotion ? 'on' : ''}"></span></button></section><section class="panel settings-panel"><div class="panel-title">🎬 ${t('rpSetting')}</div><p class="sub">${t('rpSettingHint')}</p><button class="toggle-row" id="replayToggle" role="switch" aria-checked="${g.replayAsk !== false}"><span class="flag">🎬</span><strong>${t('rpSettingLabel')}</strong><span class="switch ${g.replayAsk !== false ? 'on' : ''}"></span></button></section><button class="bigbtn light" id="closeSettingsBottom">${t('back')}</button><p class="app-version">${t('appVersion', { v: APP_VERSION })}</p>`;
}
/** Les trois onglets du tour : Indice, Calcul, Choisir un numéro (+ boutons de capture). */
function questionView() {
  const options = g.choices.map(qbyid).filter(Boolean),
    locked = g.helpUsed,
    mathOn = g.mathStarted && !g.helpUsed,
    gridclass = maxN() === 30 ? 'expert' : maxN() === 15 ? 'wide' : '';
  return `<div class="actiontabs" role="tablist"><button class="actiontab ${g.tab === 'question' ? 'selected' : ''}" data-tab="question" ${locked || mathOn ? 'disabled' : ''}>💡 ${t('tabQuestion')}</button><button class="actiontab ${g.tab === 'math' ? 'selected' : ''}" data-tab="math" ${locked ? 'disabled' : ''}>🧮 ${t('tabMath')}</button><button class="actiontab ${g.tab === 'guess' ? 'selected' : ''}" data-tab="guess">🎯 ${t('tabGuess')}</button></div>
 <div class="actionpane ${g.tab === 'question' ? 'selected' : ''}"><div class="q-head">${g.showInfo ? `<ul class="tradeoff"><li class="up">👍 ${t('q1')}</li>${g.mode === 'challenge' ? '' : `<li class="gift">🎁 ${t('q2')}</li>`}<li class="down">👎 ${t(g.mode === 'challenge' ? 'q3ch' : g.level === 'genius' ? 'q3g' : 'q3')}</li></ul>` : `<p class="q-title">${t('chooseQuestionShort')}</p>`}<button class="mini-btn small info-btn ${g.showInfo ? 'on' : ''}" data-info aria-pressed="${!!g.showInfo}" aria-label="${t('infoBtn')}" title="${t('infoBtn')}">ℹ️</button><button class="mini-btn small reroll" id="reroll" ${g.rerolled ? 'disabled' : ''} aria-label="${t('changeQuestions')}" title="${t('changeQuestions')}">🔀</button></div><div class="questions">${options.map(q => `<button class="qbtn" data-question="${q.id}"><span class="qicon">${q.icon}</span><span class="qtext">${esc(q.text)}<small>${esc(q.type)}</small></span></button>`).join('')}</div>${miniNotebook()}</div>
 <div class="actionpane ${g.tab === 'math' ? 'selected' : ''}"><div class="mathbox"><div class="math-title"><b dir="ltr" class="${mathText(g.math).length > 12 ? 'long' : ''}">${mathText(g.math)} = ?</b>${g.math.options.length > 3 ? `<small class="prio">${t('mathRewardSix')}</small>` : ''}</div>${!g.showInfo ? `<button class="info-link" data-info>ℹ️ ${t('infoBtn')}</button>` : g.mode === 'challenge' ? `<ul class="tradeoff" data-info title="✕"><li class="up">👍 ${t('m1ch')}</li><li class="gift">🎁 ${t(g.chKind === 'timed' ? 'm2chT' : 'm2ch')}</li><li class="down">👎 ${t('m3ch')}</li></ul>` : `<ul class="tradeoff" data-info title="✕"><li class="up">👍 ${t('m1')}</li><li class="gift">${t('m2')}</li><li class="down">👎 ${t('m3')}</li></ul>`}<div class="mathform ${g.math.options.length > 3 ? 'six' : ''}" dir="ltr">${g.math.options.map(n => `<button class="mathbtn" data-math="${n}">${n}</button>`).join('')}</div></div></div>
 <div class="actionpane ${g.tab === 'guess' ? 'selected' : ''} ${maxN() > 30 ? 'with-keypad' : ''}"><div class="pane-head"><p class="pick-hint">${g.answerLost ? t('answerTimeUp') : maxN() > 30 ? t('keypadHint', { max: maxN() }) : g.helpUsed ? t('captPick', { max: maxN() }) : t('proGuess')}</p>${helpMode() === 'ask' ? `<button class="mini-btn small ${g.showHints ? 'is-on' : ''}" id="hints" aria-pressed="${g.showHints}">💡 ${t('hintsOn')}</button>` : ''}</div>${
   maxN() > 30
     ? keypadHTML()
     : `<div class="numbergrid ${gridclass}" dir="ltr">${all(maxN())
         .map(n => {
           const cap = g.capturing && g.capturing.nums.includes(n),
             inNet = netAvailable() && g.sel != null && !g.capturing && netRange(g.sel).includes(n);
           return `<button class="numtile ${showPossible() ? (g.candidates.includes(n) ? 'possible' : 'impossible') : ''} ${g.sel === n ? 'sel' : ''} ${inNet ? 'in-net' : ''} ${cap ? 'hit-' + g.capturing.mode : ''}" data-guess="${n}" aria-pressed="${g.sel === n}" aria-label="${n}">${n}${cap && g.capturing.mode === 'precise' ? '<i class="loupe-fx" aria-hidden="true"></i>' : ''}</button>`;
         })
         .join('')}</div>`
 }<div class="capture-row"><button class="capbtn precise" id="capPrecise" ${g.sel == null || g.capturing ? 'disabled' : ''}><span>🎯 ${g.sel != null ? t('captGoPrecise', { n: g.sel }) : t('captPrecise')}</span><small>${g.mode === 'challenge' ? t('chMissPrecise') : isRace() ? (g.players === 1 ? '' : '🏆') : `<bdi dir="ltr">+${SCORE.precise} / −${-SCORE.miss}</bdi>`}</small></button><button class="capbtn net ${netsLeft() ? '' : 'empty'}" id="capNet" ${g.sel == null || g.capturing || !netsLeft() ? 'disabled' : ''}><span>🕸️ ${!netsLeft() ? t('netsNone') : g.sel != null ? `<bdi dir="ltr">${netRange(g.sel).join('·')}</bdi>` : t('captNet')}</span><b class="nets-left" dir="ltr" title="${t('netsLeft', { n: netsLeft() })}" aria-label="${t('netsLeft', { n: netsLeft() })}">${'●'.repeat(netsLeft())}${'○'.repeat(NETS_MAX - netsLeft())}</b><small>${g.mode === 'challenge' ? t('chMissNet') : isRace() ? t('captNumbers', { k: netSize() }) : `${t('captNumbers', { k: netSize() })} · <bdi dir="ltr">+${SCORE.net} / −${netSize()}</bdi>`}</small></button></div></div>`;
}
function lens(n) {
  return `<div class="found-lens" aria-hidden="true"><span class="lens-glass"><b>${n}</b></span><i class="lens-handle"></i></div>`;
}
/**
 * Mini-carnet sous les questions : les 3 derniers indices (questions, calculs justes) sur le numéro EN COURS
 * (depuis la dernière capture), ou une astuce en début de chasse. Masqué sur les écrans bas (CSS).
 */
function miniNotebook() {
  let from = 0;
  g.history.forEach((e, i) => {
    if (e.type === 'found' || e.type === 'netHit') from = i + 1;
  });
  // seulement les INDICES (questions, calculs justes) : ce qui fait vraiment avancer la déduction
  const recent = g.history
    .slice(from)
    .filter(e => e.type === 'question' || (e.type === 'math' && e.correct))
    .slice(-3)
    .reverse();
  return `<div class="mini-notebook">${
    recent.length
      ? `<b>📓 ${t('miniNotebook')}</b>${recent.map(e => `<p>${historyText(e)}</p>`).join('')}`
      : `<p class="tip">${t('miniTip')}</p>`
  }</div>`;
}
/**
 * Saut « à l'aveugle » : montre le TYPE de déplacement (+2, ×2, miroir…) sur une piste
 * sans numéros, pour ne jamais révéler où se cache le numéro.
 */
function blindJump(shift) {
  const s = typeof shift === 'number' ? { op: '+', k: shift } : shift || { op: '+', k: 0 };
  const kind = s.op === '+' ? 'hop' : s.op === '×' ? 'grow' : s.op === '÷' ? 'shrink' : 'mirror';
  const dx = s.op === '+' ? Math.sign(s.k) * Math.min(Math.abs(s.k), 5) * 13 : 0;
  return `<span class="blind-jump ${kind}" dir="ltr" aria-hidden="true" style="--dx:${dx}px"><span class="bj-track">${'<i></i>'.repeat(11)}</span><b class="bj-token">?</b></span><b dir="ltr" class="bj-label">${shiftSymbol(shift)}</b>`;
}
/** Pavé numérique (Génie et défi : trop de numéros pour une grille). */
function keypadHTML() {
  return `<div class="kp-display ${g.sel == null ? 'empty' : ''} ${g.capturing ? 'hit-' + g.capturing.mode : ''}" dir="ltr" aria-live="polite">${g.sel == null ? g.typed || `<span class="kp-range">1–${maxN()}</span>` : g.sel}${g.sel != null && !g.capturing && netAvailable() ? `<small>🕸️ ${netRange(g.sel).join('·')}</small>` : ''}${g.capturing && g.capturing.mode === 'precise' ? '<i class="loupe-fx" aria-hidden="true"></i>' : ''}</div><div class="keypad" dir="ltr">${['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'clr'].map(k => `<button class="key ${k.length > 1 ? 'fn' : ''}" data-key="${k}" aria-label="${k}" ${k.length === 1 && !keyAllowed(k) ? 'disabled' : ''}>${k === 'del' ? '⌫' : k === 'clr' ? 'C' : k}</button>`).join('')}</div>`;
}
/**
 * Un chiffre n'est utilisable que s'il donne encore un numéro de 1 à maxN() :
 * en Génie (1–50), après « 8 » plus aucun chiffre n'est possible. Impossible de taper « 86 ».
 */
function keyAllowed(k) {
  const n = Number((g.typed || '') + k);
  return n >= 1 && n <= maxN();
}
/** Touche du pavé : chiffre (si autorisé), effacer, tout effacer. */
function pressKey(k) {
  if (g.capturing || g.phase !== 'choose' || g.screen !== 'game') return;
  let v = g.typed || '';
  if (k === 'del') v = v.slice(0, -1);
  else if (k === 'clr') v = '';
  else if (keyAllowed(k)) v = v + k;
  else return;
  const n = Number(v);
  g.typed = v;
  g.sel = v && n >= 1 && n <= maxN() ? n : null;
  sfx('select');
  render();
}
/** Carte de résultat du coup qui vient d'être joué (g.last). */
function resultView() {
  const x = g.last;
  let title = '',
    desc = '',
    tone = 'good',
    extra = '';
  if (x.type === 'question') {
    title = x.answer ? t('yesAnswer') : t('noAnswer');
    desc = esc(qbyid(x.qid)?.text || '');
    tone = x.answer ? 'good' : 'neutral';
  } else if (x.type === 'found') {
    title = '🎉 ' + t('found');
    desc =
      t('foundDesc', { n: x.n, player: pname(x.player) }) +
      (x.bonus ? '<br><span class="bonus-line">' + t('bonusDeduction') + '</span>' : '');
    extra = lens(x.n);
  } else if (x.type === 'wrong') {
    title = '😅 ' + t('miss');
    desc = t('missDesc', { n: x.n });
    tone = 'bad';
  } else if (x.type === 'netHit') {
    title = '🕸️ ' + t('netHit');
    desc =
      t(isRace() ? 'netHitDescRace' : 'netHitDesc', {
        n: x.n,
        nums: x.nums.join('·'),
        player: pname(x.player)
      }) + (x.bonus ? '<br><span class="bonus-line">' + t('bonusDeduction') + '</span>' : '');
    extra = lens(x.n);
  } else if (x.type === 'netMiss') {
    title = '🕸️ ' + t('netMiss');
    desc = t('netMissDesc', { nums: x.nums.join('·'), p: x.nums.length });
    tone = 'bad';
  } else if (x.type === 'timeout') {
    title = '⏱ ' + t('turnTimeUp');
    desc = t('turnTimeoutDesc');
    tone = 'bad';
  } else if (x.type === 'math') {
    title = x.correct ? '🌟 ' + t('bravo') : x.timeout ? '⏱ ' + t('timeUp') : '💛 ' + t('almost');
    desc = t(
      x.correct
        ? g.mode === 'challenge'
          ? 'chMathGood'
          : 'mathGood'
        : x.timeout
          ? 'mathTimeout'
          : 'mathBad',
      { equation: mathText(x.math), result: x.math.result }
    );
    tone = x.correct ? 'good' : 'bad';
    if (x.correct)
      extra =
        (x.frozen
          ? `<div class="ch-bonus">${t('chMathBonus', { p: x.chBonus })}${g.chKind === 'timed' ? t('chTimeBonus') : ''}${x.streak > 1 ? t('chCombo', { n: x.streak }) : ''}</div>`
          : '') +
        `<div class="move-line bonus"><span>${t('bonusClue')} :</span> <strong>${t('qGreater', { k: x.math.threshold })} <span class="answer-pill">${x.answer ? t('yesAnswer') : t('noAnswer')}</span></strong></div>`;
  }
  const clue = ['question', 'math'].includes(x.type);
  const move = x.frozen
    ? `<div class="move-line frozen"><b>🧊</b><span>${t('frozen')}</span></div>`
    : !['found', 'netHit'].includes(x.type)
      ? `<div class="move-line">${blindJump(x.shift)}<span>${t('moved')}${moveHint(x.shift) ? ' <b class="mv-op">' + moveHint(x.shift) + '</b>' : ''}${clue ? '<br><small>' + t('oldClue') + '</small>' : ''}</span></div>`
      : '';
  const top = ['found', 'netHit'].includes(x.type) ? extra : '';
  if (top)
    extra = g.lastHunt ? `<button class="mini-btn rp-open" id="openReplay">🎬 ${t('rpButton')}</button>` : '';
  return `<div class="result-card ${tone}">${top}<div class="result-title">${title}</div><p class="result-desc">${desc}</p>${extra}${move}${clue ? `<p class="keep">🧠 ${t('stillYourTurn')}</p>` : ''}</div><button class="bigbtn ${clue ? '' : 'green'}" id="next">${clue ? '🎯 ' + t('continueGuess') : g.mode === 'challenge' && ['found', 'netHit'].includes(x.type) ? t('chSeeScore') : isRace() && g.players > 1 && ['found', 'netHit'].includes(x.type) ? '🏆 ' + t('raceSeeWin') : g.players === 1 && ['found', 'netHit'].includes(x.type) ? '🏆 ' + t('soloSeeWin') : g.limit && g.turn + 1 >= g.limit ? t('seeResults') : g.players === 1 ? t('nextTurn') : t('nextPlayer')} ${clue ? '' : arrow()}</button>`;
}
/** Ligne du carnet pour un événement de l'historique. */
function historyText(x) {
  const p = pname(x.player);
  if (x.type === 'question')
    return t('clueLog', {
      player: p,
      question: qbyid(x.qid)?.text || '',
      answer: x.answer ? t('yesAnswer') : t('noAnswer'),
      shift: shiftSymbol(x.shift)
    });
  if (x.type === 'math')
    return t('mathLog', {
      player: p,
      equation: mathText(x.math),
      result: x.math.result,
      outcome: t(x.correct ? 'mathSuccessLog' : x.timeout ? 'mathTimeoutLog' : 'mathFailureLog'),
      shift: shiftSymbol(x.shift)
    });
  if (x.type === 'found') return t('foundLog', { player: p, n: x.n });
  if (x.type === 'timeout') return t('timeoutLog', { player: p, shift: shiftSymbol(x.shift) });
  if (x.type === 'netHit') return t('netHitLog', { player: p, nums: x.nums.join('·') });
  if (x.type === 'netMiss')
    return t('netMissLog', {
      player: p,
      nums: x.nums.join('·'),
      p: x.nums.length,
      shift: shiftSymbol(x.shift)
    });
  return t('wrongLog', { player: p, n: x.n, shift: shiftSymbol(x.shift) });
}
/** Écran de jeu complet (sans défilement) : barre, scores, détective, chronos, onglets ou résultat. */
function game() {
  const result = g.phase === 'result',
    x = g.last || {},
    pct = g.limit ? Math.round(((g.turn + 1) / g.limit) * 100) : 0;
  let anim = 'idle',
    party = false,
    qk = 'q_turn';
  if (result) {
    if (x.type === 'found' || x.type === 'netHit') {
      anim = 'caught';
      qk = 'q_caught';
    } else if (['wrong', 'netMiss'].includes(x.type)) {
      anim = 'grimace';
      qk = 'q_miss';
    } else if (x.type === 'timeout') {
      anim = 'grimace';
      qk = 'q_timeout';
    } else if (x.type === 'math') {
      if (x.correct) {
        anim = 'proud';
        party = true;
        qk = 'q_mathGood';
      } else {
        anim = 'worried';
        qk = 'q_mathBad';
      }
    } else {
      anim = moveDir(x.shift) < 0 ? 'dash-left' : moveDir(x.shift) > 0 ? 'dash-right' : 'hop';
      qk = 'q_move';
    }
  } else if (g.capturing || (g.sel != null && g.tab === 'guess')) {
    anim = 'aim';
    qk = 'q_aim';
  } else if (g.tab === 'question') {
    anim = 'think';
    qk = 'q_think';
  } else if (g.tab === 'math') {
    anim = 'search';
    qk = 'q_search';
  } else if (g.tab === 'guess') {
    qk = g.helpUsed ? 'q_guess' : 'q_guess';
  }
  const head = result
    ? t('resultIntro')
    : g.players === 1
      ? t('yourTurn')
      : t('playerTurn', { player: pname(active()) });
  const logo =
    !result && g.tab === 'math' && g.mathStarted && !g.helpUsed
      ? 'thinking'
      : !result && g.tab === 'question' && !g.helpUsed
        ? 'wonder'
        : result && ['found', 'netHit'].includes(x.type)
          ? 'cheer'
          : '';
  return `<header class="gbar"><span class="brand-icon lvl-badge ${logo}" dir="ltr" aria-label="${t('levelBadge')} 1–${maxN()}"><span class="lvl-emo">${g.mode === 'challenge' ? '🏆' : { junior: '🐣', malin: '🧠', expert: '🚀', genius: '🦉' }[g.level]}</span><b class="lvl-range">1–${maxN()}</b>${logo === 'thinking' ? '<i class="logo-bubble">…</i>' : ''}</span><div class="gstatus">${g.mode === 'challenge' ? `<div class="gstatus-row"><b>${t('turn', { current: g.turn + 1, total: '∞' })}</b><span>🏆 ${chScore()}</span></div>` : `<div class="gstatus-row"><b>${t('turn', { current: g.turn + 1, total: g.limit })}</b><span>🎯 ${g.captures}</span></div><div class="gprogress" dir="ltr"><span style="width:${pct}%"></span></div>`}</div><button class="mini-btn icon-btn" id="openNotebook" aria-label="${t('notebook')}" title="${t('notebook')}">📓</button><button class="mini-btn icon-btn pause-btn" id="pause" aria-label="${t('pause')}" title="${t('pause')}">⏸</button></header>${scoreboard()}<section class="panel turn-card"><div class="turn-top"><div class="mini-mascot">${mascot(anim === 'worried' ? 'idle' : anim, party, anim === 'worried' ? 'worried' : null)}</div><div class="bubble"><b>${head}</b><span class="quip">${quip(qk)}</span></div></div>${result && g.mode !== 'challenge' ? '' : timersHTML()}<div class="turn-body">${result ? resultView() : questionView()}</div></section>`;
}
/** Écran de fin : choisit entre défi, solo, course et points. */
function end() {
  if (g.mode === 'challenge') return endChallenge();
  if (g.players === 1) return endSolo();
  if (isRace() && g.raceWinner != null) return endRace();
  const tot = g.scores.map((v, i) => v + (g.stars[i] || 0)),
    best = Math.max(...tot),
    champions = tot.map((s, i) => (s === best ? pname(i) : null)).filter(Boolean),
    order = tot.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
  const soloLost = g.players === 1 && g.soloWon === false;
  return `${g.reduceMotion || soloLost ? '' : confettiRain()}<header class="top">${brand()}${settingsButton()}</header><section class="hero"><div class="hero-mascot">${mascot(soloLost ? 'grimace' : 'caught')}</div><h1>${g.players === 1 ? (soloLost ? '😅 ' + t('soloLose') : '🏆 ' + t('soloWin') + ' !') : isRace() ? '⏱ ' + t('raceNobody') : t('endTitle') + ' 🏆'}</h1><p class="intro">${isRace() && g.players > 1 ? t('raceNobodyDesc') + ' ' : ''}${g.players === 1 ? (soloLost ? t('soloLoseDesc', { n: g.soloSecret }) : t('soloWinDesc', { turns: g.soloTurns || g.turn + 1 })) : champions.length === 1 ? t('endWinner', { player: champions[0] }) : t('endTie', { players: champions.join(', ') })}</p></section><section class="panel"><div class="label centered">${t('results')}</div>${order.map((p, i) => `<div class="finalscore"><div class="medal">${['🥇', '🥈', '🥉', '🎖️'][i]}</div><div><strong>${esc(pname(p.i))}</strong><small>${t('subtotals', { c: g.scores[p.i], s: g.stars[p.i] || 0 })}</small></div><strong class="value">${p.v} <small>${t('score')}</small></strong></div>`).join('')}<div class="banner centered">${g.players === 1 ? '' : t('capturesSummary', { count: g.captures, turns: g.limit }) + '<br>'}<small>${t('starsBonus')}</small></div><button class="bigbtn" id="again">🔄 ${t('replay')}</button><button class="bigbtn light" id="menu">⌂ ${t('menuBack')}</button></section>`;
}
function endRace() {
  const w = g.raceWinner,
    next = (g.starter + 1) % g.players;
  return `${g.reduceMotion ? '' : confettiRain()}<header class="top">${brand()}${settingsButton()}</header><section class="hero"><div class="hero-mascot">${mascot('caught')}</div><h1>🏆 ${t('raceWin', { player: pname(w) })}</h1><p class="intro">${t('raceWinDesc', { turns: g.raceTurns })}</p></section>
 <section class="panel centered"><div class="race-winner"><span class="player-chip" style="background:${colors[w]}">${esc(pname(w))}</span><small>🎯 ${t('raceWinnerTag')}</small></div>
 <div class="race-others">${g.scores.map((v, i) => (i === w ? '' : `<span><i class="player-dot" style="background:${colors[i]}"></i>${esc(pname(i))}</span>`)).join('')}</div>
 <p class="sub">${t('nextStarter', { player: pname(next) })}</p><button class="bigbtn" id="again">🔄 ${t('replay')}</button><button class="bigbtn light" id="menu">⌂ ${t('menuBack')}</button></section>`;
}
function endSolo() {
  const won = g.soloWon !== false,
    turns = won ? g.soloTurns || g.turn + 1 : g.limit,
    h = g.history,
    misses = h.filter(e => e.type === 'wrong' || e.type === 'netMiss').length,
    clues = h.filter(e => e.type === 'question' || e.type === 'math').length,
    stars = won ? (turns <= 3 ? 3 : turns <= 6 ? 2 : 1) : 0;
  return `${won && !g.reduceMotion ? confettiRain() : ''}<header class="top">${brand()}${settingsButton()}</header><section class="hero"><div class="hero-mascot">${mascot(won ? 'caught' : 'grimace')}</div><h1>${won ? '🏆 ' + t('soloWinTitle') : '😅 ' + t('soloLoseTitle')}</h1><p class="intro">${won ? t('soloWinDesc', { turns }) : t('soloLoseDesc', { n: g.soloSecret })}</p></section>
 <section class="panel centered solo-card">${won ? `<div class="solo-stars" aria-label="${stars}/3">${[1, 2, 3].map(i => `<span class="${i <= stars ? 'on' : ''}" style="--d:${0.15 + i * 0.25}s">★</span>`).join('')}</div><div class="solo-rate">${t(['', 'soloRate1', 'soloRate2', 'soloRate3'][stars])}</div>` : `<div class="solo-reveal"><div class="found-lens"><span class="lens-glass"><b>${g.soloSecret}</b></span><i class="lens-handle"></i></div><small>${t('soloReveal')}</small></div>`}
 <div class="solo-stats"><div><b>${turns}</b><small>${t('statTurns')}</small></div><div><b>${clues}</b><small>${t('statClues')}</small></div><div><b>${misses}</b><small>${t('statMisses')}</small></div></div>
 ${won ? (g.soloNewRecord ? `<div class="ch-new">${t('soloNewRecord')}</div>` : g.soloBest ? `<p class="sub">${t('soloBest', { n: g.soloBest })}</p>` : '') : ''}
 <button class="bigbtn" id="again">🔄 ${t('replay')}</button><button class="bigbtn light" id="menu">⌂ ${t('menuBack')}</button></section>`;
}
function endChallenge() {
  const r = records(),
    best = r[chRecordKey()] || 0;
  return `${g.chWon && !g.reduceMotion ? confettiRain() : ''}<header class="top">${brand()}${settingsButton()}</header><section class="hero"><div class="hero-mascot">${mascot(g.chWon ? 'caught' : 'grimace')}</div><h1>${g.chWon ? '🏆 ' + t('chWin') : '⏱ ' + t('chFail')}</h1><p class="intro">${g.chWon ? t('chStats', { turns: g.turn + 1, time: fmtTime(g.chElapsed) }) : t('chFailDesc', { n: g.chSecret })}</p></section><section class="panel centered"><div class="label">${g.chKind === 'timed' ? '⏱ ' + t('chTimed') : '♾️ ' + t('chEndless')} · ${t('chDiff_' + g.chDiff)}</div><div class="ch-score">${g.chFinal}</div>${g.chRecordNew ? `<div class="ch-new">${t('chNewRecord')}</div>` : `<p class="sub">${best ? t('chRecord', { n: best }) : t('chNoRecord')}</p>`}<p class="sub small">${t(g.chKind === 'timed' ? 'chFormulaTimed' : 'chFormulaEndless')}</p><button class="bigbtn" id="again">🔄 ${t('replay')}</button><button class="bigbtn light" id="menu">⌂ ${t('menuBack')}</button></section>`;
}
