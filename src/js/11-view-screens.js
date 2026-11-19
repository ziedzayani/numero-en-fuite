/*
 * Écrans. Chaque fonction RENVOIE du HTML (chaîne) à partir de `g` ; aucune ne modifie
 * l'état. Les clics sont branchés ensuite par bind() (13-render.js) grâce aux id et data-*.
 * Tout texte venant de l'utilisateur passe par esc() ; les traductions par t().
 */

/** Pastilles des joueurs : score, étoiles, joueur actif. */
function scoreboard() {
  if (g.mode === 'challenge') return '';
  return `<div class="chips" style="grid-template-columns:repeat(${g.players},minmax(0,1fr))">${g.scores.map((s, i) => `<div class="chip ${active() === i ? 'current' : ''} ${g.phase === 'result' && g.last && g.last.player === i && ['found', 'netHit', 'wrong', 'netMiss'].includes(g.last.type) ? 'bump' : ''}"><span class="cname">${isRace() && isPlaced(i) ? `<b class="podium-medal">${['🥇', '🥈', '🥉', '🎖️'][placeFor(g.placed.find(p => p.player === i).round) - 1]}</b>` : ''}<i class="player-dot" style="background:${colors[i]}"></i>${esc(pname(i))}</span><span class="cscore"><b>${s}</b> <small>⭐${g.stars[i]}</small></span>${scoreDelta(i)}</div>`).join('')}</div>`;
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
/** En-tête des écrans : petit médaillon du détective + nom (en anglais dans toutes les langues). */
function brand() {
  return `<div class="brand" dir="ltr"><span class="brand-badge" aria-hidden="true"></span><b>The Number Hunt</b></div>`;
}
function settingsButton(compact = false) {
  return compact
    ? `<button class="mini-btn icon-btn" id="openSettings" type="button" aria-label="${t('settings')}" title="${t('settings')}">⚙️</button>`
    : `<button class="mini-btn settings-button" id="openSettings" type="button" aria-label="${t('settings')}">⚙️ <span>${t('settings')}</span></button>`;
}
/** Accueil : nombre de joueurs, niveau, Jouer, défi, règles. */
function home() {
  // Accueil simplifié : Solo ou À plusieurs → niveau → JOUER ; le reste dans 3 boutons.
  const multi = g.players > 1,
    xp = careerProfile(loadCareer()).xpTotal,
    rank = rankOf(xp).rank;
  const who = `<div class="who-row"><button class="seg who ${multi ? '' : 'is-selected'}" data-players="1" aria-pressed="${!multi}"><b>👤</b><small>${t('onePlayer')}</small></button><button class="seg who ${multi ? 'is-selected' : ''}" id="homeMulti" aria-pressed="${multi}"><b>👥</b><small>${t('homeMulti')}</small></button></div>${
    multi
      ? `<div class="multi-row">${[2, 3, 4].map(n => `<button class="chip-btn ${g.players === n ? 'is-selected' : ''}" data-players="${n}" aria-pressed="${g.players === n}">${t('nPlayers', { n })}</button>`).join('')}${netTransport() ? `<button class="chip-btn lan-chip" id="openLan">📶 ${t('homeWifi')}</button>` : ''}</div>`
      : ''
  }`;
  const levels = [
    ['junior', '🐣', 'levelJunior', 'levJuniorSub', '1–9'],
    ['malin', '🧠', 'levelMalin', 'levMalinSub', '1–15'],
    ['expert', '🚀', 'levelExpert', 'levExpertSub', '1–30'],
    ['genius', '🦉', 'levelGenius', 'levGeniusSub', '1–50']
  ]
    .map(
      ([id, emoji, k, sub, range]) =>
        `<button class="level ${g.level === id ? 'is-selected' : ''}" data-level="${id}" aria-pressed="${g.level === id}"><span class="level-emoji">${emoji}</span><strong>${t(k)}</strong><span class="level-range" dir="ltr">${range}</span><small class="lvl-sub">${t(sub)}</small></button>`
    )
    .join('');
  // V9 : le logo « The Number Hunt » remplace l'en-tête et la mascotte de l'accueil (il flotte doucement)
  return `<header class="top home-top"><button class="rank-chip" id="openOffice2">🎖️ ${rankName(rank)}</button>${settingsButton(true)}</header><section class="hero home-logo"><h1 class="logo-art" role="img" aria-label="The Number Hunt"><span class="sr-only">The Number Hunt</span></h1><p class="tagline">${t('hero1')} ${t('hero2')}</p></section><section class="panel start-panel">${who}<div class="label">✨ ${t('levels')}</div><div class="difficulty">${levels}</div><button class="bigbtn" id="start">▶ ${t('play')}</button><div class="home-row"><button class="mini-btn ch-btn" id="openChallenge">🏆 ${t('chBtn')}</button><button class="mini-btn office-btn" id="openOffice">📚 ${t('officeBtn')}</button><button class="mini-btn more-btn" id="openMore">⋯ ${t('more')}</button></div></section><footer class="footer">${t('homeFooter')} · V${APP_VERSION}</footer>`;
}
/** « Mon bureau de détective » : rang, XP, compteurs et records des 4 niveaux (lecture seule). */
function office() {
  const p = careerProfile(loadCareer()),
    tab = ['records', 'badges', 'missions'].includes(g.officeTab) ? g.officeTab : 'rank';
  const tabs = [
    ['rank', '🕵️', 'officeTabRank'],
    ['records', '📂', 'officeTabRecords'],
    ['badges', '🏅', 'officeTabBadges'],
    ['missions', '🎯', 'officeTabMissions']
  ]
    .map(
      ([id, icon, k]) =>
        `<button class="nb-tab ${tab === id ? 'is-selected' : ''}" data-otab="${id}" aria-pressed="${tab === id}">${icon} ${t(k)}${
          id === 'badges' ? ` <small dir="ltr">${Object.keys(p.badges).length}/${BADGES.length}</small>` : ''
        }</button>`
    )
    .join('');
  const body =
    tab === 'badges'
      ? officeBadges(p)
      : tab === 'missions'
        ? officeMissions(p)
        : tab === 'records'
          ? officeRecords(p)
          : officeRank(p);
  return `<header class="top">${brand()}<button class="mini-btn" id="closeOffice">${g.lang === 'ar' ? '›' : '‹'} ${t('back')}</button></header><section class="panel office-panel"><h1 class="settings-title">📚 ${t('officeTitle')}</h1><div class="office-tabs">${tabs}</div>${body}<button class="bigbtn" id="officePlay">▶ ${t('officePlay')}</button></section>`;
}
/** Onglet « Rang » : barre d'XP, frise des 8 chapeaux, compteurs. */
function officeRank(p) {
  const cur = rankOf(p.xpTotal).rank;
  const hats = RANKS.map(
    (_, i) =>
      `<span class="rank-step ${i + 1 <= cur ? 'reached' : ''} ${i + 1 === cur ? 'current' : ''}" title="${esc(rankName(i + 1))}"><i class="mini-hat hat-r${i + 1}"></i>${i + 1}</span>`
  ).join('');
  const tiles = [
    ['officePlayed', p.totalWins + p.totalLosses],
    ['officeWins', p.totalWins],
    ['officeLosses', p.totalLosses],
    ['officeStars', p.totalStars]
  ]
    .map(([k, n]) => `<div><b>${n}</b><small>${t(k)}</small></div>`)
    .join('');
  return `<div class="office-rank"><span class="office-badge" aria-hidden="true">🕵️</span><div>${rankBar(p.xpTotal)}</div></div><div class="label">🎩 ${t('officeHats')}</div><div class="rank-line-hats" dir="ltr">${hats}</div><p class="sub small">${t('officeHatsNext', { name: rankName(Math.min(cur + 1, RANKS.length)) })}</p><div class="office-tiles">${tiles}</div>`;
}
/** Onglet « Records » : meilleur score et meilleur nombre de tours par niveau. */
function officeRecords(p) {
  const levels = [
    ['junior', '🐣', 'levelJunior'],
    ['malin', '🧠', 'levelMalin'],
    ['expert', '🚀', 'levelExpert'],
    ['genius', '🦉', 'levelGenius']
  ];
  const rows = levels
    .map(([id, emoji, k]) => {
      const lv = p.levels[id] || {};
      return `<li><span>${emoji} ${t(k)}</span><span class="rec">${
        lv.bestScore != null
          ? `<b dir="ltr">${lv.bestScore} ${t('pts')}</b>`
          : `<i>${t('officeToDiscover')}</i>`
      }${lv.bestTurns != null ? `<small>${t('officeBestTurns', { n: lv.bestTurns })}</small>` : ''}</span></li>`;
    })
    .join('');
  return `<div class="label">📂 ${t('officeRecords')}</div><ul class="office-records">${rows}</ul><p class="sub small">${t('officeNote')}</p>`;
}
/** Onglet « Badges » : étagère des 6 badges ; ceux à gagner disent comment les obtenir. */
function officeBadges(p) {
  return `<div class="badge-shelf">${BADGES.map(b => {
    const got = !!p.badges[b.id];
    return `<div class="badge ${got ? 'got' : 'locked'}"><span class="b-icon" aria-hidden="true">${b.icon}</span><b>${t('badge_' + b.id)}</b><small>${got ? '✅ ' + t('badgeGot') : t('badgeHow_' + b.id)}</small></div>`;
  }).join('')}</div>`;
}
/** Onglet « Missions » : 3 missions sans limite de temps ; une mission réussie est remplacée. */
function officeMissions(p) {
  return `<p class="sub small">${t('missionsIntro', { xp: MISSION_XP })}</p><ul class="mission-list">${p.missions
    .map(
      m =>
        `<li><span class="m-icon" aria-hidden="true">🎯</span><span>${missionText(m)}</span><span class="m-prog" dir="ltr">${m.progress}/${m.goal}</span></li>`
    )
    .join('')}</ul>`;
}
/** Ferme la fenêtre « Langue » et rétablit la fenêtre d'avant (pause d'une partie, etc.). */
function closeLang() {
  g.modal = g.langFrom || null;
  g.langFrom = null;
}
/** Fenêtre « Langue du jeu » : les 8 langues, chacune écrite dans sa propre langue. */
function langView() {
  const items = LANGS.map(
    ([code, flag, label]) =>
      `<button class="lang-choice ${g.lang === code ? 'is-selected' : ''}" data-language="${code}" lang="${code}" dir="${code === 'ar' ? 'rtl' : 'ltr'}" aria-pressed="${g.lang === code}"><span class="flag">${flag}</span><strong>${label}</strong></button>`
  ).join('');
  return `<h2>🌍 ${t('language')}</h2><div class="lang-list lang-grid">${items}</div><p class="sub small">${t('languageHint')}</p><button class="mini-btn" id="closeLang">${t('close')}</button>`;
}
/** Réglages : langue, chronos, son, mouvements réduits, film. */
function settings() {
  // Écran compact (sans défilement sur 360 × 735) : une seule carte, une ligne par réglage.
  const toggle = (id, on, icon, label, hint) =>
    `<button class="toggle-row" id="${id}" role="switch" aria-checked="${on}"><span class="flag">${icon}</span><span class="tr-text"><strong>${label}</strong><small>${hint}</small></span><span class="switch ${on ? 'on' : ''}"></span></button>`;
  // 8 langues : une ligne « Langue » qui ouvre la liste complète (fenêtre 'lang', voir langView()).
  const cur = LANGS.find(l => l[0] === g.lang) || LANGS[1];
  const langs = `<button class="toggle-row lang-row" id="openLang"><span class="flag">🌍</span><span class="tr-text"><strong>${t('language')}</strong><small lang="${cur[0]}">${cur[1]} ${cur[2]}</small></span><span class="chev">›</span></button>`;
  const timers = [
    ['normal', 'timerNormal'],
    ['long', 'timerLong'],
    ['off', 'timerOff']
  ]
    .map(
      ([m, k]) =>
        `<button class="mini-btn ${g.timerMode === m ? 'is-selected' : ''}" data-timer="${m}" aria-pressed="${g.timerMode === m}">${t(k)}</button>`
    )
    .join('');
  return `<header class="top">${brand()}<button class="mini-btn" id="closeSettings">${g.lang === 'ar' ? '›' : '‹'} ${t('back')}</button></header><section class="panel settings-panel compact-settings"><h1 class="settings-title">⚙️ ${t('settings')}</h1>${langs}<div class="panel-title">⏱ ${t('timerTitle')}</div><div class="choice-row">${timers}</div><details class="timer-details"><summary>${t('timerDetails')}</summary><p class="sub small">${t('timerHint')}</p></details>${toggle('soundToggle', g.sound, g.sound ? '🔊' : '🔇', t('sound'), t('soundHint'))}${toggle('motionToggle', g.reduceMotion, g.reduceMotion ? '🐢' : '💃', t('motionReduce'), t('motionHint'))}${toggle('replayToggle', g.replayAsk !== false, '🎬', t('rpSettingLabel'), t('rpSettingHint'))}<button class="toggle-row backup-row" id="openBackup"><span class="flag">💾</span><span class="tr-text"><strong>${t('backupTitle')}</strong><small>${t('backupHint')}</small></span><span class="chev">›</span></button><p class="app-version">${t('appVersion', { v: APP_VERSION })}</p></section>`;
}
/** Les trois onglets du tour : Indice, Calcul, Choisir un numéro (+ boutons de capture). */
function questionView() {
  const options = g.choices.map(qbyid).filter(Boolean),
    locked = g.helpUsed,
    mathOn = g.mathStarted && !g.helpUsed,
    gridclass = maxN() === 30 ? 'expert' : maxN() === 15 ? 'wide' : '';
  return `<div class="actiontabs" role="tablist"><button class="actiontab ${g.tab === 'question' ? 'selected' : ''}" data-tab="question" ${locked || mathOn ? 'disabled' : ''}>💡 ${t('tabQuestion')}</button><button class="actiontab ${g.tab === 'math' ? 'selected' : ''}" data-tab="math" ${locked ? 'disabled' : ''}>🧮 ${t('tabMath')}</button><button class="actiontab ${g.tab === 'guess' ? 'selected' : ''}" data-tab="guess">🎯 ${t('tabGuess')}</button></div>
 <div class="actionpane ${g.tab === 'question' ? 'selected' : ''}"><div class="q-head">${g.showInfo ? `<ul class="tradeoff"><li class="up">👍 ${t('q1')}</li>${g.mode === 'challenge' ? '' : `<li class="gift">🎁 ${t('q2')}</li>`}<li class="down">👎 ${t(g.mode === 'challenge' ? 'q3ch' : g.level === 'genius' ? 'q3g' : 'q3')}</li></ul>` : `<p class="q-title">${t('chooseQuestionShort')}</p>`}<button class="mini-btn small info-btn ${g.showInfo ? 'on' : ''}" data-info aria-pressed="${!!g.showInfo}" aria-label="${t('infoBtn')}" title="${t('infoBtn')}">ℹ️</button><button class="mini-btn small reroll" id="reroll" ${g.rerolled ? 'disabled' : ''} aria-label="${t('changeQuestions')}" title="${t('changeQuestions')}">🔀</button></div><div class="questions">${options.map(q => `<button class="qbtn" data-question="${q.id}"><span class="qicon">${q.icon}</span><span class="qtext">${esc(q.text)}<small>${esc(q.type)}</small></span></button>`).join('')}</div>${miniNotebook()}</div>
 <div class="actionpane ${g.tab === 'math' ? 'selected' : ''}"><div class="mathbox"><div class="math-title"><b dir="ltr" class="${mathText(g.math).length > 12 ? 'long' : ''}">${mathText(g.math)} = ?</b>${g.math.options.length > 3 ? `<small class="prio">${t('mathRewardSix')}</small>` : ''}${g.mode === 'challenge' && g.chFreezes != null ? `<small class="prio freeze-left">🧊 ${t('freezesLeft', { n: g.chFreezes })}</small>` : ''}</div>${!g.showInfo ? `<button class="info-link" data-info>ℹ️ ${t('infoBtn')}</button>` : g.mode === 'challenge' ? `<ul class="tradeoff" data-info title="✕"><li class="up">👍 ${t('m1ch')}</li><li class="gift">🎁 ${t(g.chKind === 'timed' ? 'm2chT' : 'm2ch')}</li><li class="down">👎 ${t('m3ch')}</li></ul>` : `<ul class="tradeoff" data-info title="✕"><li class="up">👍 ${t('m1')}</li><li class="gift">${t('m2')}</li><li class="down">👎 ${t('m3')}</li></ul>`}<div class="mathform ${g.math.options.length > 3 ? 'six' : ''}" dir="ltr">${g.math.options.map(n => `<button class="mathbtn" data-math="${n}">${n}</button>`).join('')}</div></div></div>
 <div class="actionpane ${g.tab === 'guess' ? 'selected' : ''} ${maxN() > 30 ? 'with-keypad' : ''}"><div class="pane-head"><p class="pick-hint">${g.answerLost ? t('answerTimeUp') : maxN() > 30 ? t('keypadHint', { max: maxN() }) : g.helpUsed ? t('captPick', { max: maxN() }) : t('proGuess')}</p>${helpMode() === 'ask' ? `<button class="mini-btn small ${g.showHints ? 'is-on' : ''}" id="hints" aria-pressed="${g.showHints}">💡 ${t('hintsOn')}</button>` : ''}${g.mode === 'challenge' ? `<button class="mini-btn small pass-btn" id="passTurn" title="${esc(t('passHint'))}">🏃 ${t('passBtn')}</button>` : ''}</div>${
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
  let s = typeof shift === 'number' ? { op: '+', k: shift } : shift || { op: '+', k: 0 };
  if (s.op === 'seq') s = s.steps[0]; // double saut : on anime le premier, l'étiquette montre les deux
  const kind =
    s.op === '+'
      ? 'hop'
      : s.op === '±'
        ? 'unsure' // sens caché : le pion hésite à gauche et à droite
        : s.op === '×' || s.op === '×m'
          ? 'grow'
          : s.op === '÷'
            ? 'shrink'
            : 'mirror';
  // le pion reste DANS sa piste (64 px) : au plus 17 px de chaque côté du centre, plus loin si le saut est grand
  const dx = s.op === '+' ? Math.round(Math.sign(s.k) * (5 + 2.4 * Math.min(Math.abs(s.k), 5))) : 0;
  return `<span class="blind-jump ${kind}" dir="ltr" aria-hidden="true" style="--dx:${dx}px"><span class="bj-track">${'<i></i>'.repeat(11)}</span><b class="bj-token">?</b></span><b dir="ltr" class="bj-label">${shiftSymbol(shift)}</b>`;
}
/** Pavé numérique (Génie et défi : trop de numéros pour une grille). */
function keypadHTML() {
  return `<div class="kp-display ${g.sel == null ? 'empty' : ''} ${g.sel != null && !g.capturing && netAvailable() ? 'with-net' : ''} ${g.capturing ? 'hit-' + g.capturing.mode : ''}" dir="ltr" aria-live="polite">${g.sel == null ? g.typed || `<span class="kp-range">1–${maxN()}</span>` : g.sel}${g.sel != null && !g.capturing && netAvailable() ? `<small>🕸️ ${netRange(g.sel).join('·')}</small>` : ''}${g.capturing && g.capturing.mode === 'precise' ? '<i class="loupe-fx" aria-hidden="true"></i>' : ''}</div><div class="keypad" dir="ltr">${['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'clr'].map(k => `<button class="key ${k.length > 1 ? 'fn' : ''}" data-key="${k}" aria-label="${k}" ${k.length === 1 && !keyAllowed(k) ? 'disabled' : ''}>${k === 'del' ? '⌫' : k === 'clr' ? 'C' : k}</button>`).join('')}</div>`;
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
  } else if (x.type === 'pass') {
    title = '🏃 ' + t('passTitle');
    desc = t('passDesc');
    tone = 'neutral';
  } else if (x.type === 'timeout') {
    title = '⏱ ' + t('turnTimeUp');
    desc = t('turnTimeoutDesc');
    tone = 'bad';
  } else if (x.type === 'math') {
    title = x.correct ? '🌟 ' + t('bravo') : x.timeout ? '⏱ ' + t('timeUp') : '💛 ' + t('almost');
    desc = t(
      x.correct
        ? g.mode === 'challenge'
          ? x.pick
            ? 'chMathGoodPick'
            : x.frozen
              ? 'chMathGood'
              : 'chMathGoodMoved'
          : 'mathGood'
        : x.timeout
          ? 'mathTimeout'
          : 'mathBad',
      { equation: mathText(x.math), result: x.math.result }
    );
    tone = x.correct ? 'good' : 'bad';
    if (x.correct && x.pick)
      // Défi Difficile : le joueur choisit la question que le calcul lui offre
      extra = `<div class="pick-clue"><b>🎁 ${t('chPickTitle')}</b>${g.choices
        .map(id => {
          const q = qbyid(id);
          return q
            ? `<button class="qbtn" data-mpick="${id}"><span class="qicon">${q.icon}</span><span>${esc(q.text)}</span></button>`
            : '';
        })
        .join('')}</div>`;
    else if (x.correct)
      extra =
        (x.frozen
          ? `<div class="ch-bonus">${t('chMathBonus', { p: x.chBonus })}${g.chKind === 'timed' ? t('chTimeBonus') : ''}${x.streak > 1 ? t('chCombo', { n: x.streak }) : ''}</div>`
          : '') +
        `<div class="move-line bonus"><span>${t('bonusClue')} :</span> <strong>${x.qid ? esc(qbyid(x.qid)?.text || '') : t('qGreater', { k: x.math.threshold })} <span class="answer-pill">${x.answer ? t('yesAnswer') : t('noAnswer')}</span></strong></div>`;
  }
  const clue = ['question', 'math'].includes(x.type);
  const move = x.pick
    ? ''
    : x.frozen
      ? `<div class="move-line frozen"><b>🧊</b><span>${t('frozen')}${g.mode === 'challenge' && g.chFreezes != null ? ' ' + t('freezesLeft', { n: g.chFreezes }) : ''}</span></div>`
      : !['found', 'netHit'].includes(x.type)
        ? `<div class="move-line">${blindJump(x.shift)}<span>${t('moved')}${moveHint(x.shift) ? ' <b class="mv-op">' + moveHint(x.shift) + '</b>' : ''}${clue ? '<br><small>' + t('oldClue') + '</small>' : ''}</span></div>`
        : '';
  const top = ['found', 'netHit'].includes(x.type) ? extra : '';
  if (top)
    extra = g.lastHunt ? `<button class="mini-btn rp-open" id="openReplay">🎬 ${t('rpButton')}</button>` : '';
  // capture : loupe à côté du titre (V8.16, plus compact), puis l'annonce du podium en Course
  const head = top
    ? `<div class="catch-head">${top}<div><div class="result-title">${title}</div><p class="result-desc">${desc}</p></div></div>${racePodiumNote(x)}`
    : `<div class="result-title">${title}</div><p class="result-desc">${desc}</p>`;
  return `<div class="result-card ${tone}">${head}${extra}${move}${clue && !x.pick ? `<p class="keep">🧠 ${t('stillYourTurn')}</p>` : ''}</div>${g.net && !myTurn() ? `<p class="net-wait-next">⏳ ${t('netWatching', { player: pname(active()) })}</p>` : ''}<button class="bigbtn ${clue ? '' : 'green'}" id="next" ${(g.net && !myTurn()) || x.pick ? 'hidden' : ''}>${clue ? '🎯 ' + t('continueGuess') : g.mode === 'challenge' && ['found', 'netHit'].includes(x.type) ? t('chSeeScore') : isRace() && g.players > 1 && ['found', 'netHit'].includes(x.type) ? t('raceContinue') : g.players === 1 && ['found', 'netHit'].includes(x.type) ? '🏆 ' + t('soloSeeWin') : g.limit && g.turn + 1 >= g.limit ? t('seeResults') : g.players === 1 ? t('nextTurn') : t('nextPlayer')} ${clue ? '' : arrow()}</button>`;
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
      outcome:
        t(x.correct ? 'mathSuccessLog' : x.timeout ? 'mathTimeoutLog' : 'mathFailureLog') +
        // V8.18 : l'indice gagné est noté dans le carnet (seuil, ou question choisie en Difficile)
        (x.correct && x.answer != null
          ? ` · ${x.qid ? qbyid(x.qid)?.text || '' : t('qGreater', { k: x.math.threshold })} ${x.answer ? t('yesAnswer') : t('noAnswer')}`
          : ''),
      shift: shiftSymbol(x.shift)
    });
  if (x.type === 'found') return t('foundLog', { player: p, n: x.n });
  if (x.type === 'pass') return t('passLog', { player: p, shift: shiftSymbol(x.shift) });
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
  return `<header class="gbar"><span class="brand-icon lvl-badge ${logo}" dir="ltr" aria-label="${t('levelBadge')} 1–${maxN()}"><span class="lvl-emo">${g.mode === 'challenge' ? '🏆' : { junior: '🐣', malin: '🧠', expert: '🚀', genius: '🦉' }[g.level]}</span><b class="lvl-range">1–${maxN()}</b>${logo === 'thinking' ? '<i class="logo-bubble">…</i>' : ''}</span><div class="gstatus">${g.mode === 'challenge' ? `<div class="gstatus-row"><b>${t('turn', { current: g.turn + 1, total: '∞' })}</b><span>🏆 ${chScore()}</span></div>` : `<div class="gstatus-row"><b>${t('turn', { current: g.turn + 1, total: g.limit })}</b><span>🎯 ${g.captures}</span></div><div class="gprogress" dir="ltr"><span style="width:${pct}%"></span></div>`}</div><button class="mini-btn icon-btn" id="openNotebook" aria-label="${t('notebook')}" title="${t('notebook')}">📓</button><button class="mini-btn icon-btn pause-btn" id="pause" aria-label="${t('pause')}" title="${t('pause')}">⏸</button></header>${scoreboard()}<section class="panel turn-card"><div class="turn-top"><div class="mini-mascot">${mascot(anim === 'worried' ? 'idle' : anim, party, anim === 'worried' ? 'worried' : null)}</div><div class="bubble"><b>${head}</b><span class="quip">${netWatchBanner() || quip(qk)}</span></div></div>${result && g.mode !== 'challenge' ? '' : timersHTML()}<div class="turn-body">${result ? resultView() : questionView()}</div></section>`;
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
  return `${g.reduceMotion || soloLost ? '' : confettiRain()}<header class="top">${brand()}${settingsButton()}</header><section class="hero end-hero"><div class="hero-mascot">${mascot(soloLost ? 'grimace' : 'caught')}</div><h1>${g.players === 1 ? (soloLost ? '😅 ' + t('soloLose') : '🏆 ' + t('soloWin') + ' !') : isRace() ? '⏱ ' + t('raceNobody') : t('endTitle') + ' 🏆'}</h1><p class="intro">${isRace() && g.players > 1 ? t('raceNobodyDesc') + ' ' : ''}${g.players === 1 ? (soloLost ? t('soloLoseDesc', { n: g.soloSecret }) : t('soloWinDesc', { turns: g.soloTurns || g.turn + 1 })) : champions.length === 1 ? t('endWinner', { player: champions[0] }) : t('endTie', { players: champions.join(', ') })}</p></section><section class="panel">${escapedNote(true)}<div class="label centered">${t('results')}</div>${order.map((p, i) => `<div class="finalscore"><div class="medal">${['🥇', '🥈', '🥉', '🎖️'][i]}</div><div><strong>${esc(pname(p.i))}</strong><small>${t('subtotals', { c: g.scores[p.i], s: g.stars[p.i] || 0 })}</small></div><strong class="value">${p.v} <small>${t('score')}</small></strong></div>`).join('')}<div class="banner centered">${g.players === 1 ? '' : t('capturesSummary', { count: g.captures, turns: g.limit }) + '<br>'}<small>${t('starsBonus')}</small></div>${netEndNote()}<div class="ec-actions two"><button class="bigbtn" id="again">🔄 ${t('replay')}</button><button class="bigbtn light" id="menu" aria-label="${esc(t('menuBack'))}">⌂</button></div></section>`;
}
/** Course : annonce, au joueur qui prend le téléphone, des captures faites depuis son dernier tour. */
function raceNewsFor(i) {
  if (!isRace() || g.players < 2) return '';
  const news = raceNewsUnseen(i);
  if (!news.length) return '';
  const medal = n => ['🥇', '🥈', '🥉', '🎖️'][Math.min(n, 4) - 1];
  return `<div class="podium-note race-news">${news.map(p => t('raceNewsFound', { medal: medal(placeFor(p.round)), player: pname(p.player) })).join('<br>')}<small>${t('raceNewsNext', { n: placeFor(raceRound()) })}</small></div>`;
}
/** Course : après une capture, place obtenue et annonce du nouveau numéro pour les autres. */
function racePodiumNote(x) {
  if (!isRace() || g.players < 2) return '';
  const place = placeFor(raceRound());
  return `<div class="podium-note">${t('racePlace', { medal: ['🥇', '🥈', '🥉', '🎖️'][place - 1], player: pname(x.player), n: place })}<small>${t('raceNewNumber')}</small></div>`;
}
/** Classement final de la Course : podium (ordre des captures, ex aequo dans un même tour), puis les autres aux points. */
function raceRanking() {
  const placed = g.placed.map(p => ({ i: p.player, place: placeFor(p.round), turn: p.turn }));
  const others = colors
    .slice(0, g.players)
    .map((_, i) => i)
    .filter(i => !isPlaced(i))
    .map(i => ({ i, v: g.scores[i] + (g.stars[i] || 0) }))
    .sort((a, b) => b.v - a.v);
  const first = placed.length + 1;
  others.forEach((o, k) => (o.place = k && o.v === others[k - 1].v ? others[k - 1].place : first + k));
  return { placed, others };
}
/** Fin de la Course : vainqueur(s), podium, puis les joueurs non placés classés aux points. */
function endRace() {
  const { placed, others } = raceRanking(),
    winners = placed.filter(p => p.place === 1).map(p => pname(p.i)),
    next = (g.starter + 1) % g.players,
    medal = n => ['🥇', '🥈', '🥉', '🎖️'][Math.min(n, 4) - 1];
  const rows = [
    ...placed.map(
      p =>
        `<div class="finalscore"><div class="medal">${medal(p.place)}</div><div><strong>${esc(pname(p.i))}</strong><small>${t('podiumCaught', { turn: p.turn })}</small></div></div>`
    ),
    ...others.map(
      o =>
        `<div class="finalscore"><div class="medal">${medal(o.place)}</div><div><strong>${esc(pname(o.i))}</strong><small>${t('podiumNotCaught', { n: o.v })}</small></div></div>`
    )
  ].join('');
  return `${g.reduceMotion ? '' : confettiRain()}<header class="top">${brand()}${settingsButton()}</header><section class="hero end-hero"><div class="hero-mascot">${mascot('caught')}</div><h1>🏆 ${winners.length > 1 ? t('raceWinTie', { players: winners.join(', ') }) : t('raceWin', { player: winners[0] })}</h1><p class="intro">${t('raceWinDesc', { turns: g.raceTurns })}</p></section>
 <section class="panel">${escapedNote(true)}<div class="label centered">${t('podiumTitle')}</div>${rows}<p class="sub centered">${t('nextStarter', { player: pname(next) })}</p>${netEndNote()}<div class="ec-actions two"><button class="bigbtn" id="again">🔄 ${t('replay')}</button><button class="bigbtn light" id="menu" aria-label="${esc(t('menuBack'))}">⌂</button></div></section>`;
}
/**
 * Fin de partie alors que le numéro courait encore : « il était sur le 23 » et le film de son évasion.
 * `withText` : faux en solo, où la phrase de défaite donne déjà le numéro.
 */
function escapedNote(withText) {
  if (!g.escaped) return '';
  const film = g.lastHunt
    ? `<button class="mini-btn rp-open" id="openReplay">🎬 ${t('rpButton')}</button>`
    : '';
  if (!withText && !film) return '';
  return `<div class="escaped-note">${withText ? `<span>🏃 ${t('escapedWas', { n: g.escaped.n })}</span>` : ''}${film}</div>`;
}
/** Récompenses du bureau gagnées pendant la partie : nouveaux badges, missions réussies (V8.15). */
function rewardLine(res, lead = '') {
  // regroupées pour rester sur une ligne : « 🏅 👁️ ⚡ » et « 🎯 ×2 : +40 XP »
  const badges = (res.newBadges || []).map(id => BADGES.find(x => x.id === id)).filter(Boolean),
    done = res.missionsDone || [];
  const chips = [
    badges.length
      ? `<span class="reward-chip" title="${esc(badges.map(b => t('badge_' + b.id)).join(', '))}">${badges.length === 1 ? t('rewardBadge', { name: badges[0].icon + ' ' + t('badge_' + badges[0].id) }) : t('rewardBadges', { icons: badges.map(b => b.icon).join(' ') })}</span>`
      : '',
    done.length
      ? `<span class="reward-chip" title="${esc(done.map(missionText).join(' · '))}">${done.length === 1 ? t('rewardMission', { xp: MISSION_XP }) : t('rewardMissions', { n: done.length, xp: done.length * MISSION_XP })}</span>`
      : ''
  ].join('');
  return chips || lead ? `<div class="reward-line">${lead}${chips}</div>` : '';
}
/** Fin de partie solo : nouvel écran (score, record, XP, conseil) si la partie a été clôturée par settleSolo(). */
function endSolo() {
  return g.soloResult ? endSoloCareer(g.soloResult) : endSoloLegacy();
}
/** Libellé traduit d'un rang (1…RANKS.length). */
const rankName = n => t('rank' + Math.min(n, RANKS.length));
/** Barre de progression du rang pour un total d'XP. */
function rankBar(xp) {
  const r = rankOf(xp);
  return `<div class="rank-line"><b>${t('rankLabel', { n: r.rank })} — ${rankName(r.rank)}</b><small>${
    r.next ? t('rankProgress', { xp, next: r.next, left: r.next - xp, n: r.rank + 1 }) : t('rankMax', { xp })
  }</small></div><div class="xp-bar" role="progressbar" aria-valuenow="${r.pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${r.pct}%"></i></div>`;
}
/** Conseil de fin de partie (clé + variables enregistrées par settleSolo). */
const tipText = ([key, vars]) => t(key, { ...vars, level: vars.levelKey ? t(vars.levelKey) : '' });
function endSoloCareer(res) {
  // V8.15 : écran compact (tout tient en 360×640) — score qui défile, lignes regroupées en pastilles.
  const won = res.won;
  const record = won
    ? res.newRecord
      ? `<div class="ch-new">${t(res.prevBest == null ? 'soloFirstRecord' : 'soloNewRecordPts')}</div>`
      : `<div class="record-chip">${t('soloRecordPts', { n: res.prevBest })}</div>`
    : '';
  const chips = res.lines
    .map(([key, v, vars]) => {
      const label = t(key, vars);
      return `<li title="${esc(label.replace(/<[^>]+>/g, ''))}"><span>${label}</span><b dir="ltr">${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}</b></li>`;
    })
    .join('');
  const top = won
    ? `<div class="ec-score"><div class="solo-stars" aria-label="${res.stars}/3">${[1, 2, 3].map(i => `<span class="${i <= res.stars ? 'on' : ''}" style="--d:${0.15 + i * 0.25}s">★</span>`).join('')}</div><div class="solo-score" dir="ltr"><b data-count="${res.score}" data-count-id="${esc(g.gameId || '')}">${res.score}</b><small> ${t('pts')}</small></div></div>${record}${chips ? `<ul class="ec-lines">${chips}</ul>` : ''}`
    : `<div class="solo-reveal with-side"><div class="found-lens"><span class="lens-glass"><b>${g.soloSecret}</b></span><i class="lens-handle"></i></div><div class="reveal-side"><small>${t('soloLoseEncourage')}</small>${escapedNote(false)}</div></div>`;
  // XP gagnée, badges et missions : une seule ligne de pastilles
  const xp = `<span class="reward-chip xp" title="${esc(t('xpGained'))}">🎖️ <b dir="ltr">+${res.xp + (res.missionXp || 0)} XP</b></span>`;
  return `${won && !g.reduceMotion ? confettiRain() : ''}<header class="top">${brand()}${settingsButton()}</header><section class="hero end-hero ec-head"><div class="hero-mascot">${mascot(won ? (res.newRecord ? 'record' : 'caught') : 'cheer')}</div><div><h1>${won ? '🏆 ' + t('soloWinTitle') : '😅 ' + t('soloLoseTitle')}</h1><p class="intro">${won ? t('soloWinDesc', { turns: res.turns }) : t('soloLoseDesc', { n: g.soloSecret })}</p></div></section>
 <section class="panel centered solo-card career-card ec-card">${top}${rewardLine(res, xp)}${res.rankUp ? `<div class="ch-new">${t('rankUp', { name: rankName(rankOf(res.xpTotal).rank) })}</div>` : ''}${rankBar(res.xpTotal)}<div class="next-goal">💡 <b>${t('nextGoal')}</b> ${tipText(res.tip)}</div>
 <div class="ec-actions"><button class="bigbtn" id="again">🔄 ${t('replay')}</button><button class="bigbtn light" id="openOffice" aria-label="${esc(t('officeBtn'))}">📚</button><button class="bigbtn light" id="menu" aria-label="${esc(t('menuBack'))}">⌂</button></div></section>`;
}
/** Ancien écran de fin (parties terminées avant la V8.8 : aucune récompense n'est inventée a posteriori). */
function endSoloLegacy() {
  const won = g.soloWon !== false,
    turns = won ? g.soloTurns || g.turn + 1 : g.limit,
    h = g.history,
    misses = h.filter(e => e.type === 'wrong' || e.type === 'netMiss').length,
    clues = h.filter(e => e.type === 'question' || e.type === 'math').length,
    stars = won ? (turns <= 3 ? 3 : turns <= 6 ? 2 : 1) : 0;
  return `${won && !g.reduceMotion ? confettiRain() : ''}<header class="top">${brand()}${settingsButton()}</header><section class="hero end-hero"><div class="hero-mascot">${mascot(won ? 'caught' : 'grimace')}</div><h1>${won ? '🏆 ' + t('soloWinTitle') : '😅 ' + t('soloLoseTitle')}</h1><p class="intro">${won ? t('soloWinDesc', { turns }) : t('soloLoseDesc', { n: g.soloSecret })}</p>${escapedNote(false)}</section>
 <section class="panel centered solo-card">${won ? `<div class="solo-stars" aria-label="${stars}/3">${[1, 2, 3].map(i => `<span class="${i <= stars ? 'on' : ''}" style="--d:${0.15 + i * 0.25}s">★</span>`).join('')}</div><div class="solo-rate">${t(['', 'soloRate1', 'soloRate2', 'soloRate3'][stars])}</div>` : `<div class="solo-reveal"><div class="found-lens"><span class="lens-glass"><b>${g.soloSecret}</b></span><i class="lens-handle"></i></div><small>${t('soloReveal')}</small></div>`}
 <div class="solo-stats"><div><b>${turns}</b><small>${t('statTurns')}</small></div><div><b>${clues}</b><small>${t('statClues')}</small></div><div><b>${misses}</b><small>${t('statMisses')}</small></div></div>
 ${won ? (g.soloNewRecord ? `<div class="ch-new">${t('soloNewRecord')}</div>` : g.soloBest ? `<p class="sub">${t('soloBest', { n: g.soloBest })}</p>` : '') : ''}
 ${netEndNote()}<div class="ec-actions two"><button class="bigbtn" id="again">🔄 ${t('replay')}</button><button class="bigbtn light" id="menu" aria-label="${esc(t('menuBack'))}">⌂</button></div></section>`;
}
function endChallenge() {
  const r = records(),
    best = r[chRecordKey()] || 0;
  return `${g.chWon && !g.reduceMotion ? confettiRain() : ''}<header class="top">${brand()}${settingsButton()}</header><section class="hero end-hero"><div class="hero-mascot">${mascot(g.chWon ? 'caught' : 'grimace')}</div><h1>${g.chWon ? '🏆 ' + t('chWin') : '⏱ ' + t('chFail')}</h1><p class="intro">${g.chWon ? t('chStats', { turns: g.turn + 1, time: fmtTime(g.chElapsed) }) : t('chFailDesc', { n: g.chSecret })}</p></section><section class="panel centered"><div class="label">${g.chKind === 'timed' ? '⏱ ' + t('chTimed') : '♾️ ' + t('chEndless')} · ${t('chDiff_' + g.chDiff)}</div><div class="ch-score">${g.chFinal}</div>${g.chRecordNew ? `<div class="ch-new">${t('chNewRecord')}</div>` : `<p class="sub">${best ? t('chRecord', { n: best }) : t('chNoRecord')}</p>`}<p class="sub small">${t(g.chKind === 'timed' ? 'chFormulaTimed' : 'chFormulaEndless')}</p>${netEndNote()}<div class="ec-actions two"><button class="bigbtn" id="again">🔄 ${t('replay')}</button><button class="bigbtn light" id="menu" aria-label="${esc(t('menuBack'))}">⌂</button></div></section>`;
}
