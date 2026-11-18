/*
 * Fenêtres par-dessus l'écran (g.modal) : règles, défi, noms et mode de jeu, pause,
 * quitter, carnet, film, « passe le téléphone ». Les chronos sont en pause tant qu'une fenêtre est ouverte.
 */

/** HTML de la fenêtre ouverte (ou chaîne vide). */
function modalView() {
  if (!g.modal) return '';
  const wrapM = c =>
    `<div class="modal-back" role="dialog" aria-modal="true"><div class="modal">${c}</div></div>`;
  if (g.modal === 'tutorial' && g.screen === 'home' && g.tut) return wrapM(tutorialView());
  if (g.modal === 'tutInvite' && g.screen === 'home') return wrapM(tutInviteView());
  if (g.modal === 'rules' && g.screen === 'home')
    return wrapM(
      `<h2>📖 ${t('rulesTitle')}</h2><p class="intro-dark">${t('heroText')}</p><div class="steps">${['rule1', 'rule2', 'rule3'].map((key, i) => `<div class="step"><span class="stepnum">${i + 1}</span><span>${t(key)}</span></div>`).join('')}</div><details class="help-fold"><summary>💡 ${t('ruleMovesTitle')}</summary><div class="help-detail">${t('ruleExample')}</div><p class="sub small">${t('levelsFree')}</p></details><button class="bigbtn green" id="rulesTutorial">🎓 ${t('tutTry')}</button><button class="bigbtn light" id="closeModal">${t('close')}</button>`
    );
  if (g.modal === 'challenge' && g.screen === 'home') {
    const r = records(),
      diff = g.chDiffPref in CHALLENGE_DIFFS ? g.chDiffPref : 'medium',
      rec = kind =>
        r[chRecordKey(kind, diff)] ? t('chRecord', { n: r[chRecordKey(kind, diff)] }) : t('chNoRecord'),
      // records V8.3 (ancien barème, non comparables) : affichés pour mémoire, jamais effacés
      old = ['timed', 'endless']
        .filter(k => r[k])
        .map(k => `${t(k === 'timed' ? 'chTimed' : 'chEndless')} ${r[k]}`);
    return wrapM(
      `<h2>🏆 ${t('chTitle')}</h2><p>${t('chDesc')}</p><div class="label">${t('chDiffTitle')}</div><div class="ch-diffs" role="radiogroup">${Object.keys(
        CHALLENGE_DIFFS
      )
        .map(
          d =>
            `<button role="radio" aria-checked="${diff === d}" class="${diff === d ? 'on' : ''}" data-chdiff="${d}"><b>${t('chDiff_' + d)}</b><small>${t('chDiffSub_' + d)}</small></button>`
        )
        .join(
          ''
        )}</div><div class="modal-actions"><button class="bigbtn pink ch-opt" id="chTimed">⏱ ${t('chTimed')}<small>${t('chTimedSub')} · ${rec('timed')}</small></button><button class="bigbtn ch-opt" id="chEndless">♾️ ${t('chEndless')}<small>${t('chEndlessSub')} · ${rec('endless')}</small></button><details class="help-fold"><summary>📊 ${t('chFormulaTitle')}</summary><p class="sub small">⏱ ${t('chFormulaTimed')}</p><p class="sub small">♾️ ${t('chFormulaEndless')}</p></details>${old.length ? `<p class="sub small ch-old">${t('chOldRecords', { list: old.join(' · ') })}</p>` : ''}<button class="mini-btn" id="closeModal">${t('cancel')}</button></div>`
    );
  }
  if (g.modal === 'names' && g.screen === 'home') {
    const multi = g.players > 1,
      lim = [0, 12, 16, 18, 20][g.players];
    return wrapM(
      `<h2>${multi ? '👥 ' + t('namesTitle') : '🕵️ ' + t('readyTitle')}</h2>${multi ? `<p>${t('namesHint')}</p>` : ''}<div class="names">${Array.from({ length: g.players }, (_, i) => `<div class="name-row"><i class="player-dot" style="background:${colors[i]}"></i>${multi ? `<input id="name${i}" data-name="${i}" type="text" maxlength="12" autocomplete="off" enterkeyhint="next" placeholder="${esc(t('player', { n: i + 1 }))}" value="${esc(g.names[i] || '')}">` : `<strong class="solo-name">${t('you')}</strong>`}<button type="button" class="help-chip ${g.playerHelp[i] ? 'on' : ''}" data-phelp="${i}" role="switch" aria-checked="${!!g.playerHelp[i]}">💡 ${t('helpPlayer')}</button></div>`).join('')}</div><p class="help-note">${t('helpPlayerHint')}</p>${multi ? `<div class="label">${t('modeTitle')}</div><div class="mode-pick" role="radiogroup"><button type="button" role="radio" class="mode-card ${g.gameMode !== 'score' ? 'on' : ''}" data-gmode="race" aria-checked="${g.gameMode !== 'score'}"><b>🏁 ${t('modeRace')}</b><small>${t('modeRaceSub')}</small></button><button type="button" role="radio" class="mode-card ${g.gameMode === 'score' ? 'on' : ''}" data-gmode="score" aria-checked="${g.gameMode === 'score'}"><b>🏆 ${t('modeScore')}</b><small>${t('modeScoreSub', { n: lim })}</small></button></div>` : ''}<div class="modal-actions"><button class="bigbtn green" id="namesGo">▶ ${t('namesGo')}</button><button class="mini-btn" id="closeModal">${t('cancel')}</button></div>`
    );
  }
  if (g.screen !== 'game') return '';
  if (g.modal === 'replayAsk')
    return wrapM(
      `<div class="hero-mascot small-mascot">${mascot('aim')}</div><h2>🎬 ${t('rpAskTitle')}</h2><p>${t('rpAskText')}</p><div class="modal-actions"><button class="bigbtn green" id="rpYes">▶ ${t('rpYes')}</button><button class="bigbtn light" id="rpNo">${t('rpNo')}</button><button class="mini-btn" id="rpNever">${t('rpNever')}</button></div>`
    );
  if (g.modal === 'replay' && g.lastHunt)
    return `<div class="modal-back" role="dialog" aria-modal="true"><div class="modal replay">${replayView()}</div></div>`;
  if (g.modal === 'quit')
    return wrapM(
      `<h2>🏠 ${t('quitTitle')}</h2><p>${t('quitText')}</p><div class="modal-actions"><button class="bigbtn pink" id="quitYes">${t('yes')}</button><button class="bigbtn light" id="quitNo">${t('no')}</button></div>`
    );
  if (g.modal === 'pause')
    return wrapM(
      `<div class="hero-mascot small-mascot">${mascot()}</div><h2>⏸ ${t('pauseTitle')}</h2><p>${t('pauseText')}</p><div class="modal-actions"><button class="bigbtn green" id="resumeGame">▶ ${t('resumeBtn')}</button><button class="bigbtn light" id="pauseSettings">⚙️ ${t('settings')}</button><button class="bigbtn pink" id="askQuit">🏠 ${t('askQuit')}</button></div>`
    );
  if (g.modal === 'notebook') {
    const max = maxN(),
      icon = {
        question: '💡',
        math: '🧮',
        found: '🎉',
        wrong: '🎯',
        netHit: '🕸️',
        netMiss: '🕸️',
        timeout: '⏱'
      };
    return wrapM(
      `<h2>📓 ${t('notebook')}</h2>${
        helpMode() === 'off'
          ? `<div class="banner slim">🙈 ${t('nbOff')}</div>`
          : `<div class="nb-count">${t('nbCount', { count: g.candidates.length, max })}</div><div class="nb-grid ${max > 15 ? 'dense' : ''}" dir="ltr">${all(
              max
            )
              .map(n => `<span class="${g.candidates.includes(n) ? 'ok' : 'no'}">${n}</span>`)
              .join(
                ''
              )}</div><div class="nb-legend"><span><i class="ok"></i>${t('nbPossible')}</span><span><i class="no"></i>${t('nbEliminated')}</span></div><p class="nb-note">👣 ${t('nbMoves')}</p>`
      }<h3 class="nb-h">🔎 ${t('nbEvents')}</h3><div class="history-items">${
        g.history.length
          ? g.history
              .slice(-12)
              .reverse()
              .map(h => `<div><span class="hi">${icon[h.type] || '•'}</span> ${historyText(h)}</div>`)
              .join('')
          : `<div>${t('emptyHistory')}</div>`
      }</div><button class="bigbtn light" id="closeModal">${t('close')}</button>`
    );
  }
  const p = active();
  return wrapM(
    `<div class="hero-mascot">${mascot('hop')}</div><h2>${t('handoffTitle', { player: pname(p) })}</h2><p><span class="player-chip" style="background:${colors[p]}">${esc(pname(p))}</span></p>${raceNewsFor(p)}<p>${t('handoffText')}</p><button class="bigbtn green" id="handoffGo">${t('handoffGo')} ${arrow()}</button>`
  );
}
