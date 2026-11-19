/*
 * Fenêtres par-dessus l'écran (g.modal) : règles, défi, noms et mode de jeu, pause,
 * quitter, carnet, film, « passe le téléphone ». Les chronos sont en pause tant qu'une fenêtre est ouverte.
 */

/** HTML de la fenêtre ouverte (ou chaîne vide). */
function modalView() {
  if (!g.modal) return '';
  const wrapM = c =>
    `<div class="modal-back" role="dialog" aria-modal="true"><div class="modal">${c}</div></div>`;
  if (['netWait', 'netLost'].includes(g.modal)) return wrapM(netModalView());
  if (g.modal === 'backup' && g.screen === 'settings') return wrapM(backupView());
  if (g.modal === 'lang' && g.screen === 'settings') return wrapM(langView());
  if (g.modal === 'tip' && g.screen === 'game')
    return wrapM(
      `<div class="tip-box"><div class="mini-mascot">${mascot('idle', false, 'happy')}</div><div><h2>${t('tipTitle')}</h2><p>${t('tip_' + g.tipKey, { max: maxN() })}</p></div></div><button class="bigbtn green" id="tipOk">${t('tipOk')}</button>`
    );
  if (g.modal === 'tutorial' && g.screen === 'home' && g.tut) return wrapM(tutorialView());
  if (g.modal === 'tutInvite' && g.screen === 'home') return wrapM(tutInviteView());
  if (g.modal === 'more' && g.screen === 'home')
    return wrapM(
      `<h2>⋯ ${t('more')}</h2><div class="more-list"><button class="bigbtn light" id="openRules">📖 ${t('rulesTitle')}</button><button class="bigbtn green" id="openTutorial">🎓 ${t('tutTry')}</button>${netTransport() ? `<button class="bigbtn" id="openLanMore">📶 ${t('netHomeBtn')}</button>` : ''}</div><button class="mini-btn" id="closeModal">${t('close')}</button>`
    );
  if (g.modal === 'rules' && g.screen === 'home') {
    // Règles en 3 cartes : comment JOUER d'abord ; les points et les déplacements sont repliés.
    const cards = [
      ['🔎', 'ruleCard1Title', 'ruleCard1'],
      ['💨', 'ruleCard2Title', 'ruleCard2'],
      ['🎯', 'ruleCard3Title', 'ruleCard3']
    ]
      .map(
        ([icon, title, text], i) =>
          `<div class="rule-card"><span class="rule-icon" aria-hidden="true">${icon}</span><div><b>${i + 1}. ${t(title)}</b><p>${t(text)}</p></div></div>`
      )
      .join('');
    return wrapM(
      `<h2>📖 ${t('rulesTitle')}</h2><div class="rule-cards">${cards}</div><details class="help-fold"><summary>💡 ${t('ruleMovesTitle')}</summary><div class="help-detail">${t('ruleExample')}</div><p class="sub small">${t('levelsFree')}</p></details><details class="help-fold"><summary>🏅 ${t('rulePointsTitle')}</summary><div class="help-detail">${t('rulePoints')}</div></details><div class="rule-actions"><button class="bigbtn green" id="rulesTutorial">🎓 ${t('tutBtn')}</button><button class="bigbtn light" id="closeModal">${t('close')}</button></div>`
    );
  }

  if (g.modal === 'challenge' && g.screen === 'home') {
    const r = records(),
      diff = g.chDiffPref in CHALLENGE_DIFFS ? g.chDiffPref : 'medium',
      rec = kind =>
        r[chRecordKey(kind, diff)] ? t('chRecord', { n: r[chRecordKey(kind, diff)] }) : t('chNoRecord'),
      // records des anciennes règles (V8.3, puis V8.4–8.17, non comparables) : affichés pour mémoire, jamais effacés
      old = ['timed', 'endless', `timed-${diff}`, `endless-${diff}`]
        .filter(k => r[k])
        .map(k => `${t(k.startsWith('timed') ? 'chTimed' : 'chEndless')} ${r[k]}`);
    return wrapM(
      `<h2>🏆 ${t('chTitle')}</h2><div class="label">${t('chDiffTitle')}</div><div class="ch-diffs" role="radiogroup">${Object.keys(
        CHALLENGE_DIFFS
      )
        .map(
          d =>
            `<button role="radio" aria-checked="${diff === d}" class="${diff === d ? 'on' : ''}" data-chdiff="${d}"><b>${t('chDiff_' + d)}</b><small>${t('chDiffSub_' + d)}</small></button>`
        )
        .join(
          ''
        )}</div><div class="modal-actions"><button class="bigbtn pink ch-opt" id="chTimed">⏱ ${t('chTimed')}<small>${t('chTimedSub')} · ${rec('timed')}</small></button><button class="bigbtn ch-opt" id="chEndless">♾️ ${t('chEndless')}<small>${t('chEndlessSub')} · ${rec('endless')}</small></button><details class="help-fold"><summary>📏 ${t('chRulesTitle')}</summary><p class="sub small">${t('chDesc')}</p><p class="sub small">${t('chRules_' + diff)}</p><p class="sub small">🏃 ${t('chRulesPass')}</p></details><details class="help-fold"><summary>📊 ${t('chFormulaTitle')}</summary><p class="sub small">⏱ ${t('chFormulaTimed')}</p><p class="sub small">♾️ ${t('chFormulaEndless')}</p></details>${old.length ? `<p class="sub small ch-old">${t('chOldRecords', { list: old.join(' · ') })}</p>` : ''}<button class="mini-btn" id="closeModal">${t('cancel')}</button></div>`
    );
  }
  if (g.modal === 'names' && g.screen === 'home') {
    const multi = g.players > 1,
      lim = TURN_LIMITS[g.players];
    return wrapM(
      `<h2>${multi ? '👥 ' + t('namesTitle') : '🕵️ ' + t('readyTitle')}</h2>${multi ? `<p>${t('namesHint')}</p>` : ''}<div class="names">${Array.from({ length: g.players }, (_, i) => `<div class="name-row"><i class="player-dot" style="background:${colors[i]}"></i>${multi ? `<input id="name${i}" data-name="${i}" type="text" maxlength="12" autocomplete="off" enterkeyhint="next" placeholder="${esc(t('player', { n: i + 1 }))}" value="${esc(g.names[i] || '')}">` : `<strong class="solo-name">${t('you')}</strong>`}<button type="button" class="help-chip ${g.playerHelp[i] ? 'on' : ''}" data-phelp="${i}" role="switch" aria-checked="${!!g.playerHelp[i]}">💡 ${t('helpPlayer')}</button></div>`).join('')}</div><p class="help-note">${t('helpPlayerHint')}${multi ? '' : ' ' + t('helpNoXp')}</p>${multi ? `<div class="label">${t('modeTitle')}</div><div class="mode-pick" role="radiogroup"><button type="button" role="radio" class="mode-card ${g.gameMode !== 'score' ? 'on' : ''}" data-gmode="race" aria-checked="${g.gameMode !== 'score'}"><b>🏁 ${t('modeRace')}</b><small>${t('modeRaceSub')}</small></button><button type="button" role="radio" class="mode-card ${g.gameMode === 'score' ? 'on' : ''}" data-gmode="score" aria-checked="${g.gameMode === 'score'}"><b>🏆 ${t('modeScore')}</b><small>${t('modeScoreSub', { n: lim })}</small></button></div>` : ''}<div class="modal-actions"><button class="bigbtn green" id="namesGo">▶ ${t('namesGo')}</button><button class="mini-btn" id="closeModal">${t('cancel')}</button></div>`
    );
  }
  // film : en partie, ou depuis l'écran de fin quand le numéro s'est échappé (V8.14)
  if (g.modal === 'replay' && g.lastHunt)
    return `<div class="modal-back" role="dialog" aria-modal="true"><div class="modal replay">${replayView()}</div></div>`;
  if (g.screen !== 'game') return '';
  if (g.modal === 'replayAsk')
    return wrapM(
      `<div class="hero-mascot small-mascot">${mascot('aim')}</div><h2>🎬 ${t('rpAskTitle')}</h2><p>${t('rpAskText')}</p><div class="modal-actions"><button class="bigbtn green" id="rpYes">▶ ${t('rpYes')}</button><button class="bigbtn light" id="rpNo">${t('rpNo')}</button><button class="mini-btn" id="rpNever">${t('rpNever')}</button></div>`
    );
  if (g.modal === 'quit')
    return wrapM(
      // V9.5 : après avoir vu le film (le numéro est révélé), plus de retour à la partie : seulement « Fermer »
      g.quitSeen
        ? `<h2>🏠 ${t('quitTitle')}</h2><p>${t('quitSeenText')}</p><button class="mini-btn rp-open" id="quitFilm">🎬 ${t('rpButton')}</button><div class="modal-actions"><button class="bigbtn" id="quitYes">${t('close')}</button></div>`
        : `<h2>🏠 ${t('quitTitle')}</h2><p>${t('quitText')}</p>${g.hunt && g.hunt.steps && g.hunt.steps.length ? `<button class="mini-btn rp-open" id="quitFilm">🎬 ${t('rpButton')}</button><p class="sub small quit-film-note">${t('quitFilmNote')}</p>` : ''}<div class="modal-actions"><button class="bigbtn pink" id="quitYes">${t('yes')}</button><button class="bigbtn light" id="quitNo">${t('no')}</button></div>`
    );
  if (g.modal === 'pause')
    return wrapM(
      `<div class="hero-mascot small-mascot">${mascot()}</div><h2>⏸ ${t('pauseTitle')}</h2><p>${t('pauseText')}</p><div class="modal-actions"><button class="bigbtn green" id="resumeGame">▶ ${t('resumeBtn')}</button><button class="bigbtn light" id="pauseSettings" ${g.net ? 'hidden' : ''}>⚙️ ${t('settings')}</button><button class="bigbtn pink" id="askQuit">🏠 ${t('askQuit')}</button></div>`
    );
  if (g.modal === 'notebook') return wrapM(notebookView());
  const p = active();
  return wrapM(
    `<div class="hero-mascot">${mascot('hop')}</div><h2>${t('handoffTitle', { player: pname(p) })}</h2><p><span class="player-chip" style="background:${colors[p]}">${esc(pname(p))}</span></p>${raceNewsFor(p)}<p>${t('handoffText')}</p><button class="bigbtn green" id="handoffGo">${t('handoffGo')} ${arrow()}</button>`
  );
}

/** Fenêtre « Mes progrès » : créer un code de sauvegarde, ou récupérer des progrès (avec confirmation). */
function backupView() {
  const b = g.backup || { view: 'menu' },
    close = `<button class="bigbtn light" id="backupClose">${t('close')}</button>`,
    sum = s => t('backupSummary', { rank: s.rank, name: rankName(s.rank), xp: s.xp, wins: s.wins });
  if (b.view === 'export')
    return `<h2>📤 ${t('backupExportTitle')}</h2><p>${t('backupExportText')}</p><textarea id="backupCode" class="backup-code" readonly dir="ltr">${esc(b.code)}</textarea>${b.copied ? `<p class="sub">✅ ${t('backupCopied')}</p>` : ''}<button class="bigbtn" id="backupCopy">📋 ${t('backupCopy')}</button>${close}`;
  if (b.view === 'import')
    return `<h2>📥 ${t('backupImportTitle')}</h2><p>${t('backupImportText')}</p><textarea id="backupInput" class="backup-code" dir="ltr" placeholder="NEF1-…">${esc(b.input || '')}</textarea>${b.error ? `<p class="net-error">⚠️ ${t('backupErr_' + b.error)}</p>` : ''}<button class="bigbtn" id="backupCheck">${t('backupCheck')}</button>${close}`;
  if (b.view === 'confirm') {
    const cur = progressSummary(careerProfile(loadCareer()));
    return `<h2>📥 ${t('backupConfirmTitle')}</h2><p>${t('backupContains')}<br><b>${sum(b.summary)}</b></p><p>${t('backupReplaces')}<br>${sum(cur)}</p><button class="bigbtn pink" id="backupApply">${t('backupApply')}</button><button class="bigbtn light" id="backupClose">${t('cancel')}</button>`;
  }
  if (b.view === 'done') return `<h2>✅ ${t('backupDone')}</h2><p>${sum(b.summary)}</p>${close}`;
  return `<h2>💾 ${t('backupTitle')}</h2><p>${t('backupIntro')}</p><button class="bigbtn" id="backupExport">📤 ${t('backupExportTitle')}</button><button class="bigbtn green" id="backupImport">📥 ${t('backupImportTitle')}</button>${close}`;
}

/*
 * Carnet (V8.14) en 3 onglets :
 *   ✏️ Mes marques : l'enfant barre lui-même (grille, ou plages de 10 en Défi 1–100) ;
 *   🔎 Indices    : ce qu'on a appris, du plus récent au plus ancien ;
 *   🤖 Détective  : le carnet automatique, seulement si l'aide « numéros possibles » est activée.
 */
function notebookView() {
  const auto = helpMode() !== 'off',
    tab = g.nbTab === 'clues' || (g.nbTab === 'auto' && auto) ? g.nbTab : 'mine';
  const tabs = [
    ['mine', '✏️', 'nbTabMine'],
    ['clues', '🔎', 'nbTabClues'],
    ...(auto ? [['auto', '🤖', 'nbTabAuto']] : [])
  ]
    .map(
      ([id, icon, k]) =>
        `<button class="nb-tab ${tab === id ? 'is-selected' : ''}" data-nbtab="${id}" aria-pressed="${tab === id}">${icon} ${t(k)}</button>`
    )
    .join('');
  const body = tab === 'mine' ? marksView() : tab === 'clues' ? cluesView() : autoNotebookView();
  return `<h2>📓 ${t('notebook')}</h2><div class="nb-tabs">${tabs}</div>${body}<button class="bigbtn light" id="closeModal">${t('close')}</button>`;
}
/** Grille (ou plages) que l'enfant barre lui-même, et le bouton « Décaler mes marques ». */
function marksView() {
  const max = maxN(),
    out = new Set(marksOf().out),
    left = max - out.size,
    moves = pendingMoves();
  const cell = n =>
    `<button class="nb-cell ${out.has(n) ? 'no' : ''}" data-mark="${n}" aria-pressed="${out.has(n)}">${n}</button>`;
  let grid;
  if (max <= 50) {
    // Génie (1–50) : en plus de la grille, des plages de 10 pour barrer vite
    const ranges =
      max > 30
        ? `<div class="nb-ranges" dir="ltr">${[0, 1, 2, 3, 4]
            .map(d => {
              const a = d * 10 + 1,
                b = a + 9,
                full = all(max)
                  .filter(n => n >= a && n <= b)
                  .every(n => out.has(n));
              return `<button class="nb-range ${full ? 'no' : ''}" data-range="${a}-${b}">${a}–${b}</button>`;
            })
            .join('')}</div>`
        : '';
    grid = `${ranges}<div class="nb-grid mine ${max > 15 ? 'dense' : ''}" dir="ltr">${all(max).map(cell).join('')}</div>`;
  } else {
    // Défi (1–100) : 10 plages ; on en ouvre une pour barrer ses numéros un par un
    const zoom = Number.isInteger(g.nbZoom) && g.nbZoom >= 0 && g.nbZoom < max / 10 ? g.nbZoom : null;
    const tiles = Array.from({ length: max / 10 }, (_, d) => {
      const a = d * 10 + 1,
        b = a + 9,
        n = all(max).filter(x => x >= a && x <= b && !out.has(x)).length;
      return `<button class="nb-range ${n ? '' : 'no'} ${zoom === d ? 'is-open' : ''}" data-zoom="${d}" aria-pressed="${zoom === d}">${a}–${b}<small>${n ? '✔ ' + n : '✖'}</small></button>`;
    }).join('');
    const a = zoom * 10 + 1;
    const row =
      zoom === null
        ? `<p class="nb-note">${t('nbZoomHint')}</p>`
        : `<div class="nb-grid mine dense" dir="ltr">${all(max)
            .filter(n => n >= a && n <= a + 9)
            .map(cell)
            .join('')}</div><button class="mini-btn nb-rangebtn" data-range="${a}-${a + 9}">${
            all(max)
              .filter(n => n >= a && n <= a + 9)
              .every(n => out.has(n))
              ? '↺ ' + t('nbRestoreRange', { a, b: a + 9 })
              : '✖ ' + t('nbCrossRange', { a, b: a + 9 })
          }</button>`;
    grid = `<div class="nb-tiles" dir="ltr">${tiles}</div>${row}`;
  }
  const shift = moves.length
    ? `<div class="nb-shift"><p>👣 ${t('nbShiftHint')}</p><button class="bigbtn" id="shiftMarks"><span dir="ltr">${moves.map(shiftSymbol).join(' · ')}</span> ${t('nbShift')}</button></div>`
    : `<p class="nb-ok">${out.size ? '✅ ' + t('nbUpToDate') : '✏️ ' + t('nbTapHint')}</p>`;
  return `<div class="nb-count">${t('nbMineCount', { count: left, max })}</div>${shift}${grid}${out.size ? `<button class="mini-btn nb-clear" id="clearMarks">🧽 ${t('nbClear')}</button>` : ''}`;
}
/** Indices déjà obtenus (et tentatives), du plus récent au plus ancien. */
function cluesView() {
  const icon = {
    question: '💡',
    math: '🧮',
    found: '🎉',
    wrong: '🎯',
    netHit: '🕸️',
    netMiss: '🕸️',
    timeout: '⏱',
    pass: '🏃'
  };
  return `<div class="history-items nb-clues">${
    g.history.length
      ? g.history
          .slice(-8)
          .reverse()
          .map(h => `<div><span class="hi">${icon[h.type] || '•'}</span> ${historyText(h)}</div>`)
          .join('')
      : `<div>${t('emptyHistory')}</div>`
  }</div>`;
}
/** Carnet automatique (aide « numéros possibles » activée) : il suit chaque déplacement tout seul. */
function autoNotebookView() {
  const max = maxN();
  return `<div class="nb-count">${t('nbCount', { count: g.candidates.length, max })}</div><div class="nb-grid ${max > 15 ? 'dense' : ''} ${max > 50 ? 'huge' : ''}" dir="ltr">${all(
    max
  )
    .map(n => `<span class="${g.candidates.includes(n) ? 'ok' : 'no'}">${n}</span>`)
    .join(
      ''
    )}</div><div class="nb-legend"><span><i class="ok"></i>${t('nbPossible')}</span><span><i class="no"></i>${t('nbEliminated')}</span></div><p class="nb-note">👣 ${t('nbMoves')}</p>`;
}
