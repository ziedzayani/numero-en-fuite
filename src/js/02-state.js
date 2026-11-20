/*
 * État du jeu et fonctions de base.
 *   - petits utilitaires (hasard, mélange, échappement HTML) ;
 *   - `g` : TOUT l'état (écran, joueurs, scores, numéro secret, chronos…), sauvegardé à chaque render() ;
 *   - t() : traduction ; pname() : nom d'un joueur ; sons Web Audio ; sauvegarde / reprise.
 */

/** Entier aléatoire de 0 à n − 1. */
const rnd = n => Math.floor(Math.random() * n);
/** Élément au hasard d'un tableau. */
const pick = xs => xs[rnd(xs.length)];
/** Copie mélangée (Fisher–Yates). */
const shuffle = xs => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
/** Ramène n dans 1…max en faisant le tour (max + 1 → 1, 0 → max). */
const wrap = (n, max) => ((n - 1 + max * 500) % max) + 1;
/** [1, 2, …, max] */
const all = max => Array.from({ length: max }, (_, i) => i + 1);
/** Échappe le texte avant de l'insérer dans du HTML (noms des joueurs, etc.). */
const esc = x =>
  String(x).replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
/** État d'une partie neuve. Les réglages sont recopiés par start(). */
const initial = () => ({
  seriesPref: 0, // V9.16 : 0 = une seule partie, 2 / 3 = « premier à 2 / 3 victoires »
  series: null,
  netReady: [], // Wi-Fi : joueurs prêts pour la revanche
  daily: null, // V9.21 : défi du jour (date « AAAA-MM-JJ ») ; dailyStep = n° du prochain tirage du jour
  dailyStep: 0,
  playerBoost: [false, false, false, false], // V9.21 : coup de pouce (1 filet de plus) par joueur
  duel: null, // V9.20 : Duel express (Wi-Fi) — manche, choix secrets, révélation
  duelElapsed: 0,
  prono: {}, // V9.19 Wi-Fi : pronostics secrets des spectateurs { siège: [numéros] }
  pronoHits: [],

  screen: 'home',
  settingsFrom: 'home',
  lang: deviceLang(), // premier lancement : langue du téléphone (puis la langue choisie est mémorisée)
  players: 1, // premier lancement : Solo (le dernier choix est ensuite mémorisé)
  level: 'junior',
  turn: 0,
  limit: 16,
  secret: 1,
  candidates: all(9),
  scores: [0],
  stars: [0],
  captures: 0,
  phase: 'choose',
  helpUsed: false,
  last: null,
  history: [],
  showHistory: false,
  showHints: false,
  shownIds: [],
  choices: [],
  math: null,
  rerolled: false,
  tab: 'question',
  sound: true,
  inGame: false,
  modal: null,
  timerMode: 'normal',
  mathElapsed: 0,
  mathStarted: false,
  turnElapsed: 0,
  sel: null,
  capturing: null,
  helpMode: null,
  reduceMotion: false,
  names: ['', '', '', ''],
  gameMode: 'race',
  chDiffPref: 'medium',
  placed: [], // Course : podium [{ player, round, turn }]
  myName: '', // Wi-Fi : prénom de ce téléphone (jamais celui reçu des autres)
  marks: [], // carnet « à la main » de chaque joueur (voir 08b-marks.js)
  net: null, // multijoueur Wi-Fi : { role: 'host' | 'client', seat }
  lan: null, // écran « Partie Wi-Fi » : { view, error }
  absent: [], // Wi-Fi : joueurs partis (tours sautés)
  starter: 0,
  playerHelp: [false, false, false, false],
  mode: 'normal',
  chKind: null,
  chElapsed: 0,
  answerElapsed: 0,
  typed: ''
});
/** L'état courant. Remplacé (pas modifié) par start() et load() : toujours lire `g`, jamais une copie. */
let g = initial();
/** Texte traduit dans la langue courante (repli sur l'anglais, puis le français, puis la clé). */
const t = (key, vars = {}) => {
  const value = dictionaries[g.lang]?.[key] || dictionaries.en?.[key] || dictionaries.fr[key] || key;
  return value.replace(/\{(\w+)\}/g, (_, k) => esc(vars[k] ?? ''));
};
/** Plus grand numéro de la partie en cours. */
const maxN = () => maxFor(g.mode, g.level);
/** Indice du joueur dont c'est le tour (le premier joueur change à chaque partie : g.starter). */
const active = () => (g.turn + (g.starter || 0)) % g.players;
/** Mode « Course » (et solo) : la première capture gagne. Sinon mode « Points » (score après N tours). */
const isRace = () => g.mode !== 'challenge' && (g.players === 1 || !['score', 'duel'].includes(g.gameMode));
/** Filets restants pour le joueur i (NETS_MAX par partie). */
const netsLeft = (i = active()) =>
  Array.isArray(g.netsLeft) && g.netsLeft[i] != null ? g.netsLeft[i] : NETS_MAX;
const netAvailable = () => netsLeft() > 0;
/** Nom affiché du joueur i (« Toi » en solo). */
const pname = i => (g.players === 1 ? t('you') : (g.names && g.names[i]) || t('player', { n: i + 1 }));
/** Symbole court d'un déplacement : nombre (±1, ±2) ou objet { op: '+' | '×' | '÷' | 'mirror', k }. */
const shiftSymbol = s => {
  if (!(typeof s === 'object' && s)) return s < 0 ? '⬅ ' + s : s > 0 ? '➡ +' + s : '⏸ 0';
  if (s.op === '+') return s.k < 0 ? '⬅ ' + s.k : '➡ +' + s.k;
  if (s.op === '±') return '↔ ±' + s.k; // sens caché (V8.18) : jamais le vrai sens
  if (s.op === '×' || s.op === '×m') return '✖️ ×' + s.k;
  if (s.op === '÷') return '➗ ÷' + s.k;
  if (s.op === 'seq') return s.steps.map(shiftSymbol).join(' · ');
  return '🪞';
};
/** Explication d'un déplacement spécial (double, moitié, miroir, sens caché…), vide pour un simple décalage. */
const moveHint = s => {
  if (!(typeof s === 'object' && s)) return '';
  if (s.op === '×') return t('mvDouble', { max: maxN() });
  if (s.op === '×m') return t('mvMulMod', { k: s.k, a: 60, b: (60 * s.k) % (maxN() + 1) });
  if (s.op === '÷') return t('mvHalf');
  if (s.op === '±') return t('mvHidden', { k: s.k });
  if (s.op === 'mirror') {
    // V9.4 : trois exemples, un par ligne (50 → 1, 49 → 2, 10 → 41 au niveau Génie)
    const m = maxN(),
      ex = (a, b) => `<span class="mv-ex" dir="ltr">${a} → ${b}</span>`;
    return `🪞 ${t('mvMirrorTitle')}${ex(m, 1)}${ex(m - 1, 2)}${ex(10, m + 1 - 10)}`;
  }
  if (s.op === 'seq') return t('mvDoubleJump'); // les deux symboles sont déjà sur l'étiquette
  return '';
};
/** Flèche dans le sens de lecture (RTL en arabe). */
const arrow = () => (g.lang === 'ar' ? '←' : '→');
/** Sauvegarde `g` (appelée à chaque render()). Les erreurs (stockage plein ou interdit) sont ignorées. */
function save() {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(g));
  } catch (e) {}
}
/* Sons générés localement (Web Audio) : aucun fichier, aucun réseau. */
let audio = null;
/** Joue un petit son synthétisé ('tap', 'win', 'bad', 'tick'…), si le son est activé. */
function sfx(kind) {
  if (!g.sound) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const seq =
      {
        tap: [[660, 0.05]],
        good: [
          [523, 0.09],
          [659, 0.09],
          [784, 0.16]
        ],
        bad: [
          [330, 0.12],
          [247, 0.2]
        ],
        move: [
          [440, 0.06],
          [554, 0.08]
        ],
        select: [[740, 0.04]],
        aim: [
          [880, 0.05],
          [1175, 0.08]
        ],
        net: [
          [392, 0.06],
          [523, 0.06],
          [659, 0.06],
          [784, 0.12]
        ],
        win: [
          [523, 0.1],
          [659, 0.1],
          [784, 0.1],
          [1047, 0.28]
        ]
      }[kind] || [];
    let at = audio.currentTime;
    for (const [f, d] of seq) {
      const o = audio.createOscillator(),
        v = audio.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      v.gain.setValueAtTime(0.0001, at);
      v.gain.exponentialRampToValueAtTime(0.18, at + 0.015);
      v.gain.exponentialRampToValueAtTime(0.0001, at + d);
      o.connect(v).connect(audio.destination);
      o.start(at);
      o.stop(at + d + 0.02);
      at += d * 0.9;
    }
  } catch (e) {}
}
/**
 * Reprend la partie sauvegardée. Toute valeur absente, ancienne ou incohérente est
 * corrigée ou ignorée : une sauvegarde abîmée ne doit jamais bloquer le jeu.
 */
function load() {
  try {
    let raw = localStorage.getItem(STORAGE);
    const legacy = !raw;
    if (legacy) raw = localStorage.getItem(OLD_STORAGE);
    const d = JSON.parse(raw);
    // Hors partie, le nombre de joueurs choisi à l'accueil peut différer des tableaux de la dernière
    // partie : on les remet à la bonne taille plutôt que de jeter toute la sauvegarde (langue, réglages…).
    if (
      d &&
      d.screen !== 'game' &&
      [1, 2, 3, 4].includes(d.players) &&
      Array.isArray(d.scores) &&
      Array.isArray(d.stars)
    ) {
      if (d.scores.length !== d.players) d.scores = Array(d.players).fill(0);
      if (d.stars.length !== d.players) d.stars = Array(d.players).fill(0);
    }
    if (
      !d ||
      !['home', 'game', 'end', 'settings', 'office', 'lan'].includes(d.screen) ||
      ![1, 2, 3, 4].includes(d.players) ||
      !(d.level in LEVELS) ||
      !LANG_CODES.includes(d.lang) ||
      !Array.isArray(d.scores) ||
      d.scores.length !== d.players ||
      !Array.isArray(d.candidates) ||
      !Array.isArray(d.choices) ||
      !Array.isArray(d.stars) ||
      d.stars.length !== d.players ||
      !Array.isArray(d.history)
    )
      return;
    if (!['choose', 'result'].includes(d.phase) || (d.phase === 'result' && !d.last)) d.phase = 'choose';
    const max = maxFor(d.mode, d.level);
    if (!(d.secret >= 1 && d.secret <= max) || !d.candidates.includes(d.secret))
      (d.candidates = all(max)), (d.secret = Math.min(Math.max(1, d.secret | 0), max));
    const base = initial();
    g = Object.assign(base, d);
    if (legacy && d.screen === 'game') g.inGame = true;
    if (['replay', 'replayAsk'].includes(g.modal)) g.modal = null;
    if (!['quit', 'handoff', 'pause', 'notebook', 'rules', 'names', 'challenge', null].includes(g.modal))
      g.modal = null;
    if (g.hunt && !Array.isArray(g.hunt.steps)) g.hunt = null;
    g.tut = null; // le tutoriel n'est jamais repris
    if (g.quitSeen) Object.assign(g, { quitSeen: false, screen: 'home', inGame: false, modal: null }); // film vu en quittant
    if (!Array.isArray(g.placed)) g.placed = [];
    // une connexion Wi-Fi ne survit pas à un redémarrage : retour à l'accueil
    if (g.net || g.screen === 'lan') {
      Object.assign(g, { net: null, lan: null, absent: [], screen: 'home', inGame: false, modal: null });
    }
    if (!['normal', 'challenge'].includes(g.mode)) g.mode = 'normal';
    if (g.mode === 'challenge' && !['timed', 'endless'].includes(g.chKind)) g.chKind = 'endless';
    if (!(g.chDiff in CHALLENGE_DIFFS)) g.chDiff = 'hard'; // parties de défi sauvegardées avant la V8.4
    if (!(g.chDiffPref in CHALLENGE_DIFFS)) g.chDiffPref = 'medium';
    g.chElapsed = Number(g.chElapsed) || 0;
    g.answerElapsed = Number(g.answerElapsed) || 0;
    g.typed = typeof g.typed === 'string' ? g.typed : '';
    if (g.screen === 'game' && !g.modal && g.phase === 'choose') g.modal = 'pause';
    g.turnElapsed = Number(g.turnElapsed) || 0;
    g.capturing = null;
    if (!(g.sel >= 1 && g.sel <= max)) g.sel = null;
    g.reduceMotion = !!g.reduceMotion;
    if (!['race', 'score', 'duel', 'teams'].includes(g.gameMode)) g.gameMode = 'race';
    if (!Array.isArray(g.netsLeft) || g.netsLeft.length !== g.players)
      g.netsLeft = Array(g.players).fill(NETS_MAX);
    g.starter = Number.isInteger(g.starter) ? g.starter : 0;
    g.playerHelp = Array.from({ length: 4 }, (_, i) => !!(Array.isArray(g.playerHelp) && g.playerHelp[i]));
    g.playerBoost = Array.from({ length: 4 }, (_, i) => !!(Array.isArray(g.playerBoost) && g.playerBoost[i]));
    if (g.daily && !/^\d{4}-\d{2}-\d{2}$/.test(g.daily)) g.daily = null;
    g.names = Array.from({ length: 4 }, (_, i) =>
      Array.isArray(g.names) && typeof g.names[i] === 'string' ? g.names[i].slice(0, 12) : ''
    );
    if (g.screen === 'home' && !['rules', 'names', 'challenge'].includes(g.modal)) g.modal = null;
    if (!['normal', 'long', 'off'].includes(g.timerMode)) g.timerMode = 'normal';
    g.mathElapsed = Number(g.mathElapsed) || 0;
    // V9.16 : séries (anciennes sauvegardes : aucune série)
    if (![0, 2, 3].includes(g.seriesPref)) g.seriesPref = 0;
    const s = g.series;
    if (
      !s ||
      typeof s !== 'object' ||
      ![2, 3].includes(s.target) ||
      !Array.isArray(s.wins) ||
      s.wins.length !== g.players ||
      g.players < 2
    )
      g.series = null;
    g.netReady = [];
  } catch (e) {}
}
