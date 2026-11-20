/*
 * V9.20 : DUEL EXPRESS (Wi-Fi, 2 à 4 joueurs, environ 3 à 5 minutes).
 * Tout le monde joue EN MÊME TEMPS, à chaque manche :
 *   1. un indice automatique (question + réponse) est donné à tous, puis le numéro bouge ;
 *   2. chacun choisit en secret une capture : précise (+10) ou filet (+4, 3 par partie) ; 25 s ;
 *   3. révélation simultanée : captures réussies, et les numéros essayés en vain sont éliminés pour tous.
 * 8 manches, puis l'écran de fin des Points. Moteur séparé du jeu tour par tour (aucune régression).
 * L'hôte arbitre : les choix des autres restent secrets jusqu'à la révélation (redactState).
 */
const DUEL_ROUNDS = 8;
const DUEL_PICK_MS = 25000;
const DUEL_REVEAL_MS = 7000;

const isDuel = () => g.gameMode === 'duel' && !!g.duel;
/** Joueurs qui jouent la manche : présents (et connectés, côté hôte). */
function duelPlayers() {
  const connected = s =>
    !(typeof net === 'object' && net.role === 'host' && net.lobby[s] && !net.lobby[s].connected);
  return Array.from({ length: g.players }, (_, i) => i).filter(s => !isAbsent(s) && connected(s));
}
/** Hôte : début du duel (après start). */
function duelBegin() {
  g.duel = {
    round: 0,
    rounds: DUEL_ROUNDS,
    phase: 'pick',
    picks: {},
    clue: null,
    results: null,
    caught: null
  };
  g.limit = DUEL_ROUNDS;
  g.modal = null;
  duelNewRound();
}
/** Nouvelle manche : indice automatique pour tous, puis le numéro bouge. */
function duelNewRound() {
  const d = g.duel;
  if (!d) return;
  if (d.round >= d.rounds) return duelFinish();
  d.round++;
  g.turn = d.round - 1;
  makeChoices();
  const qid = g.choices[rnd(g.choices.length)],
    q = qbyid(qid),
    answer = !!q.test(g.secret),
    shift = afterClue(n => !!q.test(n) === answer);
  d.clue = { qid, answer, shift };
  d.phase = 'pick';
  d.picks = {};
  d.results = null;
  d.caught = null;
  g.duelElapsed = 0;
  g.duelSel = null;
  sfx('move');
  render();
}
/** Choix secret d'un joueur (modifiable jusqu'à la révélation). */
function duelPick(seat, kind, n) {
  const d = g.duel;
  n = Number(n);
  if (!d || d.phase !== 'pick' || !duelPlayers().includes(seat) || !(n >= 1 && n <= maxN())) return;
  kind = kind === 'net' ? 'net' : 'precise';
  if (kind === 'net' && !((g.netsLeft[seat] || 0) > 0)) return;
  d.picks = { ...d.picks, [seat]: { kind, n } };
  if (duelPlayers().every(s => d.picks[s])) duelReveal();
  else render();
}
/** Révélation : points, numéro attrapé (nouveau numéro) ou numéros essayés éliminés pour tous. */
function duelReveal() {
  const d = g.duel;
  if (!d || d.phase !== 'pick') return;
  const sec = g.secret,
    res = [];
  for (const s of duelPlayers()) {
    const p = d.picks[s];
    if (!p) {
      res.push({ seat: s, none: true, pts: 0 });
      continue;
    }
    if (p.kind === 'net') {
      const nums = netRange(p.n);
      g.netsLeft[s] = Math.max(0, (g.netsLeft[s] || 0) - 1);
      const hit = nums.includes(sec);
      res.push({ seat: s, kind: 'net', nums, hit, pts: hit ? SCORE.net : 0 });
    } else {
      const hit = p.n === sec;
      res.push({ seat: s, kind: 'precise', n: p.n, hit, pts: hit ? SCORE.precise : 0 });
    }
  }
  res.forEach(r => (g.scores[r.seat] += r.pts));
  const hit = res.some(r => r.hit);
  d.results = res;
  d.phase = 'reveal';
  g.duelElapsed = 0;
  if (hit) {
    // le numéro n'est révélé QUE s'il a été attrapé ; un nouveau numéro se cache
    d.caught = sec;
    g.captures++;
    g.secret = 1 + rnd(maxN());
    g.candidates = all(maxN());
    g.shownIds = [];
    g.hunt = null;
  } else {
    const tried = new Set(res.flatMap(r => (r.kind === 'net' ? r.nums : r.kind === 'precise' ? [r.n] : [])));
    g.candidates = g.candidates.filter(x => !tried.has(x));
  }
  sfx(hit ? 'win' : 'bad');
  render();
}
/** Hôte : manche suivante (bouton, ou automatiquement après la lecture). */
function duelNext() {
  if (!g.duel || g.duel.phase !== 'reveal') return;
  duelNewRound();
}
function duelFinish() {
  revealEscaped();
  g.raceWinner = null;
  g.screen = 'end';
  g.inGame = false;
  g.modal = null;
  g.netReady = [];
  seriesRecord();
  versusRecord();
  sfx('win');
  render();
}
/** Chrono du duel (hôte seulement ; arrêté pendant une pause). */
function duelTick(dt) {
  const d = g.duel;
  if (!d || g.screen !== 'game' || g.modal) return;
  g.duelElapsed = (g.duelElapsed || 0) + dt;
  paintDuel();
  netBroadcastTimers();
  if (d.phase === 'pick' && g.duelElapsed >= DUEL_PICK_MS) duelReveal();
  else if (d.phase === 'reveal' && g.duelElapsed >= DUEL_REVEAL_MS) duelNext();
}
/** Met à jour le chrono affiché sans tout redessiner. */
function paintDuel() {
  const el = document.getElementById('duelTime');
  if (!el || !g.duel) return;
  const total = g.duel.phase === 'pick' ? DUEL_PICK_MS : DUEL_REVEAL_MS,
    left = Math.max(0, Math.ceil((total - (g.duelElapsed || 0)) / 1000));
  el.textContent = `⏱ ${left} s`;
  const bar = document.getElementById('duelBar');
  if (bar) bar.style.width = `${Math.max(0, 100 - (100 * (g.duelElapsed || 0)) / total)}%`;
}
/** Texte d'un choix : « 🎯 7 » ou « 🕸️ 6·7·8 ». */
const duelPickText = p => (p.kind === 'net' ? `🕸️ ${(p.nums || netRange(p.n)).join('·')}` : `🎯 ${p.n}`);

/** Écran du duel (tous les téléphones). */
function duelView() {
  const d = g.duel,
    me = g.net ? g.net.seat : 0,
    max = maxN(),
    players = duelPlayers(),
    picked = d.picked || Object.keys(d.picks || {}).map(Number);
  const chips = `<div class="chips duel-chips" style="grid-template-columns:repeat(${g.players},minmax(0,1fr))">${g.scores
    .map(
      (s, i) =>
        `<div class="chip ${i === me ? 'current' : ''}"><span class="cname"><i class="player-dot" style="background:${colors[i]}"></i>${esc(pname(i))}</span><span class="cscore"><b>${s}</b> <small>${d.phase === 'pick' ? (picked.includes(i) ? '✅' : '⏳') : ''}</small></span></div>`
    )
    .join('')}</div>`;
  const q = d.clue && qbyid(d.clue.qid);
  const clue = d.clue
    ? `<div class="duel-clue"><small>🔎 ${t('duelClue')}</small><b>${esc(q ? q.text : '')} <span class="answer-pill">${d.clue.answer ? t('yesAnswer') : t('noAnswer')}</span></b><div class="duel-move">${t('moved')} <b class="mv-op" dir="ltr">${shiftSymbol(d.clue.shift)}</b>${moveHint(d.clue.shift) ? ` <small>${moveHint(d.clue.shift)}</small>` : ''}</div></div>`
    : '';
  let body;
  if (d.phase === 'pick') {
    const mine = (d.picks || {})[me],
      sel = g.duelSel || (mine && mine.n) || null,
      cols = max <= 15 ? 5 : max <= 30 ? 6 : 8,
      nets = g.netsLeft[me] || 0;
    const cells = Array.from({ length: max }, (_, i) => i + 1)
      .map(
        n => `<button type="button" class="duel-n ${sel === n ? 'on' : ''}" data-dsel="${n}">${n}</button>`
      )
      .join('');
    body = `<p class="duel-ask">${mine ? `✅ ${t('duelSent', { pick: duelPickText(mine) })}` : t('duelAsk')}</p><div class="duel-grid" dir="ltr" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">${cells}</div><div class="duel-actions"><button class="bigbtn" id="duelPrecise" type="button" ${sel ? '' : 'disabled'}>🎯 ${t('duelPrecise')}</button><button class="bigbtn light" id="duelNet" type="button" ${sel && nets > 0 ? '' : 'disabled'}>🕸️ ${t('duelNet')} <small>${'●'.repeat(nets)}${'○'.repeat(Math.max(0, NETS_MAX - nets))}</small></button></div><p class="duel-wait">⏳ ${t('duelWaiting', { n: picked.length, total: players.length })}</p>`;
  } else {
    const rows = (d.results || [])
      .map(
        r =>
          `<li class="${r.hit ? 'hit' : r.none ? 'none' : 'miss'}"><span class="cname"><i class="player-dot" style="background:${colors[r.seat]}"></i>${esc(pname(r.seat))}</span><span class="dpick" dir="ltr">${r.none ? '—' : duelPickText(r)}</span><b dir="ltr">${r.hit ? '+' + r.pts : r.none ? '' : '✗'}</b></li>`
      )
      .join('');
    body = `<div class="duel-reveal"><p class="duel-result">${d.caught ? `🎉 ${tHtml('duelCaught', { n: `<b class="big-n">${d.caught}</b>` })}` : `💨 ${t('duelEscaped')}`}</p><ul class="duel-rows">${rows}</ul>${
      !g.net || g.net.role === 'host'
        ? `<button class="bigbtn" id="duelNext" type="button">${d.round >= d.rounds ? t('seeResults') : t('duelNextRound')} ${arrow()}</button>`
        : `<p class="duel-wait">⏳ ${t('duelNextSoon')}</p>`
    }</div>`;
  }
  return `<header class="gbar duel-bar"><span class="duel-title">⚡ ${t('modeDuel')}<small>${t('duelRound', { n: d.round, total: d.rounds })}</small></span><span class="duel-time" id="duelTime"></span><button class="mini-btn icon-btn" id="openNotebook" aria-label="${t('notebook')}" title="${t('notebook')}">📓</button><button class="mini-btn icon-btn pause-btn" id="pause" aria-label="${t('pause')}" title="${t('pause')}">⏸</button></header><div class="duel-timebar"><span id="duelBar"></span></div>${chips}<section class="panel duel-panel">${clue}${body}</section>`;
}
/** Boutons du duel (appelée par bind()). */
function bindDuel(click) {
  if (!isDuel() || g.screen !== 'game') return;
  paintDuel();
  document.querySelectorAll('[data-dsel]').forEach(b =>
    b.addEventListener('click', () => {
      g.duelSel = Number(b.dataset.dsel);
      render();
    })
  );
  const send = kind => {
    if (!g.duelSel) return;
    act('duelPick', kind, g.duelSel);
  };
  click('duelPrecise', () => send('precise'));
  click('duelNet', () => send('net'));
  click('duelNext', () => act('duelNext'));
}
