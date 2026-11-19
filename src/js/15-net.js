/*
 * Multijoueur Wi-Fi local : 2 à 4 joueurs, un téléphone chacun, sans Internet ni serveur.
 *
 * Principe : un téléphone HÔTE crée la partie (code à 4 chiffres) et en est le SEUL arbitre.
 *   - L'hôte fait tourner le moteur habituel (g, ask, guess, nextTurn…) ; il est le joueur 0.
 *   - Les autres téléphones envoient seulement des ACTIONS ({ t: 'action', name, args }) ;
 *     l'hôte vérifie que c'est bien leur tour puis les applique (table GAME_ACTIONS).
 *   - Après chaque changement, l'hôte envoie à chacun une COPIE de l'état SANS le numéro secret,
 *     son parcours ni la réponse du calcul en cours (redactState). Chaque téléphone l'affiche
 *     avec les écrans habituels ; seuls les réglages d'affichage restent propres à chacun.
 *
 * Transport : objet window.NumeroNet fourni par l'application Android (NetBridge.java), ou par
 * les tests automatiques (faux réseau). Contrat, messages et événements : docs/MULTIJOUEUR.md.
 * Sans transport (version navigateur), le mode Wi-Fi n'est pas proposé.
 */

const NET_PROTOCOL = 1; // à incrémenter si les messages changent : deux versions différentes refusent de jouer ensemble
const NET_MAX = 4;
/** Réglages d'affichage propres à chaque téléphone : jamais écrasés par l'état reçu de l'hôte. */
const NET_LOCAL_KEYS = [
  'lang',
  'sound',
  'reduceMotion',
  'showInfo',
  'showHints',
  'showHistory',
  'rpAuto',
  'rpIdx',
  'rpPlaying',
  'myName', // prénom de CE téléphone (sinon celui de l'hôte s'affichait la fois suivante)
  'netLostInfo',
  'marks', // carnet « à la main » : chacun barre sur son téléphone
  'nbTab',
  'nbZoom'
];
/** Fenêtres partagées par tous (les autres, comme le carnet ou le film, restent locales). */
const NET_SHARED_MODALS = ['pause', 'netWait'];

/** Transport réseau disponible ? (application Android ou tests) */
const netTransport = () => (typeof window.NumeroNet === 'object' && window.NumeroNet) || null;

/**
 * État réseau de CE téléphone (jamais sauvegardé : une connexion ne survit pas à un redémarrage).
 *   role 'host' : code, lobby [{ seat, name, peer, token, connected }]
 *   role 'client' : code, seat, token, lobby (copie), hostName
 */
let net = { role: null };

/** C'est à ce téléphone de jouer ? (toujours vrai hors multijoueur Wi-Fi) */
const myTurn = () => !g.net || active() === g.net.seat;

/** Toute action de jeu passe par ici : locale, appliquée par l'hôte, ou envoyée à l'hôte. */
function act(name, ...args) {
  const fn = GAME_ACTIONS[name];
  if (!fn) return;
  if (!g.net) return fn(...args);
  if (!['pause', 'resume'].includes(name) && !myTurn()) return; // seul le joueur dont c'est le tour agit
  if (g.net.role === 'host') return fn(...args);
  netSend('host', { t: 'action', name, args });
}

function netSend(peer, msg) {
  const tr = netTransport();
  try {
    if (tr) tr.send(peer, JSON.stringify(msg));
  } catch (e) {
    // pont réseau indisponible : la coupure sera signalée par un événement
  }
}
const newToken = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const netName = () => (g.myName || '').trim() || t('netDefaultName');

/* ---------- Hôte ---------- */

/** Crée une partie : code à 4 chiffres, salle d'attente avec l'hôte comme joueur 1. */
function netCreate() {
  const tr = netTransport();
  if (!tr) return;
  net = {
    role: 'host',
    code: String(1000 + rnd(9000)),
    lobby: [{ seat: 0, name: netName(), peer: null, token: newToken(), connected: true }],
    lastSent: {}
  };
  g.screen = 'lan';
  g.lan = { view: 'hostLobby', error: null };
  tr.hostStart(net.code);
  if (tr.keepAwake) tr.keepAwake(true);
  render();
}

/**
 * Lance la partie avec les joueurs de la salle d'attente (2 à 4).
 * Première partie : le premier joueur est tiré au sort (avant, c'était toujours l'hôte).
 * « Rejouer » (relaunch) : le premier joueur a déjà tourné ; s'il ne reste personne,
 * l'hôte revient à la salle d'attente, avec le même code, pour que les autres reviennent.
 */
function netLaunch(relaunch = false) {
  if (net.role !== 'host') return;
  const seats = net.lobby.filter(p => p.connected);
  if (seats.length < 2) {
    if (!relaunch) return;
    net.lobby = seats.map((p, i) => ({ ...p, seat: i }));
    Object.assign(g, { net: null, screen: 'lan', inGame: false, modal: null, absent: [] });
    g.lan = { view: 'hostLobby', error: null };
    render();
    netBroadcastLobby();
    return;
  }
  net.lobby = seats.map((p, i) => ({ ...p, seat: i }));
  if (!relaunch || g.players !== seats.length) g.starter = rnd(seats.length);
  g.players = seats.length;
  g.names = net.lobby.map(p => p.name);
  g.playerHelp = [false, false, false, false];
  start(true);
  g.net = { role: 'host', seat: 0 };
  g.absent = [];
  g.lan = null;
  render();
  netBroadcastLobby();
}

/** « Rejouer » de l'hôte : même salle, joueurs encore connectés (le premier joueur tourne). */
const netRelaunch = () => netLaunch(true);

/** Copie de l'état envoyée aux autres : sans secret, sans parcours, sans la réponse du calcul en cours. */
function redactState(seat) {
  const s = JSON.parse(JSON.stringify(g));
  delete s.secret;
  delete s.hunt;
  // Le carnet « à la main » des joueurs a besoin des sauts (publics : chacun les voit annoncés),
  // jamais des positions : on n'envoie que le type de chaque saut.
  s.huntPublic = g.hunt ? g.hunt.steps.map(x => ({ shift: x.shift, ev: x.ev ? 1 : 0 })) : null;
  delete s.soloSecret;
  if (s.math) s.math = { ...s.math, result: null };
  if (!NET_SHARED_MODALS.includes(s.modal)) s.modal = null;
  s.sel = null;
  s.capturing = g.capturing; // l'animation de capture est montrée à tous
  s.net = { role: 'client', seat, connected: net.lobby.map(p => p.connected) };
  for (const k of NET_LOCAL_KEYS) delete s[k];
  return s;
}

/** Après chaque affichage de l'hôte : envoie la nouvelle copie à chaque joueur connecté (si elle a changé). */
function netBroadcast() {
  if (net.role !== 'host' || !g.net) return;
  for (const p of net.lobby) {
    if (!p.peer || !p.connected) continue;
    const msg = JSON.stringify({ t: 'state', s: redactState(p.seat) });
    if (net.lastSent[p.peer] === msg) continue;
    net.lastSent[p.peer] = msg;
    netTransport().send(p.peer, msg);
  }
}
/** Chronos : envoyés deux fois par seconde, sans tout redessiner. */
let netTimerSent = 0;
function netBroadcastTimers() {
  if (net.role !== 'host' || !g.net || Date.now() - netTimerSent < 500) return;
  netTimerSent = Date.now();
  const v = { turnElapsed: g.turnElapsed, answerElapsed: g.answerElapsed, mathElapsed: g.mathElapsed };
  for (const p of net.lobby) if (p.peer && p.connected) netSend(p.peer, { t: 'timers', v });
}
function netBroadcastLobby() {
  const players = net.lobby.map(p => ({ seat: p.seat, name: p.name, connected: p.connected }));
  for (const p of net.lobby)
    if (p.peer && p.connected) netSend(p.peer, { t: 'lobby', players, started: !!g.net });
}

function hostOnMessage(peer, m) {
  if (m.t === 'hello') {
    if (m.v !== NET_PROTOCOL) return netSend(peer, { t: 'error', code: 'version' });
    if (String(m.code) !== net.code) return netSend(peer, { t: 'error', code: 'code' });
    const returning = net.lobby.find(p => m.token && p.token === m.token);
    if (returning) {
      // retour d'un joueur (coupure Wi-Fi, écran éteint…) : il reprend sa place
      returning.peer = peer;
      returning.connected = true;
      delete net.lastSent[peer];
      if (g.modal === 'netWait' && g.netWaitSeat === returning.seat) g.modal = null;
      netSend(peer, { t: 'welcome', seat: returning.seat, token: returning.token });
      render();
      netBroadcastLobby();
      return;
    }
    if (g.net) return netSend(peer, { t: 'error', code: 'started' });
    if (net.lobby.length >= NET_MAX) return netSend(peer, { t: 'error', code: 'full' });
    const name =
      String(m.name || '')
        .slice(0, 14)
        .trim() || t('netDefaultName');
    const p = { seat: net.lobby.length, name, peer, token: newToken(), connected: true };
    net.lobby.push(p);
    netSend(peer, { t: 'welcome', seat: p.seat, token: p.token });
    netBroadcastLobby();
    render();
    return;
  }
  if (m.t === 'again') {
    // « Rejouer » demandé depuis le téléphone d'un invité : même effet que le bouton de l'hôte
    const p = net.lobby.find(x => x.peer === peer && x.connected);
    if (!p || !g.net || g.screen !== 'end') return;
    if (g.players > 1) g.starter = ((g.starter || 0) + 1) % g.players;
    netRelaunch();
    return;
  }
  if (m.t === 'action') {
    const p = net.lobby.find(x => x.peer === peer && x.connected);
    if (!p || !g.net || !GAME_ACTIONS[m.name]) return;
    if (!['pause', 'resume'].includes(m.name) && active() !== p.seat) return; // pas son tour : ignoré
    GAME_ACTIONS[m.name](...(Array.isArray(m.args) ? m.args.slice(0, 2) : []));
  }
}

function hostOnLeft(peer) {
  const p = net.lobby.find(x => x.peer === peer);
  if (!p) return;
  p.connected = false;
  if (!g.net) net.lobby = net.lobby.filter(x => x !== p).map((x, i) => ({ ...x, seat: i })); // salle d'attente
  netBroadcastLobby();
  render();
}

/** Hôte : si le joueur dont c'est le tour est déconnecté, tout le monde attend (fenêtre « netWait »). */
function netCheckWaiting() {
  if (net.role !== 'host' || !g.net || g.screen !== 'game') return;
  const p = net.lobby[active()];
  if (p && !p.connected && !isAbsent(p.seat) && !g.modal) {
    g.modal = 'netWait';
    g.netWaitSeat = p.seat;
    g.netWaitSince = Date.now();
    render();
  }
}
/** Hôte : « Continuer sans lui » — ses tours seront sautés. */
function netContinueWithout() {
  if (net.role !== 'host' || g.modal !== 'netWait') return;
  const seat = g.netWaitSeat;
  g.absent = [...(g.absent || []), seat];
  g.modal = null;
  if (active() === seat) {
    g.last = null;
    advanceTurn();
  } else render();
}

/* ---------- Joueur invité ---------- */

function netJoin(code) {
  const tr = netTransport();
  code = String(code || '').replace(/\D/g, '');
  if (!tr || code.length !== 4) {
    g.lan = { view: 'join', error: 'code' };
    return render();
  }
  net = { role: 'client', code, seat: null, token: net.code === code ? net.token : null, lobby: [] };
  g.lan = { view: 'joining', error: null };
  tr.joinStart(code);
  if (tr.keepAwake) tr.keepAwake(true);
  render();
}

/** Applique la copie reçue de l'hôte, en gardant les réglages et la sélection propres à ce téléphone. */
function clientApplyState(s) {
  const keep = Object.fromEntries(NET_LOCAL_KEYS.map(k => [k, g[k]]));
  const localModal = ['notebook', 'replay', 'netLost'].includes(g.modal) ? g.modal : null;
  const sameTurn = g.turn === s.turn && g.phase === s.phase;
  const local = { sel: sameTurn ? g.sel : null, typed: sameTurn ? g.typed : '' };
  g = Object.assign(s, keep, local);
  if (localModal && !s.modal) g.modal = localModal;
  g.lan = null;
  render();
}

function clientOnMessage(m) {
  if (m.t === 'welcome') {
    net.seat = m.seat;
    net.token = m.token;
    if (g.net) {
      // retour dans une partie en cours après une coupure : l'état complet suit
      g.modal = g.modal === 'netLost' ? null : g.modal;
      g.netLostInfo = null;
      render();
      return;
    }
    g.lan = { view: 'clientLobby', error: null };
    render();
  } else if (m.t === 'lobby') {
    net.lobby = m.players || [];
    if (!m.started && g.lan) {
      g.lan.view = 'clientLobby';
      render();
    }
  } else if (m.t === 'state' && m.s) clientApplyState(m.s);
  else if (m.t === 'timers' && g.net) {
    Object.assign(g, m.v);
    paintTimers();
  } else if (m.t === 'error') {
    netStop();
    g.lan = { view: 'join', error: m.code };
    render();
  }
}

/* ---------- Événements du transport ---------- */

/** Point d'entrée des événements du transport (Android ou tests) : chaîne JSON. */
window.__netEvent = raw => {
  let e;
  try {
    e = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (err) {
    return;
  }
  if (!e || !net.role) return;
  if (e.type === 'message') {
    let m;
    try {
      m = JSON.parse(e.data);
    } catch (err) {
      return;
    }
    if (!m || typeof m !== 'object') return;
    return net.role === 'host' ? hostOnMessage(e.peer, m) : clientOnMessage(m);
  }
  if (net.role === 'host') {
    if (e.type === 'peerLeft') hostOnLeft(e.peer);
    else if (e.type === 'hosting') {
      net.address = e.ip && e.port ? `${e.ip}:${e.port}` : null;
      render();
    } else if (e.type === 'error') {
      netStop();
      if (g.net) {
        // le Wi-Fi de l'hôte a lâché en pleine partie : on le dit, avec un bouton pour sortir
        g.modal = 'netLost';
        g.netLostInfo = { host: true };
      } else g.lan = { view: 'menu', error: 'host' };
      render();
    }
    return;
  }
  // invité
  if (e.type === 'connected')
    netSend('host', { t: 'hello', v: NET_PROTOCOL, code: net.code, name: netName(), token: net.token });
  else if (e.type === 'error') {
    if (g.net) {
      // nouvelle tentative ratée (l'hôte a quitté ou relancé une autre partie) : on reste dans la
      // fenêtre « connexion perdue », jamais sur un écran de jeu figé
      g.modal = 'netLost';
      g.netLostInfo = { failed: true };
    } else g.lan = { view: 'join', error: e.code || 'notFound' };
    render();
  } else if (e.type === 'disconnected') {
    if (g.net) {
      g.modal = 'netLost';
      g.netLostInfo = { ended: g.screen === 'end' };
      render();
    } else if (g.lan) {
      g.lan = { view: 'join', error: 'lost' };
      render();
    }
  }
};

/** Coupe le réseau sur ce téléphone (garde le code et le jeton pour pouvoir revenir). */
function netStop() {
  const tr = netTransport();
  if (!tr) return;
  try {
    tr.stop();
    if (tr.keepAwake) tr.keepAwake(false);
  } catch (e) {
    // le pont est déjà arrêté : rien à faire, l'essentiel est de pouvoir quitter
  }
}
/** Quitte complètement le multijoueur et revient à l'accueil. */
function netLeave() {
  netStop();
  net = { role: null };
  g.net = null;
  g.lan = null;
  g.absent = [];
  g.screen = 'home';
  g.inGame = false;
  g.modal = null;
  g.netLostInfo = null;
  render();
}
/**
 * Invité : nouvelle tentative après une coupure (même code, même jeton → même place).
 * La fenêtre reste ouverte (« recherche… ») avec « Quitter » toujours actif.
 */
function netRetry() {
  const { code, token } = net,
    tr = netTransport();
  netStop();
  net = { role: 'client', code, token, seat: null, lobby: [] };
  g.netLostInfo = { retrying: true };
  g.lan = g.net ? null : { view: 'joining', error: null };
  try {
    tr.joinStart(code);
  } catch (e) {
    g.netLostInfo = { failed: true };
  }
  render();
}

/* ---------- Écrans ---------- */

/** Écran « Partie Wi-Fi » : menu, salle d'attente de l'hôte, rejoindre, salle d'attente de l'invité. */
function lanScreen() {
  const v = (g.lan && g.lan.view) || 'menu',
    err = g.lan && g.lan.error ? `<p class="net-error">⚠️ ${t('netErr_' + g.lan.error)}</p>` : '';
  const players = list =>
    `<ul class="net-players">${list
      .map(
        p =>
          `<li><i class="player-dot" style="background:${colors[p.seat] || colors[0]}"></i><b>${esc(p.name)}</b>${p.seat === 0 ? `<small>${t('netHost')}</small>` : ''}${p.connected === false ? '<small>📵</small>' : ''}</li>`
      )
      .join('')}</ul>`;
  const nameField = `<label class="net-name">${t('netYourName')}<input id="netName" maxlength="14" value="${esc(g.myName || '')}" autocomplete="off"></label>`;
  let body;
  if (v === 'menu')
    body = `<p class="sub">${t('netIntro')}</p>${nameField}${err}<button class="bigbtn" id="netCreate">📶 ${t('netCreate')}</button><button class="bigbtn light" id="netGoJoin">🔑 ${t('netJoin')}</button><p class="sub small">${t('netSameWifi')}</p>`;
  else if (v === 'hostLobby')
    body = `<p class="sub">${t('netGiveCode')}</p><div class="net-code" dir="ltr">${net.code || '····'}</div><p class="sub small">${t('netLevelMode', { level: t({ junior: 'levelJunior', malin: 'levelMalin', expert: 'levelExpert', genius: 'levelGenius' }[g.level]), mode: t(g.gameMode === 'score' ? 'modeScore' : 'modeRace') })}</p>${players(net.lobby || [])}${err}<button class="bigbtn green" id="netLaunch" ${(net.lobby || []).filter(p => p.connected).length < 2 ? 'disabled' : ''}>▶ ${t('netLaunch')}</button><button class="bigbtn light" id="netCancel">${t('cancel')}</button>${net.address ? `<p class="sub small" dir="ltr">${net.address}</p>` : ''}`;
  else if (v === 'join' || v === 'joining')
    body = `${nameField}<label class="net-name">${t('netCodeLabel')}<input id="netCode" inputmode="numeric" maxlength="4" value="${esc(net.code || '')}" dir="ltr" autocomplete="off"></label>${err}${v === 'joining' ? `<p class="sub">⏳ ${t('netSearching')}</p>` : ''}<button class="bigbtn" id="netJoinGo" ${v === 'joining' ? 'disabled' : ''}>🔑 ${t('netJoinGo')}</button><button class="bigbtn light" id="netCancel">${t('cancel')}</button><p class="sub small">${t('netSameWifi')}</p>`;
  else
    body = `<p class="sub">✅ ${t('netConnected')}</p>${players(net.lobby || [])}<p class="sub">⏳ ${t('netWaitHost')}</p><button class="bigbtn light" id="netCancel">${t('netQuit')}</button>`;
  return `<header class="top">${brand()}<button class="mini-btn" id="netCancelTop">${g.lang === 'ar' ? '›' : '‹'} ${t('back')}</button></header><section class="panel net-panel"><h1 class="settings-title">📶 ${t('netTitle')}</h1>${body}</section>`;
}

/** Fenêtres réseau : attente d'un joueur déconnecté (partagée), connexion perdue (locale). */
function netModalView() {
  if (g.modal === 'netWait') {
    const name = pname(g.netWaitSeat),
      host = g.net && g.net.role === 'host';
    return `<h2>📵 ${t('netWaitTitle', { player: name })}</h2><p>${t('netWaitText')}</p>${
      host ? `<button class="bigbtn light" id="netWithout">${t('netWithout', { player: name })}</button>` : ''
    }`;
  }
  if (g.modal === 'netLost') {
    const info = g.netLostInfo || {},
      quit = `<button class="bigbtn light" id="netQuitGame">⌂ ${t('menuBack')}</button>`;
    if (info.host) return `<h2>📵 ${t('netHostLostTitle')}</h2><p>${t('netHostLostText')}</p>${quit}`;
    if (info.ended) return `<h2>👋 ${t('netEndedTitle')}</h2><p>${t('netEndedText')}</p>${quit}`;
    return `<h2>📵 ${t('netLostTitle')}</h2><p>${info.failed ? '⚠️ ' + t('netRetryFailed') : t('netLostText')}</p>${
      info.retrying
        ? `<p class="sub">⏳ ${t('netSearching')}</p>`
        : `<button class="bigbtn" id="netRetry">🔄 ${t('netRetry')}</button>`
    }${quit}`;
  }
  return '';
}

/** Fin de partie sur un téléphone invité : c'est l'hôte qui relance. */
const netEndNote = () =>
  g.net && g.net.role === 'client' && g.netAgainAsked
    ? `<p class="sub centered">⏳ ${t('netAgainSent')}</p>`
    : '';

/** « Au tour de … » dans la bulle du détective, sur les téléphones qui regardent. */
function netWatchBanner() {
  if (!g.net || myTurn() || g.screen !== 'game') return '';
  return `<b class="net-watch">⏳ ${t('netWatching', { player: pname(active()) })}</b>`;
}

/** Branche les boutons des écrans réseau (appelée par bind()). */
function bindNet(click) {
  const nameInput = document.getElementById('netName');
  if (nameInput)
    nameInput.addEventListener('input', () => {
      g.myName = nameInput.value;
    });
  const openLan = () => {
    g.modal = null;
    g.screen = 'lan';
    g.lan = { view: 'menu', error: null };
    render();
  };
  click('openLan', openLan); // accueil, « À plusieurs »
  click('openLanMore', openLan); // menu « Plus »
  click('netCreate', netCreate);
  click('netGoJoin', () => {
    g.lan = { view: 'join', error: null };
    render();
  });
  click('netJoinGo', () => netJoin((document.getElementById('netCode') || {}).value));
  const leave = () => netLeave();
  click('netCancel', leave);
  click('netCancelTop', leave);
  click('netQuitGame', leave);
  click('netLaunch', netLaunch);
  click('netWithout', netContinueWithout);
  click('netRetry', netRetry);
}
