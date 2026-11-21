/*
 * Écrans. Chaque fonction RENVOIE du HTML (chaîne) à partir de `g` ; aucune ne modifie
 * l'état. Les clics sont branchés ensuite par bind() (13-render.js) grâce aux id et data-*.
 * Tout texte venant de l'utilisateur passe par esc() ; les traductions par t().
 */

/** Pastilles des joueurs : score, étoiles, joueur actif. */
function scoreboard() {
  if (g.mode === 'challenge') return '';
  return `<div class="chips" style="grid-template-columns:repeat(${g.players},minmax(0,1fr))">${g.scores.map((s, i) => `<div class="chip ${active() === i ? 'current' : ''} ${g.phase === 'result' && g.last && g.last.player === i && ['found', 'netHit', 'wrong', 'netMiss'].includes(g.last.type) ? 'bump' : ''}"><span class="cname">${isRace() && isPlaced(i) ? `<b class="podium-medal">${['🥇', '🥈', '🥉', '🎖️'][placeFor(g.placed.find(p => p.player === i).round) - 1]}</b>` : ''}<i class="player-dot" style="background:${colors[i]}"></i>${teamDot(i)}${esc(pname(i))}${g.series ? `<small class="ser-w" title="${esc(t('seriesTitle'))}">⚔️${g.series.wins[i] || 0}</small>` : ''}</span><span class="cscore"><b>${s}</b> <small>⭐${g.stars[i]}</small></span>${scoreDelta(i)}</div>`).join('')}</div>`;
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
    ? `<button class="mini-btn icon-btn" id="openSettings" type="button" aria-label="${t('settings')}" title="${t('settings')}"><i class="ic ic-gear" aria-hidden="true"></i></button>`
    : `<button class="mini-btn settings-button" id="openSettings" type="button" aria-label="${t('settings')}"><i class="ic ic-gear" aria-hidden="true"></i> <span>${t('settings')}</span></button>`;
}
/** Accueil : nombre de joueurs, niveau, Jouer, défi, règles. */
function home() {
  // Accueil simplifié : Solo ou À plusieurs → niveau → JOUER ; le reste dans 3 boutons.
  const xp = careerProfile(loadCareer()).xpTotal,
    rank = rankOf(xp).rank;
  // V9.2 (maquettes) : 4 tuiles 1 à 4 joueurs (+ Wi-Fi sur Android), le choix est coché
  // V9.27 : icônes des planches du projet (détectives dorés, Wi-Fi doré) au lieu des emojis 👤 👥 📶
  const whoIco = id => `<span class="who-ico who-${id}" aria-hidden="true"></span>`;
  const who = `<div class="label">👥 ${t('players')}</div><div class="who-row players-row">${[1, 2, 3, 4]
    .map(
      n =>
        `<button class="seg who ${g.players === n ? 'is-selected' : ''}" data-players="${n}" aria-pressed="${g.players === n}"><b>${whoIco(n)}</b><small>${n === 1 ? t('onePlayer') : t('nPlayers', { n })}</small></button>`
    )
    .join(
      ''
    )}${netTransport() ? `<button class="seg who lan-chip" id="openLan"><b>${whoIco('wifi')}</b><small>${t('homeWifi')}</small></button>` : ''}</div>`;
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
  return `<header class="top home-top"><button class="rank-chip" id="openOffice2">🎖️ ${rankName(rank)}</button>${settingsButton(true)}</header><section class="hero home-logo"><h1 class="logo-art" role="img" aria-label="The Number Hunt"><span class="sr-only">The Number Hunt</span></h1><p class="tagline">${t('hero1')} ${t('hero2')}</p></section><section class="panel start-panel">${who}<div class="label">📊 ${t('levels')}</div><div class="difficulty">${levels}</div><button class="bigbtn" id="start">▶ ${t('play')}</button><div class="home-row four"><button class="mini-btn rules-btn" id="openRules"><span class="hr-ico" aria-hidden="true">📖</span><span class="hr-txt">${t('rulesTitle')}</span></button><button class="mini-btn ch-btn" id="openChallenge"><span class="hr-ico" aria-hidden="true">🎯</span><span class="hr-txt">${t('chBtn')}</span></button><button class="mini-btn tut-btn" id="openTutorial"><span class="hr-ico" aria-hidden="true">🎓</span><span class="hr-txt">${t('tutBtn')}</span></button><button class="mini-btn office-btn" id="openOffice"><span class="hr-ico" aria-hidden="true">📚</span><span class="hr-txt">${t('officeBtn')}</span></button></div></section><footer class="footer">${t('homeFooter')} · V${APP_VERSION}</footer>`;
}
/** « Mon bureau de détective » : rang, XP, compteurs et records des 4 niveaux (lecture seule). */
function office() {
  const p = careerProfile(loadCareer()),
    tab = ['records', 'badges', 'missions', 'versus'].includes(g.officeTab) ? g.officeTab : 'rank';
  const tabs = [
    ['rank', '🕵️', 'officeTabRank'],
    ['records', '📂', 'officeTabRecords'],
    ['badges', '🏅', 'officeTabBadges'],
    ['missions', '🎯', 'officeTabMissions'],
    ['versus', '🏆', 'vsTab'] // V9.17 : statistiques à plusieurs
  ]
    .map(
      ([id, icon, k]) =>
        `<button class="nb-tab ${tab === id ? 'is-selected' : ''}" data-otab="${id}" aria-pressed="${tab === id}"><i class="ot-ico ot-${id}" aria-hidden="true"></i>${t(k)}${
          id === 'badges' ? ` <small dir="ltr">${badgeCount(p)}/${ALL_BADGES.length}</small>` : ''
        }</button>`
    )
    .join('');
  const body =
    tab === 'versus'
      ? officeVersus()
      : tab === 'badges'
        ? officeBadges(p)
        : tab === 'missions'
          ? officeMissions(p)
          : tab === 'records'
            ? officeRecords(p)
            : officeRank(p);
  return `<header class="top">${brand()}<button class="mini-btn" id="closeOffice">${g.lang === 'ar' ? '›' : '‹'} ${t('back')}</button></header><section class="panel office-panel"><h1 class="settings-title office-title"><i class="ot-desk" aria-hidden="true"></i>${t('officeTitle')}</h1><div class="office-tabs">${tabs}</div>${body}<button class="bigbtn" id="officePlay">▶ ${t('officePlay')}</button></section>`;
}
/** Onglet « Rang » : barre d'XP, frise des 8 chapeaux, compteurs. */
function officeRank(p) {
  const cur = rankOf(p.xpTotal).rank;
  const hats = RANKS.map(
    (_, i) =>
      `<span class="rank-step ${i + 1 <= cur ? 'reached' : ''} ${i + 1 === cur ? 'current' : ''}" title="${esc(rankName(i + 1))}"><i class="mini-hat hat-r${i + 1}"></i>${i + 1}</span>`
  ).join('');
  // V9.6 : statistiques par niveau (Petit et Génie ne se comparent pas) ; niveau choisi par les tuiles
  const lvId = ['junior', 'malin', 'expert', 'genius'].includes(g.officeLevel)
      ? g.officeLevel
      : g.level || 'junior',
    L = p.levels[lvId] || {},
    played = L.gamesPlayed || 0,
    wins = L.wins || 0;
  const lvTabs = [
    ['junior', 'levelJunior'],
    ['malin', 'levelMalin'],
    ['expert', 'levelExpert'],
    ['genius', 'levelGenius']
  ]
    .map(
      ([id, k]) =>
        `<button class="olv lv-${id} ${id === lvId ? 'is-selected' : ''}" data-olevel="${id}" aria-pressed="${id === lvId}"><i class="rec-ico lvl-${id}" aria-hidden="true"></i><span>${t(k)}</span></button>`
    )
    .join('');
  const tiles = [
    ['officePlayed', played],
    ['officeWins', wins],
    ['officeLosses', Math.max(0, played - wins)],
    ['officeStars', L.stars || 0]
  ]
    .map(
      ([k, n]) =>
        `<div><b>${n}</b><small>${t(k)}</small>${k === 'officeWins' && L.helpWins ? `<small class="help-wins">${t('officeHelpWins', { n: L.helpWins })}</small>` : ''}</div>`
    )
    .join('');
  return `<div class="office-rank"><span class="office-badge" aria-hidden="true"><i class="ot-ico ot-rank"></i></span><div>${rankBar(p.xpTotal)}${promoLine(p)}</div></div><div class="label">🎩 ${t('officeHats')}</div><div class="rank-line-hats" dir="ltr">${hats}</div><p class="sub small">${t('officeHatsNext', { name: rankName(Math.min(cur + 1, RANKS.length)) })}</p><div class="label">📊 ${t('officeStatsLevel')}</div><div class="olv-row">${lvTabs}</div><div class="office-tiles">${tiles}</div>`;
}
/** V9.24 : petit sélecteur à onglets d'un onglet du bureau (Solo / Défis / Jour…). */
function officeSeg(attr, cur, items) {
  return `<div class="oseg" role="tablist">${items
    .map(
      ([id, k]) =>
        `<button class="oseg-b ${cur === id ? 'is-selected' : ''}" ${attr}="${id}" role="tab" aria-selected="${cur === id}">${t(k)}</button>`
    )
    .join('')}</div>`;
}
/**
 * V9.24 : comment le rang actuel a été obtenu (dernière montée de rang, Solo classique ou Défi),
 * enregistrée par settleSolo / settleChallenge. Rien pour une carrière d'avant la V9.24.
 */
function promoLine(p) {
  const lp = p.lastPromo;
  if (!lp || lp.rank !== rankOf(p.xpTotal).rank) return '';
  const how =
    lp.src === 'challenge'
      ? t('promoChallenge', { diff: t('chDiff_' + lp.diff) }) + (lp.kind === 'timed' ? ' ⏱' : ' ♾️')
      : t('promoSolo', { level: t(LEVEL_NAME_KEYS[lp.level] || 'levelJunior') });
  return `<p class="promo-line" title="${esc(how)}">🎉 ${t('promoLast', { how })}</p>`;
}
/** Onglet « Records » : Solo classique (par niveau), Défis (par difficulté et variante), Défi du jour. */
function officeRecords(p) {
  const set = ['challenge', 'daily'].includes(g.officeRecSet) ? g.officeRecSet : 'solo';
  const seg = officeSeg('data-rset', set, [
    ['solo', 'officeSetSolo'],
    ['challenge', 'officeSetChallenge'],
    ['daily', 'officeSetDaily']
  ]);
  return (
    seg + (set === 'challenge' ? officeChRecords(p) : set === 'daily' ? officeDaily() : officeSoloRecords(p))
  );
}
function officeSoloRecords(p) {
  const levels = [
    ['junior', '🐣', 'levelJunior'],
    ['malin', '🧠', 'levelMalin'],
    ['expert', '🚀', 'levelExpert'],
    ['genius', '🦉', 'levelGenius']
  ];
  const rows = levels
    .map(([id, emoji, k]) => {
      const lv = p.levels[id] || {};
      return `<li class="rec-row ${lv.bestScore != null ? 'has' : ''}"><span class="rec-lv"><i class="rec-ico lvl-${id}" aria-hidden="true"></i><b>${t(k)}</b></span><span class="rec">${
        lv.bestScore != null
          ? `<b class="rec-pill" dir="ltr">${lv.bestScore} ${t('pts')}${lv.bestHelped ? ' 💡' : ''}</b>`
          : `<i class="rec-todo">${t('officeToDiscover')}</i>`
      }${lv.bestTurns != null ? `<small>${t('officeBestTurns', { n: lv.bestTurns })}</small>` : ''}${lv.helpWins ? `<small class="help-wins">${t('officeHelpWins', { n: lv.helpWins })}</small>` : ''}</span></li>`;
    })
    .join('');
  return `<ul class="office-records">${rows}</ul><p class="sub small">${t('officeNote')}${levels.some(([id]) => (p.levels[id] || {}).bestHelped) ? ' ' + t('officeHelpNote') : ''}</p>`;
}
/** V9.24 : records des Défis — Facile / Moyen / Difficile × chronométré / sans limite (clés chRecordKey). */
function officeChRecords(p) {
  const r = records();
  const rows = CH_DIFF_ORDER.map(d => {
    const cell = kind => {
      const best = r[chRecordKey(kind, d)],
        run = p.challenge.runs[d + '-' + kind];
      return `<span class="crp ${best ? 'has' : ''}" title="${esc(t(kind === 'timed' ? 'chTimed' : 'chEndless'))}"><i aria-hidden="true">${kind === 'timed' ? '⏱' : '♾️'}</i><b dir="ltr">${best ? best : '—'}</b><small dir="ltr">${t('officeChWins', { n: run.wins, m: run.played })}</small></span>`;
    };
    return `<li class="rec-row ch-rec ${r[chRecordKey('timed', d)] || r[chRecordKey('endless', d)] ? 'has' : ''}"><span class="rec-lv"><i class="rec-ico lvl-${CHALLENGE_DIFFS[d]}" aria-hidden="true"></i><b>${t('chDiff_' + d)}</b></span><span class="crp-pair">${cell('timed')}${cell('endless')}</span></li>`;
  }).join('');
  return `<ul class="office-records ch-records">${rows}</ul><p class="sub small">${t('officeChNote')}</p>`;
}
/** V9.24 : historique du Défi du jour — 30 jours en calendrier, détail du jour choisi (résultats officiels). */
function officeDaily() {
  const hist = dailyHistory(),
    played = hist.filter(x => x.res && !x.res.helped), // V9.30 : un jour joué avec l'aide n'est pas compté
    won = played.filter(x => x.res.won).length;
  const sel = hist.find(x => x.day === g.officeDay) || played[0] || hist[0];
  const dateOf = day => {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const cells = hist
    .slice()
    .reverse()
    .map(({ day, res }) => {
      const st = res ? (res.helped ? 'helped' : res.won ? 'won' : 'lost') : 'none';
      return `<button class="dcal ${st} ${day === sel.day ? 'is-selected' : ''} ${day === hist[0].day ? 'today' : ''}" data-dday="${day}" aria-pressed="${day === sel.day}" aria-label="${esc(dateOf(day).toLocaleDateString(g.lang, { day: 'numeric', month: 'long' }))}"><b dir="ltr">${dateOf(day).getDate()}</b></button>`;
    })
    .join('');
  const r = sel.res,
    date = dateOf(sel.day).toLocaleDateString(g.lang, { weekday: 'long', day: 'numeric', month: 'long' });
  const facts =
    r && r.helped
      ? `<b class="dd-res helped">${t('dailyHelped')}</b>${r.tries > 1 ? `<small>${t('dailyTries', { n: r.tries - 1 })}</small>` : ''}`
      : r
        ? [
            `<b class="dd-res ${r.won ? 'won' : 'lost'}">${t(r.won ? 'dailyWon' : 'dailyLost')}</b>`,
            r.score != null ? `<span dir="ltr">${r.score} ${t('pts')}</span>` : '',
            r.won && r.turns != null ? `<span>${t('dailyTurns', { n: r.turns })}</span>` : '',
            r.ms != null ? `<span dir="ltr">⏱ ${fmtTime(r.ms)}</span>` : '',
            r.tries > 1 ? `<small>${t('dailyTries', { n: r.tries - 1 })}</small>` : ''
          ].join('')
        : `<span class="dd-none">${t('dailyNotPlayed')}</span>`;
  return `<p class="daily-sum">${t('dailySummary', { n: played.length, d: DAILY_HISTORY_DAYS, w: won })}</p><div class="daily-cal" dir="ltr">${cells}</div><div class="daily-detail"><b class="dd-date">${esc(date)}</b>${facts}</div><p class="sub small">${t('dailyHistNote')}</p>`;
}
/** V9.17 : « À plusieurs » — victoires, captures, meilleure série de victoires, face-à-face (ce téléphone). */
function officeVersus() {
  const d = loadVersus(),
    ps = Object.entries(d.players)
      .sort((a, b) => b[1].wins - a[1].wins || b[1].games - a[1].games)
      .slice(0, 4);
  const head = `<div class="label vs-label"><i class="ot-ico ot-versus sm" aria-hidden="true"></i>${t('vsTitle')}</div>`;
  if (!ps.length) return `${head}<p class="sub small centered">${t('vsEmpty')}</p>`;
  const rows = ps
    .map(
      ([n, p]) =>
        `<tr><th scope="row">${esc(n)}</th><td dir="ltr"><b>${p.wins}</b><small>/${p.games}</small></td><td dir="ltr">${p.captures}</td><td dir="ltr">${p.best}</td></tr>`
    )
    .join('');
  const duels = Object.entries(d.pairs)
    .sort((a, b) => b[1].games - a[1].games)
    .slice(0, 3)
    .map(([k, pr]) => {
      const [a, b] = k.split('|');
      return `<li><span>${esc(a)}</span><b dir="ltr">${pr.w[a] || 0} – ${pr.w[b] || 0}</b><span>${esc(b)}</span></li>`;
    })
    .join('');
  return `${head}<table class="vs-table"><thead><tr><th></th><th>🏆 ${t('vsWins')}</th><th>🎯 ${t('vsCaptures')}</th><th>🔥 ${t('vsBest')}</th></tr></thead><tbody>${rows}</tbody></table>${duels ? `<div class="vs-duels-t">⚔️ ${t('vsDuels')}</div><ul class="vs-duels">${duels}</ul>` : ''}`;
}
/** Badges gagnés (Solo classique et Défis). */
const badgeCount = p => ALL_BADGES.filter(b => p.badges[b.id]).length;
/**
 * Onglet « Badges » : Solo classique (6 badges à 4 paliers, un par niveau) ou Défis (V9.24).
 * Chaque badge montre son état : à gagner, en cours (7/10), gagné (palier), au maximum.
 */
function officeBadges(p) {
  const set = g.officeBadgeSet === 'challenge' ? 'challenge' : 'solo',
    list = set === 'challenge' ? CH_BADGES : BADGES,
    got = list.filter(b => p.badges[b.id]).length;
  const seg = officeSeg('data-bset', set, [
    ['solo', 'officeSetSolo'],
    ['challenge', 'officeSetChallenge']
  ]);
  const lvName = i => t(LEVEL_NAME_KEYS[LEVEL_ORDER[i - 1]]);
  const shelf = list
    .map(b => {
      const pr = badgeProgress(p, b),
        tier = pr.tier,
        bar =
          pr.goal && pr.state !== 'max'
            ? `<span class="b-prog" dir="ltr"><i style="width:${Math.round((Math.min(pr.cur, pr.goal) / pr.goal) * 100)}%"></i><em>${pr.cur}/${pr.goal}</em></span>`
            : '';
      let line;
      if (b.id === 'chWins')
        line =
          pr.state === 'max'
            ? `<span class="b-got">${t('badgeChWinsGot', { n: pr.cur })}</span>`
            : tier
              ? ''
              : t('badgeHow_chWins', { n: CH_WINS_TIERS[0] });
      else if (b.single)
        line = tier
          ? `<span class="b-got">${t('badgeGot')}</span>`
          : t('badgeHow_' + b.id, { n: CH_EXCELLENT_SCORE });
      else {
        // badges du Solo : 4 paliers, un par niveau (🥉 Petit, 🥈 Moyen, 🥇 Grand, 💎 Génie)
        const only = b.id === 'hound' ? 4 : 0, // « Fin limier » : niveau Génie seulement
          next = tier >= 4 ? 0 : only || tier + 1;
        line = tier
          ? `<span class="b-got">${TIER_MEDALS[tier]} ${t('badgeGotAt', { level: lvName(tier) })}</span>${next ? `<span class="b-next">${t('badgeNextAt', { medal: TIER_MEDALS[next], level: lvName(next) })}</span>` : ''}`
          : t('badgeHow_' + b.id);
      }
      return `<div class="badge ${tier ? 'got tier-' + (b.single ? 1 : tier) : 'locked'} st-${pr.state}"><span class="b-icon b-${b.id}" aria-hidden="true">${b.icon}</span><b>${t('badge_' + b.id)}${tier && !b.single ? ` <i class="b-medal">${TIER_MEDALS[tier]}</i>` : ''}</b><small>${line}${bar}</small></div>`;
    })
    .join('');
  return `${seg}<div class="badge-shelf">${shelf}</div><p class="badges-count sub small" dir="ltr">${got}/${list.length}</p>`;
}
/** Onglet « Missions » : 3 missions sans limite de temps ; une mission réussie est remplacée. */
function officeMissions(p) {
  return `<div class="missions-intro"><i class="ot-ico ot-missions" aria-hidden="true"></i><p>${t('missionsIntro', { xp: MISSION_XP })}</p></div><ul class="mission-list">${p.missions
    .map(
      m =>
        `<li class="${isChMission(m) ? 'm-ch' : ''}"><span class="m-icon" aria-hidden="true"></span><span class="m-txt">${missionText(m)}<span class="m-bar" aria-hidden="true"><i style="width:${Math.round((m.progress / m.goal) * 100)}%"></i></span></span><span class="m-prog" dir="ltr" role="progressbar" aria-valuenow="${m.progress}" aria-valuemin="0" aria-valuemax="${m.goal}">${m.progress}/${m.goal}</span></li>`
    )
    .join('')}</ul>`;
}
/** V9.24 : fenêtre « Détail du score » d'un Défi gagné (lignes de chScoreParts, total = score affiché). */
function chDetailView() {
  const res = g.chResult;
  const rows = res.lines
    .map(([key, v, vars]) => {
      const label = t(key, vars);
      return `<li><span>${label}</span><b dir="ltr" class="${v < 0 ? 'neg' : 'pos'}">${key === 'chLineStart' ? '' : v > 0 ? '+' : '−'}${Math.abs(v)}</b></li>`;
    })
    .join('');
  return `<h2 class="m-title">${t('chScoreDetail')}</h2><ul class="ch-lines">${rows}<li class="ch-total"><span>${t('chLineTotal')}</span><b dir="ltr">${res.score} ${t('pts')}</b></li></ul><p class="sub small ch-formula">${t(res.kind === 'timed' ? 'chFormulaTimed' : 'chFormulaEndless')}</p><button class="bigbtn" id="chDetailClose">${t('close')}</button>`;
}
/** Ferme la fenêtre « Langue » et rétablit la fenêtre d'avant (pause d'une partie, etc.). */
function closeLang() {
  g.modal = g.langFrom || null;
  g.langFrom = null;
}
/** Fenêtre « Langue du jeu » : les 8 langues, chacune écrite dans sa propre langue. */
/** V9.31 : pictogrammes des Réglages et de la Langue (PNG du projet). */
const setIco = id => `<i class="set-ico set-${id}" aria-hidden="true"></i>`;
function langView() {
  const items = LANGS.map(
    ([code, flag, label]) =>
      `<button class="lang-choice ${g.lang === code ? 'is-selected' : ''}" data-language="${code}" lang="${code}" dir="${code === 'ar' ? 'rtl' : 'ltr'}" aria-pressed="${g.lang === code}"><span class="flag">${flag}</span><strong>${label}</strong></button>`
  ).join('');
  return `<h2>${setIco('globe')}${t('language')}</h2><div class="lang-list lang-grid">${items}</div><p class="sub small">${t('languageHint')}</p><button class="mini-btn" id="closeLang">${t('close')}</button>`;
}
/** Réglages : langue, chronos, son, mouvements réduits, film. */
function settings() {
  // Écran compact (sans défilement sur 360 × 735) : une seule carte, une ligne par réglage.
  const toggle = (id, on, icon, label, hint) =>
    `<button class="toggle-row" id="${id}" role="switch" aria-checked="${on}"><span class="flag">${icon}</span><span class="tr-text"><strong>${label}</strong><small>${hint}</small></span><span class="switch ${on ? 'on' : ''}"></span></button>`;
  // 8 langues : une ligne « Langue » qui ouvre la liste complète (fenêtre 'lang', voir langView()).
  const cur = LANGS.find(l => l[0] === g.lang) || LANGS[1];
  const langs = `<button class="toggle-row lang-row" id="openLang"><span class="flag">${setIco('globe')}</span><span class="tr-text"><strong>${t('language')}</strong><small lang="${cur[0]}">${cur[1]} ${cur[2]}</small></span><span class="chev">›</span></button>`;
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
  return `<header class="top">${brand()}<button class="mini-btn" id="closeSettings">${g.lang === 'ar' ? '›' : '‹'} ${t('back')}</button></header><section class="panel settings-panel compact-settings"><h1 class="settings-title">${setIco('gear')}${t('settings')}</h1>${langs}<div class="panel-title">${setIco('timer')}${t('timerTitle')}</div><div class="choice-row">${timers}</div><details class="timer-details"><summary>${t('timerDetails')}</summary><p class="sub small">${t('timerHint')}</p></details>${toggle('soundToggle', g.sound, g.sound ? setIco('sound') : '🔇', t('sound'), t('soundHint'))}${toggle('motionToggle', g.reduceMotion, g.reduceMotion ? '🐢' : setIco('motion'), t('motionReduce'), t('motionHint'))}<button class="toggle-row backup-row" id="openBackup"><span class="flag">${setIco('save')}</span><span class="tr-text"><strong>${t('backupTitle')}</strong><small>${t('backupHint')}</small></span><span class="chev">›</span></button><p class="app-version">${t('appVersion', { v: APP_VERSION })}</p></section>`;
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
           return `<button class="numtile ${showPossible() ? (knownCands().includes(n) ? 'possible' : 'impossible') : ''} ${g.sel === n ? 'sel' : ''} ${inNet ? 'in-net' : ''} ${cap ? 'hit-' + g.capturing.mode : ''}" data-guess="${n}" aria-pressed="${g.sel === n}" aria-label="${n}">${n}${cap && g.capturing.mode === 'precise' ? '<i class="loupe-fx" aria-hidden="true"></i>' : ''}</button>`;
         })
         .join('')}</div>`
 }<div class="capture-row"><button class="capbtn precise" id="capPrecise" ${g.sel == null || g.capturing ? 'disabled' : ''}><span>🎯 ${g.sel != null ? t('captGoPrecise', { n: g.sel }) : t('captPrecise')}</span><small>${g.mode === 'challenge' ? t('chMissPrecise') : isRace() ? (g.players === 1 ? '' : '🏆') : `<bdi dir="ltr">+${SCORE.precise} / −${-SCORE.miss}</bdi>`}</small></button><button class="capbtn net ${netsLeft() ? '' : 'empty'}" id="capNet" ${g.sel == null || g.capturing || !netsLeft() ? 'disabled' : ''}><span>🕸️ ${!netsLeft() ? t('netsNone') : g.sel != null ? `<bdi dir="ltr">${netRange(g.sel).join('·')}</bdi>` : t('captNet')}</span><b class="nets-left" dir="ltr" title="${t('netsLeft', { n: netsLeft() })}" aria-label="${t('netsLeft', { n: netsLeft() })}">${'●'.repeat(netsLeft())}${'○'.repeat(Math.max(0, NETS_MAX - netsLeft()))}</b><small>${g.mode === 'challenge' ? t('chMissNet') : isRace() ? t('captNumbers', { k: netSize() }) : `${t('captNumbers', { k: netSize() })} · <bdi dir="ltr">+${SCORE.net} / −${netSize()}</bdi>`}</small></button></div></div>`;
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
      ? `<b><i class="ic-notebook mini-nb-ico" aria-hidden="true"></i>${t('miniNotebook')}</b>${recent.map(e => `<p>${historyText(e)}</p>`).join('')}`
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
  // V9.25 : étiquette « ×2 » sans le ✖️ (il débordait de la pastille) ; miroir = 10 cases, la ligne passe exactement entre les deux cases du milieu
  // le pion reste DANS sa piste (64 px) : au plus 17 px de chaque côté du centre, plus loin si le saut est grand
  const dx = s.op === '+' ? Math.round(Math.sign(s.k) * (5 + 2.4 * Math.min(Math.abs(s.k), 5))) : 0;
  return `<span class="blind-jump ${kind}" dir="ltr" aria-hidden="true" style="--dx:${dx}px;--dir:${dx < 0 ? -1 : 1}"><span class="bj-track">${'<i></i>'.repeat(kind === 'mirror' ? 10 : 11)}</span><b class="bj-token">?</b></span><b dir="ltr" class="bj-label ${kind}">${shiftSymbol(shift).replace(/✖️ /g, '')}</b>`;
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
/** Écran « Bravo ! » (capture ou calcul réussi), « Oups ! » (raté, filet vide, temps écoulé) ou rien. */
function fbKind(x) {
  if (!x) return null;
  if (['found', 'netHit'].includes(x.type) || (x.type === 'math' && x.correct)) return 'good';
  if (['wrong', 'netMiss', 'timeout'].includes(x.type) || (x.type === 'math' && !x.correct)) return 'bad';
  return null;
}
/** Carte de résultat du coup qui vient d'être joué (g.last). */
function resultView() {
  const x = g.last;
  let title = '',
    desc = '',
    tone = 'good',
    extra = '';
  if (x.type === 'question') {
    // V9.22 : réponse de l'équipe adverse = secrète
    title = hiddenFor(x) ? '🤫 ' + t('teamSecret') : x.answer ? t('yesAnswer') : t('noAnswer');
    desc = esc(qbyid(x.qid)?.text || '');
    tone = x.answer && !hiddenFor(x) ? 'good' : 'neutral';
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
        `<div class="move-line bonus"><span>${t('bonusClue')} :</span> <strong>${x.qid ? esc(qbyid(x.qid)?.text || '') : t('qGreater', { k: x.math.threshold })} <span class="answer-pill">${hiddenFor(x) ? '🤫' : x.answer ? t('yesAnswer') : t('noAnswer')}</span></strong></div>`;
  }
  const clue = ['question', 'math'].includes(x.type);
  const move = x.pick
    ? ''
    : x.frozen
      ? `<div class="move-line frozen"><b>🧊</b><span>${t('frozen')}${g.mode === 'challenge' && g.chFreezes != null ? ' ' + t('freezesLeft', { n: g.chFreezes }) : ''}</span></div>`
      : !['found', 'netHit'].includes(x.type)
        ? `<div class="move-line mv-drap">${blindJump(x.shift)}<span><strong class="mv-title">${t('moved')}</strong>${moveHint(x.shift) ? ' <b class="mv-op">' + moveHint(x.shift) + '</b>' : ''}${clue ? '<br><small>' + t('oldClue') + '</small>' : ''}</span></div>`
        : '';
  const top = ['found', 'netHit'].includes(x.type) ? extra : '';
  if (top)
    extra = g.lastHunt
      ? `<button class="mini-btn rp-open rp-icon" id="openReplay" aria-label="${esc(t('rpButton'))}" title="${esc(t('rpButton'))}"><i class="ico ico-clap" aria-hidden="true"></i></button>`
      : '';
  // capture : loupe à côté du titre (V8.16, plus compact), puis l'annonce du podium en Course
  // V9.2 : écran « Bravo ! » / « Oups ! » des maquettes pour les captures et les calculs
  const fb = fbKind(x);
  if (fb) title = title.replace(/^\S+\s/u, ''); // l'icône ✓ / ✕ remplace l'émoji du titre
  if (x.type === 'math' && !x.pick) title = t(x.correct ? 'fbGood' : x.timeout ? 'timeUp' : 'fbBad');
  if (x.type === 'math' && x.correct && !x.pick && g.mode !== 'challenge') desc = ''; // « ⭐ +1 » le dit déjà
  if (x.type === 'math' && !x.correct)
    desc = `<span class="fb-answer"><small>${t('fbRightWas')}</small><b dir="ltr">${x.math.result}</b><small dir="ltr">${mathText(x.math)} = ${x.math.result}</small></span>`;
  const fbTop = fb
    ? `<div class="fb-top" aria-hidden="true">${fb === 'good' ? '<div class="fb-stars"><i>★</i><i>★</i><i>★</i></div>' : '<div class="fb-burst"></div>'}<div class="fb-ribbon">${fb === 'good' ? t('fbBravo') : t('fbOups')}</div></div>` +
      (top
        ? ''
        : `<div class="fb-hero"><span class="hp hp-${fb === 'good' ? 'bravo' : 'oups'}"></span></div>`)
    : '';
  const titleHtml = `<div class="result-title${fb ? ' fb-pill' : ''}">${fb ? `<i class="fb-mark">${fb === 'good' ? '✓' : '✕'}</i>` : ''}${title}</div>`;
  // V9.5 : les points gagnés / perdus vont dans un jeton « Ton score » à part, pour ne pas les confondre
  // avec le déplacement du numéro (« ← −2 »)
  let scoreChip = '';
  if (fb && ['wrong', 'netMiss'].includes(x.type)) {
    const m = /\s*<b>([+−-]\s?[^<]*)<\/b>\s*[.。]?/.exec(desc);
    if (m) {
      desc = desc.replace(m[0], ' ').trim();
      const neg = /^[−-]/.test(m[1]);
      scoreChip = `<div class="fb-score ${neg ? 'neg' : 'pos'}"><small>${t('fbScore')}</small><b dir="ltr">${neg ? '🔻' : '🔺'} ${m[1]}</b></div>`;
    }
  }
  const points =
    x.type === 'math' && x.correct && !x.pick
      ? `<div class="fb-points">⭐ ${g.mode === 'challenge' ? '+10 ' + t('pts') : '+1'}</div>`
      : '';
  // V9.21 : coup décisif — l'indice qui a mené à la capture
  if (['found', 'netHit'].includes(x.type)) {
    const k = keyClue();
    if (k)
      desc += `<span class="key-clue">🔑 ${t('keyClue', { clue: esc(k.text), player: esc(pname(k.player)) })}</span>`;
  }
  // V9.19 : pronostics gagnants des spectateurs (Wi-Fi)
  if ((g.pronoHits || []).length && ['found', 'netHit', 'wrong', 'netMiss', 'timeout'].includes(x.type))
    desc += `<span class="prono-hit">🔮 ${t('pronoHit', { players: g.pronoHits.map(pname).join(', ') })}</span>`;
  const head = top
    ? `${fbTop}<div class="catch-head">${top}<div>${titleHtml}<p class="result-desc">${desc}</p>${scoreChip}</div></div>${racePodiumNote(x)}`
    : `${fbTop}${titleHtml}${points}${desc ? `<p class="result-desc">${desc}</p>` : ''}${scoreChip}`;
  return `<div class="result-card ${tone}${fb ? ' fb-card fb-' + fb : ''}">${head}${extra}${move}${clue && !x.pick ? `<p class="keep">🧠 ${t('stillYourTurn')}</p>` : ''}</div>${g.net && !myTurn() ? `<p class="net-wait-next">⏳ ${t('netWatching', { player: pname(active()) })}</p>` : ''}<button class="bigbtn ${clue ? '' : 'green'}" id="next" ${(g.net && !myTurn()) || x.pick ? 'hidden' : ''}>${clue ? '🎯 ' + t('continueGuess') : g.mode === 'challenge' && ['found', 'netHit'].includes(x.type) ? t('chSeeScore') : isRace() && g.players > 1 && ['found', 'netHit'].includes(x.type) ? '🏆 ' + t('seeResults') : g.players === 1 && ['found', 'netHit'].includes(x.type) ? '🏆 ' + t('soloSeeWin') : g.limit && g.turn + 1 >= g.limit ? t('seeResults') : g.players === 1 ? t('nextTurn') : t('nextPlayer')} ${clue ? '' : arrow()}</button>`;
}
/**
 * V9.17 : « Pendant ton absence » — sur le même téléphone, ce que les autres ont appris depuis le dernier
 * tour du joueur qui prend le téléphone (3 derniers indices ou captures ratées, sur le numéro en cours).
 */
function awayNews(p) {
  if (g.players < 2 || g.net) return '';
  const h = g.history || [];
  let from = 0;
  for (let i = h.length - 1; i >= 0; i--)
    if (h[i].player === p || ['found', 'netHit'].includes(h[i].type)) {
      from = i + 1;
      break;
    }
  const items = h
    .slice(from)
    .filter(e => e.player !== p && ['question', 'math', 'wrong', 'netMiss'].includes(e.type))
    .filter(e => e.type !== 'math' || e.correct)
    .slice(-3);
  if (!items.length) return '';
  return `<div class="away-news"><b>${t('awayTitle')}</b><ul>${items.map(e => `<li>${historyText(e)}</li>`).join('')}</ul></div>`;
}
/** V9.19 : bouton « Pronostic » des spectateurs (Wi-Fi), dans la bulle du détective. */
function pronoChip() {
  if (!g.net || myTurn() || !pronoAllowed(g.net.seat)) return '';
  const mine = (g.prono || {})[g.net.seat];
  return `<button class="prono-chip" id="pronoOpen" type="button">🔮 ${mine ? `<b dir="ltr">${mine.join('·')}</b>` : t('pronoChoose')}</button>`;
}
/** Grille du pronostic (fenêtre locale à ce téléphone, jamais partagée). */
function pronoOverlay() {
  if (!g.pronoOpen || !g.net || myTurn() || !pronoAllowed(g.net.seat)) return '';
  const mine = (g.prono || {})[g.net.seat] || [],
    max = maxN(),
    cols = max <= 9 ? 3 : max <= 15 ? 5 : 7;
  const cells = Array.from({ length: max }, (_, i) => i + 1)
    .map(
      n =>
        `<button type="button" class="prono-n ${mine.includes(n) ? 'on' : ''}" data-prono="${n}">${n}</button>`
    )
    .join('');
  return `<div class="modal-back prono-back" role="dialog" aria-modal="true"><div class="modal prono-modal"><h2>🔮 ${t('pronoTitle', { player: pname(active()) })}</h2><p class="sub small">${t('pronoHint')}</p><div class="prono-grid" dir="ltr" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">${cells}</div><button class="bigbtn light" id="pronoClose" type="button">${t('close')}</button></div></div>`;
}
/** V9.21 : dernier indice (question, ou calcul juste) avant la capture qui vient d'avoir lieu. */
function keyClue() {
  const h = g.history || [];
  for (let i = h.length - 2; i >= 0; i--) {
    const e = h[i];
    if (['found', 'netHit'].includes(e.type)) return null;
    const q = e.qid ? qbyid(e.qid) : null;
    if (hiddenFor(e) || (['question', 'math'].includes(e.type) && e.answer == null)) continue; // indice adverse
    if (e.type === 'question' && q)
      return { text: `${q.text} ${e.answer ? t('yesAnswer') : t('noAnswer')}`, player: e.player };
    if (e.type === 'math' && e.correct && e.answer != null)
      return {
        text: `${q ? q.text : t('qGreater', { k: e.math.threshold })} ${e.answer ? t('yesAnswer') : t('noAnswer')}`,
        player: e.player
      };
  }
  return null;
}
/** Ligne du carnet pour un événement de l'historique. */
function historyText(x) {
  const p = pname(x.player);
  if (x.type === 'question')
    return t('clueLog', {
      player: p,
      question: qbyid(x.qid)?.text || '',
      answer: hiddenFor(x) ? '🤫' : x.answer ? t('yesAnswer') : t('noAnswer'),
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
        (x.correct && (x.answer != null || hiddenFor(x))
          ? ` · ${x.qid ? qbyid(x.qid)?.text || '' : t('qGreater', { k: x.math.threshold })} ${hiddenFor(x) ? '🤫' : x.answer ? t('yesAnswer') : t('noAnswer')}`
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
  return `<header class="gbar"><span class="brand-icon lvl-badge ${logo}" dir="ltr" aria-label="${t('levelBadge')} 1–${maxN()}"><span class="lvl-emo">${g.mode === 'challenge' ? '🏆' : { junior: '🐣', malin: '🧠', expert: '🚀', genius: '🦉' }[g.level]}</span><b class="lvl-range">1–${maxN()}</b>${logo === 'thinking' ? '<i class="logo-bubble">…</i>' : ''}</span><div class="gstatus">${g.mode === 'challenge' ? `<div class="gstatus-row"><b>${t('turn', { current: g.turn + 1, total: '∞' })}</b><span>🏆 ${chScore()}</span></div>` : `<div class="gstatus-row"><b>${t('turn', { current: g.turn + 1, total: g.limit })}</b><span>🎯 ${g.captures}</span></div><div class="gprogress" dir="ltr"><span style="width:${pct}%"></span></div>`}</div><button class="mini-btn icon-btn" id="openNotebook" aria-label="${t('notebook')}" title="${t('notebook')}"><i class="ic-notebook" aria-hidden="true"></i></button><button class="mini-btn icon-btn pause-btn" id="pause" aria-label="${t('pause')}" title="${t('pause')}">⏸</button></header>${scoreboard()}<section class="panel turn-card${result && fbKind(g.last) ? ' fb-mode' : ''}"><div class="turn-top"><div class="mini-mascot">${mascot(anim === 'worried' ? 'idle' : anim, party, anim === 'worried' ? 'worried' : null)}</div><div class="bubble"><b>${head}</b><span class="quip">${netWatchBanner() || quip(qk)}${pronoChip()}</span></div></div>${result && g.mode !== 'challenge' ? '' : timersHTML()}<div class="turn-body">${result ? resultView() : questionView()}</div></section>${pronoOverlay()}`;
}
/** V9.16 : séries — gagnant(s) de la série (quand elle est finie). */
function seriesChampions() {
  const s = g.series;
  if (!s || !s.done) return [];
  const best = Math.max(...s.wins);
  return s.wins.map((w, i) => (w === best ? pname(i) : null)).filter(Boolean);
}
/** Pastille « Manche 2 · Premier à 3 » + score de la série (« Zied 2 · Ahlem 1 »). */
function seriesPill() {
  const s = g.series;
  if (!s) return '';
  const line = s.wins
    .map(
      (w, i) =>
        `<span class="sp-p"><i class="player-dot" style="background:${colors[i]}"></i>${esc(pname(i))} <b dir="ltr">${w}</b></span>`
    )
    .join('');
  // à 3–4 joueurs, les victoires sont sur les lignes du podium (seriesBadge) : la pastille reste sur une ligne
  return `<div class="series-pill${s.done ? ' done' : ''}"><small>${s.done ? '🏆' : '⚔️'} ${t('seriesRound', { n: s.round })} · ${t('seriesTo', { n: s.target })}</small>${g.players > 2 ? '' : `<div class="sp-line">${line}</div>`}</div>`;
}
/** Victoires de la série d'un joueur, sur sa ligne du podium (3–4 joueurs). */
function seriesBadge(i) {
  return g.series && g.players > 2 ? ` <i class="ser-badge" dir="ltr">⚔️ ${g.series.wins[i] || 0}</i>` : '';
}
/** Texte du bouton « Rejouer » : manche suivante / nouvelle série / prêt (Wi-Fi). */
function replayLabel() {
  if (g.net && (g.netReady || []).includes(g.net.seat))
    return t(g.net.role === 'host' ? 'netLaunchNow' : 'netReadyMe');
  if (g.series) return t(g.series.done ? 'seriesNew' : 'seriesNext');
  return t('replay');
}
/** Titre de fin quand la série est gagnée. */
function seriesTitle() {
  const c = seriesChampions();
  if (!c.length) return '';
  return c.length > 1 ? t('seriesTie', { players: c.join(', ') }) : t('seriesWinner', { player: c[0] });
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
  // V9.4 : personne n'a trouvé le numéro → pas de fête (même si quelqu'un a plus de points)
  const noCatch = g.players > 1 && (isRace() || !g.captures);
  // V9.25 : victoire aux points (sur un téléphone ou en Wi-Fi) = même écran que la victoire de la Course
  if (g.players > 1 && !noCatch) return endPoints(tot, champions);
  return `${g.reduceMotion || soloLost || noCatch ? '' : confettiRain()}<header class="top">${brand()}${settingsButton()}</header><section class="hero end-hero ${noCatch ? 'neutral' : g.players === 1 ? (soloLost ? 'lose' : 'win') : 'win'}"><div class="hero-mascot">${mascot(soloLost || noCatch ? 'cheer' : 'caught')}</div><h1>${g.players === 1 ? (soloLost ? '😅 ' + t('soloLose') : '🏆 ' + t('soloWin') + ' !') : noCatch ? '⏱ ' + t('raceNobody') : seriesTitle() || t('endTitle') + ' 🏆'}</h1><p class="intro">${noCatch ? t('raceNobodyDesc') + ' ' : ''}${g.players === 1 ? (soloLost ? t('soloLoseDesc', { n: g.soloSecret }) : t('soloWinDesc', { turns: g.soloTurns || g.turn + 1 })) : champions.length === 1 ? t('endWinner', { player: champions[0] }) : t('endTie', { players: champions.join(', ') })}</p>${seriesPill()}</section><section class="panel podium-panel">${escapedNote(true)}<div class="label centered">${t('results')}</div>${order.map((p, i) => `<div class="finalscore pod-row place-${i + 1}${noCatch ? ' no-win' : ''}"><div class="medal">${['🥇', '🥈', '🥉', '🎖️'][i]}</div><div><strong>${esc(pname(p.i))}${seriesBadge(p.i)}</strong><small>${t('subtotals', { c: g.scores[p.i], s: g.stars[p.i] || 0 })}</small></div><strong class="value">${p.v} <small>${t('score')}</small></strong></div>`).join('')}<div class="banner centered">${g.players === 1 ? '' : t('capturesSummary', { count: g.captures, turns: g.limit }) + '<br>'}<small>${t('starsBonus')}</small></div>${g.players > 1 ? helpGameNote() : ''}${netEndNote()}<div class="ec-actions two"><button class="bigbtn" id="again"><i class="ic ic-replay" aria-hidden="true"></i>${replayLabel()}</button>${noCatch ? '' : shareButton()}<button class="bigbtn light" id="menu" aria-label="${esc(t('menuBack'))}"><i class="ic ic-home" aria-hidden="true"></i></button></div></section>`;
}
/*
 * V9.26 : écran de victoire commun à la Course et au mode Points (même structure, mêmes styles, mêmes
 * boutons). Chaque mode fournit seulement ses textes et ses lignes de classement.
 */
const PODIUM_MEDALS = ['🥇', '🥈', '🥉', '🎖️'];
const podiumMedal = place => PODIUM_MEDALS[Math.min(place, 4) - 1];
/** V9.30 : à plusieurs, partie où l'aide a servie : dit qu'elle n'est pas comptée dans les statistiques. */
const helpGameNote = () =>
  anyHelped()
    ? `<p class="help-game-note" title="${esc(helpedNames().join(', ') + ' — ' + t('helpNoXp'))}">${t('helpGameNote')}</p>`
    : '';
/** Une ligne du podium : médaille de la place, puis le contenu propre au mode. */
const podiumRow = (place, inner) =>
  `<div class="finalscore pod-row place-${place}"><div class="medal">${podiumMedal(place)}</div>${inner}</div>`;
/** « Le numéro se cachait sur le 47. » (avec le bouton du film quand il existe). */
const caughtNote = (n, film = '') =>
  `<div class="escaped-note race-caught"><span>${tHtml('escapedWas', { n: `<b class="big-n">${n}</b>` })}</span>${film}</div>`;
/**
 * Écran de victoire : décor, confettis, détective, trophée, bandeau vert, numéro caché, podium, prochaine
 * partie (et « prêts » en Wi-Fi), Rejouer / Partager / Accueil.
 * o = { mod (classe du mode, '' pour la Course), title, line (sous le titre), caught, rows }
 */
function victoryScreen({ mod = '', title, line, caught, rows }) {
  const next = (g.starter + 1) % g.players,
    decor = `<div class="race-decor" aria-hidden="true">${'<i></i>'.repeat(10)}<span class="rd-glass"></span></div>`;
  return `${decor}${g.reduceMotion ? '' : confettiRain()}<header class="top">${brand()}${settingsButton()}</header><section class="hero end-hero win race-hero${mod ? ' ' + mod + '-hero' : ''}"><div class="hero-mascot"><span class="win-det" aria-hidden="true"></span></div><div class="rh-side"><div class="rh-trophy" aria-hidden="true"></div><h1>${title}</h1>${g.series ? seriesPill() : `<p class="intro rh-line">${line}</p>`}</div></section>${caught}<section class="panel podium-panel race-panel${mod ? ' ' + mod + '-panel' : ''}"><div class="podium-band"><span>${t('podiumTitle')}</span></div><div class="podium-box">${rows}</div><p class="next-starter">${t('nextStarter', { player: pname(next) })}</p>${helpGameNote()}${netEndNote()}</section><div class="ec-actions two race-actions"><button class="bigbtn" id="again"><i class="ic ic-replay" aria-hidden="true"></i>${replayLabel()}</button>${shareButton()}<button class="home-btn tile-btn" id="menu" aria-label="${esc(t('menuBack'))}"></button></div>`;
}
/**
 * V9.25 : fin du mode Points avec au moins une capture — structure, couleurs et boutons de l'écran de
 * victoire de la Course (référence) : détective, trophée, bandeau vert, numéro caché, podium, prochaine partie.
 * Les valeurs restent celles du jeu : points (captures + ⭐), ex aequo à la même place.
 */
function endPoints(tot, champions) {
  const order = tot
    .map((v, i) => ({ v, i }))
    .sort((a, b) => b.v - a.v)
    .map(o => ({ ...o, place: 1 + tot.filter(x => x > o.v).length })); // ex aequo : même place
  const rows = order
    .map(o => {
      const sub = t('subtotals', { c: g.scores[o.i], s: g.stars[o.i] || 0 });
      return podiumRow(
        o.place,
        `<div class="pr-main"><div class="pr-top"><strong>${esc(pname(o.i))}${seriesBadge(o.i)}</strong><b class="pr-pts" dir="ltr" title="${esc(t('starsBonus'))}">${o.v} <small>${t('score')}</small></b></div><small class="pr-sub" title="${esc(sub)}">${sub}</small></div>`
      );
    })
    .join('');
  const film = g.lastHunt
    ? `<button class="mini-btn rp-open rp-icon" id="openReplay" aria-label="${esc(t('rpButton'))}" title="${esc(t('rpButton'))}"><i class="ico ico-clap" aria-hidden="true"></i></button>`
    : '';
  return victoryScreen({
    mod: 'points',
    title:
      seriesTitle() ||
      (champions.length === 1
        ? t('endWinner', { player: champions[0] })
        : t('endTie', { players: champions.join(', ') })),
    // le score du (des) gagnant(s) mis en valeur, puis le résultat de la partie
    line: tHtml('pointsWinLine', {
      n: `<b class="gold" dir="ltr">${order[0].v}</b>`,
      count: g.captures,
      turns: g.limit
    }),
    caught: g.escaped ? caughtNote(g.escaped.n, film) : '',
    rows
  });
}
/** Course : annonce, au joueur qui prend le téléphone, des captures faites depuis son dernier tour. */
function raceNewsFor(i) {
  if (!isRace() || g.players < 2) return '';
  const news = raceNewsUnseen(i);
  if (!news.length) return '';
  return `<div class="podium-note race-news">${news.map(p => t('raceNewsFound', { medal: podiumMedal(placeFor(p.round)), player: pname(p.player) })).join('<br>')}<small>${t('raceNewsNext', { n: placeFor(raceRound()) })}</small></div>`;
}
/** Course : après une capture, place obtenue et annonce du nouveau numéro pour les autres. */
function racePodiumNote() {
  return ''; // V9.7 : la Course s'arrête à la première capture, plus d'annonce « nouveau numéro »
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
/** Comme t(), mais certaines valeurs sont du HTML déjà sûr (mise en valeur d'un nombre, d'un nom). */
function tHtml(key, html) {
  let out = t(key, Object.fromEntries(Object.keys(html).map(k => [k, '\u0001' + k + '\u0002'])));
  for (const [k, v] of Object.entries(html)) out = out.replace('\u0001' + k + '\u0002', v);
  return out;
}
function endRace() {
  // V9.8 : écran de victoire d'après la maquette (détective, trophée, bandeau vert, podium, prochaine partie)
  const { placed, others } = raceRanking(),
    winners = placed.filter(p => p.place === 1).map(p => pname(p.i)),
    caughtN = g.lastHunt && g.lastHunt.end && g.lastHunt.end.n;
  // V9.22 : en équipes, les deux membres de l'équipe gagnante partagent la 1re place
  const tw = isTeams() ? teamWinners() : [];
  const rows = isTeams()
    ? [0, 1, 2, 3]
        .sort((a, b) => (tw.includes(b) ? 1 : 0) - (tw.includes(a) ? 1 : 0))
        .map(i => {
          const p = placed.find(x => x.i === i),
            o = others.find(x => x.i === i);
          const line = p
            ? tHtml('podiumCaught', { turn: `<b>${p.turn}</b>` })
            : tw.includes(i)
              ? t('teamMateWin')
              : tHtml('podiumNotCaught', { n: `<b dir="ltr">${o ? o.v : 0}</b>` });
          const place = tw.includes(i) ? 1 : 2;
          return podiumRow(
            place,
            `<div><strong>${teamDot(i)}${esc(pname(i))}${seriesBadge(i)}</strong><small>${line}.</small></div>`
          );
        })
        .join('')
    : [
        ...placed.map(p =>
          podiumRow(
            p.place,
            `<div><strong>${esc(pname(p.i))}${seriesBadge(p.i)}</strong><small>${tHtml('podiumCaught', { turn: `<b>${p.turn}</b>` })}.</small></div>`
          )
        ),
        ...others.map(o =>
          podiumRow(
            o.place,
            `<div><strong>${esc(pname(o.i))}${seriesBadge(o.i)}</strong><small>${tHtml('podiumNotCaught', { n: `<b dir="ltr">${o.v}</b>` })}.</small></div>`
          )
        )
      ].join('');
  return victoryScreen({
    title:
      seriesTitle() ||
      (isTeams() && placed.length
        ? t('teamWin', { team: teamName(teamOf(placed[0].i)) })
        : winners.length > 1
          ? t('raceWinTie', { players: winners.join(', ') })
          : t('raceWin', { player: winners[0] })),
    line: t('raceWinDesc', { turns: g.raceTurns }),
    caught: caughtN ? caughtNote(caughtN) : escapedNote(true),
    rows
  });
}
/**
 * Fin de partie alors que le numéro courait encore : « il était sur le 23 » et le film de son évasion.
 * `withText` : faux en solo, où la phrase de défaite donne déjà le numéro.
 */
function escapedNote(withText) {
  if (!g.escaped) return '';
  const film = g.lastHunt
    ? `<button class="mini-btn rp-open rp-icon" id="openReplay" aria-label="${esc(t('rpButton'))}" title="${esc(t('rpButton'))}"><i class="ico ico-clap" aria-hidden="true"></i></button>`
    : '';
  if (!withText && !film) return '';
  return `<div class="escaped-note">${withText ? `<span><i class="ic ic-runner" aria-hidden="true"></i>${t('escapedWas', { n: g.escaped.n })}</span>` : ''}${film}</div>`;
}
/** Récompenses du bureau gagnées pendant la partie : nouveaux badges, missions réussies (V8.15). */
function rewardLine(res, lead = '') {
  // regroupées pour rester sur une ligne : « 🏅 👁️ ⚡ » et « 🎯 ×2 : +40 XP »
  const badges = (res.newBadges || []).map(badgeById).filter(Boolean),
    done = res.missionsDone || [];
  // palier de chaque nouveau badge (V9.24) ; anciens résumés : res.badgeTier pour tous
  const medal = b => {
    const tier = (res.badgeTiers && res.badgeTiers[b.id]) || res.badgeTier;
    return !b.single && tier ? ' ' + TIER_MEDALS[tier] : '';
  };
  const chips = [
    badges.length
      ? `<span class="reward-chip" title="${esc(badges.map(b => t('badge_' + b.id)).join(', '))}">${badges.length === 1 ? t('rewardBadge', { name: badges[0].icon + ' ' + t('badge_' + badges[0].id) + medal(badges[0]) }) : t('rewardBadges', { icons: badges.map(b => b.icon).join(' ') })}</span>`
      : '',
    done.length
      ? `<span class="reward-chip" title="${esc(done.map(missionText).join(' · '))}">${done.length === 1 ? t('rewardMission', { xp: MISSION_XP }) : t('rewardMissions', { n: done.length, xp: done.length * MISSION_XP })}</span>`
      : ''
  ].join('');
  // V9.30 : partie avec l'aide (gagnée ou perdue) = non comptée, dit clairement
  const help = res.helped
    ? `<span class="reward-chip help-chip" title="${esc(t('helpNoXp'))}">${t(res.won ? 'helpedWin' : 'helpedGame')} <small>${t('helpNotCounted')}</small></span>`
    : '';
  return chips || lead || help ? `<div class="reward-line">${lead}${help}${chips}</div>` : '';
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
  const xp = `<span class="reward-chip xp" title="${esc(t('xpGained'))}">🎖️ <b dir="ltr">+${res.xp + (res.missionXp || 0)} XP</b>${res.level && !res.helped ? ` <small>· ${t(LEVEL_NAME_KEYS[res.level])}</small>` : ''}</span>`;
  return `${won && !g.reduceMotion ? confettiRain() : ''}<header class="top">${brand()}${settingsButton()}</header><section class="hero end-hero ec-head ${won ? 'win' : 'lose'}"><div class="hero-mascot">${mascot(won ? (res.newRecord ? 'record' : 'caught') : 'cheer')}</div><div><h1>${won ? '🏆 ' + t('soloWinTitle') : '😅 ' + t('soloLoseTitle')}</h1><p class="intro">${won ? t('soloWinDesc', { turns: res.turns }) : t('soloLoseDesc', { n: g.soloSecret })}</p></div></section>${dailyBanner()}
 <section class="panel centered solo-card career-card ec-card">${top}${rewardLine(res, xp)}${res.rankUp ? `<div class="ch-new">${t('rankUp', { name: rankName(rankOf(res.xpTotal).rank) })}</div>` : ''}${rankBar(res.xpTotal)}<div class="next-goal">💡 <b>${t('nextGoal')}</b> ${tipText(res.tip)}</div>
 <div class="ec-actions"><button class="bigbtn" id="again"><i class="ic ic-replay" aria-hidden="true"></i>${t('replay')}</button><button class="bigbtn light" id="openOffice" aria-label="${esc(t('officeBtn'))}"><i class="ec-ico ec-office" aria-hidden="true"></i></button><button class="bigbtn light" id="menu" aria-label="${esc(t('menuBack'))}"><i class="ec-ico ec-home-det" aria-hidden="true"></i></button></div></section>`;
}
/** Ancien écran de fin (parties terminées avant la V8.8 : aucune récompense n'est inventée a posteriori). */
function endSoloLegacy() {
  const won = g.soloWon !== false,
    turns = won ? g.soloTurns || g.turn + 1 : g.limit,
    h = g.history,
    misses = h.filter(e => e.type === 'wrong' || e.type === 'netMiss').length,
    clues = h.filter(e => e.type === 'question' || e.type === 'math').length,
    stars = won ? (turns <= 3 ? 3 : turns <= 6 ? 2 : 1) : 0;
  return `${won && !g.reduceMotion ? confettiRain() : ''}<header class="top">${brand()}${settingsButton()}</header><section class="hero end-hero ${won ? 'win' : 'lose'}"><div class="hero-mascot">${mascot(won ? 'caught' : 'grimace')}</div><h1>${won ? '🏆 ' + t('soloWinTitle') : '😅 ' + t('soloLoseTitle')}</h1><p class="intro">${won ? t('soloWinDesc', { turns }) : t('soloLoseDesc', { n: g.soloSecret })}</p>${escapedNote(false)}</section>
 <section class="panel centered solo-card">${won ? `<div class="solo-stars" aria-label="${stars}/3">${[1, 2, 3].map(i => `<span class="${i <= stars ? 'on' : ''}" style="--d:${0.15 + i * 0.25}s">★</span>`).join('')}</div><div class="solo-rate">${t(['', 'soloRate1', 'soloRate2', 'soloRate3'][stars])}</div>` : `<div class="solo-reveal"><div class="found-lens"><span class="lens-glass"><b>${g.soloSecret}</b></span><i class="lens-handle"></i></div><small>${t('soloReveal')}</small></div>`}
 <div class="solo-stats"><div><b>${turns}</b><small>${t('statTurns')}</small></div><div><b>${clues}</b><small>${t('statClues')}</small></div><div><b>${misses}</b><small>${t('statMisses')}</small></div></div>
 ${won ? (g.soloNewRecord ? `<div class="ch-new">${t('soloNewRecord')}</div>` : g.soloBest ? `<p class="sub">${t('soloBest', { n: g.soloBest })}</p>` : '') : ''}
 ${netEndNote()}<div class="ec-actions two"><button class="bigbtn" id="again"><i class="ic ic-replay" aria-hidden="true"></i>${t('replay')}</button><button class="bigbtn light" id="menu" aria-label="${esc(t('menuBack'))}"><i class="ic ic-home" aria-hidden="true"></i></button></div></section>`;
}
/**
 * Fin de Défi (V9.24) : score et son détail (chScoreParts, les mêmes chiffres que le record), tours,
 * temps, calculs justes, erreurs, record de la variante, XP, badges, missions et rang.
 * Défi terminé avant la V9.24 (sans g.chResult) : même écran sans récompenses (rien d'inventé).
 */
function endChallenge() {
  const res = g.chResult,
    won = !!g.chWon,
    best = records()[chRecordKey()] || 0,
    kindLabel = g.chKind === 'timed' ? '⏱ ' + t('chTimed') : '♾️ ' + t('chEndless');
  const meta = `<div class="ch-meta"><span class="ch-pill">${kindLabel}</span><span class="ch-pill diff-${esc(g.chDiff)}">${t('chDiff_' + g.chDiff)}</span></div>`;
  const record = won
    ? g.chRecordNew
      ? `<div class="ch-new">${t(res && res.prevBest ? 'chNewRecord' : 'chFirstRecord')}</div>`
      : `<div class="record-chip">${best ? t('chRecord', { n: best }) : t('chNoRecord')}</div>`
    : '';
  const stat = (n, k) => `<div><b dir="ltr">${n}</b><small>${t(k)}</small></div>`;
  const stats = res
    ? `<div class="solo-stats ch-stats">${stat(res.turns, 'statTurns')}${stat(fmtTime(res.timeMs), g.chKind === 'timed' ? 'chStatTimeUsed' : 'chStatTime')}${stat(res.goodMath, 'chStatGoodMath')}${stat(res.errors, 'chStatErrors')}</div>`
    : '';
  // V9.24 : le détail du score s'ouvre dans une fenêtre (l'écran de fin ne défile jamais)
  const detail =
    res && won && res.lines.length
      ? `<button class="mini-btn ch-detail-btn" id="openChDetail"><i class="ic-sum" aria-hidden="true">Σ</i>${t('chScoreDetail')}</button>`
      : '';
  const top = won
    ? `${meta}<div class="ec-score"><div class="solo-score ch-score" dir="ltr"><b data-count="${g.chFinal}" data-count-id="${esc('ch-' + (g.gameId || ''))}">${g.chFinal}</b><small> ${t('pts')}</small></div></div>${record}`
    : `${meta}<div class="solo-reveal with-side"><div class="found-lens"><span class="lens-glass"><b>${g.chSecret}</b></span><i class="lens-handle"></i></div><div class="reveal-side"><small>${t('chLoseEncourage')}</small></div></div>`;
  // XP (détail au survol), badges, missions ; Facile au-delà de la limite du jour : 0 XP expliqué
  const xpTitle = res ? res.xpLines.map(([k, v]) => `${t(k)} +${v}`).join(' · ') : '';
  const xp = res
    ? `<span class="reward-chip xp" title="${esc(res.xpCapped ? t('chXpCapped', { n: CH_EASY_XP_PER_DAY }) : xpTitle)}">🎖️ <b dir="ltr">+${res.xp + (res.missionXp || 0)} XP</b>${res.xpCapped ? ` <small>· ${t('chXpCappedShort')}</small>` : ''}</span>`
    : '';
  const career = res
    ? `${rewardLine(res, xp + (res.rankUp ? `<span class="reward-chip rank-up">${t('rankUp', { name: rankName(res.rank) })}</span>` : ''))}${rankBar(res.xpTotal)}`
    : '';
  const film = g.lastHunt
    ? `<button class="mini-btn rp-open rp-icon" id="openReplay" aria-label="${esc(t('rpButton'))}" title="${esc(t('rpButton'))}"><i class="ico ico-clap" aria-hidden="true"></i></button>`
    : '';
  const tools = detail || film ? `<div class="ch-tools">${detail}${film}</div>` : '';
  return `${won && !g.reduceMotion ? confettiRain() : ''}<header class="top">${brand()}${settingsButton()}</header><section class="hero end-hero ec-head ${won ? 'win' : 'lose'}"><div class="hero-mascot">${mascot(won ? (g.chRecordNew ? 'record' : 'caught') : 'cheer')}</div><div><h1>${won ? '🏆 ' + t('chWin') : '⏱ ' + t('chFail')}</h1><p class="intro">${won ? t('chStats', { turns: g.turn + 1, time: fmtTime(g.chElapsed) }) : t('chFailDesc', { n: g.chSecret })}</p></div></section>
 <section class="panel centered solo-card career-card ec-card ch-end">${top}${stats}${tools}${career}${netEndNote()}
 <div class="ec-actions"><button class="bigbtn" id="again"><i class="ic ic-replay" aria-hidden="true"></i>${t('replay')}</button><button class="bigbtn light" id="openOffice" aria-label="${esc(t('officeBtn'))}"><i class="ec-ico ec-office" aria-hidden="true"></i></button><button class="bigbtn light" id="menu" aria-label="${esc(t('menuBack'))}"><i class="ic ic-home" aria-hidden="true"></i></button></div></section>`;
}
