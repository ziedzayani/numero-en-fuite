/*
 * V9.21 : DÉFI DU JOUR — le même numéro de départ et les mêmes sauts pour tout le monde ce jour-là,
 * sans Internet ni serveur : tout est tiré à partir de la date (« 2026-11-20 »). Toute la famille peut
 * comparer au dîner. Niveau Moyen (1–15), solo, 12 tours. Seul le premier essai du jour compte ;
 * les suivants sont des entraînements. Résultats dans une clé à part : numeroEnFuiteDailyV1.
 */
const DAILY_STORAGE = 'numeroEnFuiteDailyV1';
const DAILY_LEVEL = 'malin';

function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** Empreinte stable d'un texte (FNV-1a 32 bits). */
function hashStr(s) {
  let h = 2166136261;
  for (const c of String(s)) {
    h ^= c.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
/** Générateur pseudo-aléatoire reproductible (mulberry32). */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
/** k-ième tirage du jour : identique sur tous les téléphones, quel que soit l'ordre des actions. */
function dailyRnd(n) {
  const r = seeded(hashStr(g.daily + '#' + (g.dailyStep || 0)))();
  g.dailyStep = (g.dailyStep || 0) + 1;
  return Math.floor(r * n);
}
/** Numéro de départ du jour. */
const dailySecret = (day, max) => 1 + Math.floor(seeded(hashStr(day))() * max);

function loadDaily() {
  try {
    const d = JSON.parse(localStorage.getItem(DAILY_STORAGE));
    if (d && typeof d === 'object') return d;
  } catch (e) {
    // illisible : on repart de zéro
  }
  return {};
}
/** Fin d'une partie du jour : le premier essai devient le résultat officiel du jour. */
function dailyRecord(won) {
  if (!g.daily || g.dailyRecorded === g.gameId) return;
  g.dailyRecorded = g.gameId;
  const d = loadDaily(),
    day = d[g.daily];
  if (day) {
    day.tries = (day.tries || 1) + 1;
    g.dailyOfficial = false;
  } else {
    d[g.daily] = { won: !!won, turns: won ? g.soloTurns : null, secret: g.soloSecret || null, tries: 1 };
    g.dailyOfficial = true;
  }
  // on garde les 60 derniers jours
  const keep = Object.keys(d).sort().slice(-60);
  const out = Object.fromEntries(keep.map(k => [k, d[k]]));
  try {
    localStorage.setItem(DAILY_STORAGE, JSON.stringify(out));
  } catch (e) {
    // stockage plein : pas d'enregistrement
  }
}
/** Lance le défi du jour (depuis la fenêtre « Défi solo »). */
function startDaily() {
  g.players = 1;
  g.level = DAILY_LEVEL;
  g.gameMode = 'race';
  g.modal = null;
  g.dailyStart = todayKey();
  start(true);
}
/** Sous-titre du bouton : déjà joué aujourd'hui ? */
function dailySub() {
  const day = loadDaily()[todayKey()];
  if (!day) return t('dailySub');
  return day.won ? t('dailyDoneWin', { n: day.turns }) : t('dailyDoneLose');
}
/** Bandeau de l'écran de fin solo pour une partie du jour. */
function dailyBanner() {
  if (!g.daily) return '';
  const day = loadDaily()[g.daily] || {};
  const [y, m, d] = g.daily.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString(g.lang, {
    day: 'numeric',
    month: 'long'
  });
  const res = day.won ? t('dailyDoneWin', { n: day.turns }) : t('dailyDoneLose');
  return `<div class="daily-banner"><b>📅 ${t('dailyTitle')} · ${esc(date)}</b><span>${g.dailyOfficial === false ? t('dailyPractice', { res }) : t('dailyCompare')}</span></div>`;
}
