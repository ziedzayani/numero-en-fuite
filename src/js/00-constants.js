/*
 * Constantes du jeu : règles chiffrées, stockage, couleurs.
 *
 * Organisation du code (les fichiers src/js/*.js sont concaténés dans cet ordre,
 * dans UNE seule portée privée, par tools/build.mjs) :
 *   00 constantes et règles      08 déplacements du numéro + journal de la chasse
 *   01 traductions (générées)    09 actions du joueur (question, calcul, capture, tour suivant)
 *   02 état `g`, utilitaires,    10 détective animé, confettis
 *      sons, sauvegarde          11 écrans (accueil, bureau, réglages, jeu, résultat, fins)
 *   03 questions (indices)       12 film du parcours du numéro
 *   04 calculs                   13 fenêtres (pause, carnet, noms, défi…)
 *   05 défi solo, start()        14 tutoriel scripté
 *   06 carrière solo (score, XP) 15 multijoueur Wi-Fi (hôte arbitre, copies sans secret)
 *   07 chronos                   16 render() + bind() : affichage et événements
 *                                17 bouton Retour Android, démarrage, API de test
 *
 * Principe : tout l'état vit dans l'objet `g` (sauvegardé dans localStorage).
 * Chaque action modifie `g` puis appelle render(), qui reconstruit l'écran.
 */

/** Racine de l'interface : render() y écrit tout le HTML. */
const app = document.getElementById('app');

/** Clés localStorage : partie en cours (V6+), ancienne partie V5 (reprise), records. */
const STORAGE = 'numeroEnFuiteV6',
  OLD_STORAGE = 'numeroEnFuiteV5',
  RECORDS_STORAGE = 'numeroEnFuiteRecords';

/** Couleur de chaque joueur (1 à 4). */
const colors = ['#8c75ef', '#31be95', '#f2af5c', '#ff9f43'];

/**
 * Niveaux : numéros de 1 à `max` ; le filet couvre `netSize` numéros voisins.
 * (Petit 5–7 ans, Moyen 8–10 ans, Grand 11 ans et +, Génie : déplacements ±3/±5/×2/miroir.)
 */
const LEVELS = {
  junior: { max: 9, netSize: 2 },
  malin: { max: 15, netSize: 3 },
  expert: { max: 30, netSize: 3 },
  genius: { max: 50, netSize: 3 }
};
/** Le défi solo se joue toujours de 1 à 100. */
const CHALLENGE_MAX = 100;
/** Plus grand numéro possible pour un mode ('normal' | 'challenge') et un niveau. */
/** Nombre de tours d'une partie selon le nombre de joueurs (solo : 12 ; à 2 : 10 essais chacun). */
const TURN_LIMITS = [0, 12, 30, 24, 24]; // V9.4 : 30 tours à 2 joueurs (15 chacun)
const maxFor = (mode, level) => (mode === 'challenge' ? CHALLENGE_MAX : (LEVELS[level] || LEVELS.expert).max);

/**
 * Points (mode « Points » ; en mode « Course » la première capture gagne la partie).
 *   precise         numéro exact attrapé
 *   net             numéro attrapé avec le filet
 *   miss            par numéro raté (1 en tir précis, 2 ou 3 avec le filet)
 *   deductionBonus  capture juste après avoir posé une question
 */
const SCORE = { precise: 10, net: 4, miss: -1, deductionBonus: 1 };

/** Nombre de filets par joueur et par partie (tous les modes). */
const NETS_MAX = 3;

/**
 * Score du défi solo. Règle de conception : prolonger la partie ne doit JAMAIS rapporter.
 * Un tour de plus coûte au moins perTurn + miss = 65 points, alors qu'un calcul juste rapporte
 * au plus goodMath + timeRefund × perSecond = 10 + 30 = 40 points. Le combo est seulement visuel.
 */
const CHALLENGE_SCORE = {
  start: 1000,
  perTurn: 45, // par tour après le premier
  question: 5,
  wrongMath: 10,
  goodMath: 10,
  miss: 20, // capture précise ratée
  netMiss: 40,
  netWin: 50, // victoire au filet (moins méritoire qu'une capture précise)
  perSecond: 2, // par seconde restante, contre la montre
  timeRefundMs: 8000 // calcul juste en contre la montre (V8.18 : 8 s au lieu de 15, sinon calculer ne coûtait presque rien)
};
/** Difficultés du défi → niveau utilisé pour les calculs, les questions et le filet (numéros toujours 1–100). */
const CHALLENGE_DIFFS = { easy: 'junior', medium: 'malin', hard: 'expert' };

/*
 * V9.24 : les Défis comptent dans la carrière (même XP, mêmes rangs que le Solo classique).
 * win / loss : XP de base ; recordBonus : nouveau record de la variante ; excellent : score « de base »
 * (avant les bonus de fin) ≥ CH_EXCELLENT_SCORE ; timed : bonus d'un Défi chronométré gagné.
 * Le Difficile rapporte le plus. Anti-abus du Facile : seuls CH_EASY_XP_PER_DAY Défis Faciles par jour
 * rapportent de l'XP (les records, statistiques, badges et missions comptent toujours).
 */
const CHALLENGE_XP = {
  easy: { win: 6, loss: 1, recordBonus: 3, excellent: 2, timed: 1 },
  medium: { win: 15, loss: 2, recordBonus: 8, excellent: 5, timed: 3 },
  hard: { win: 25, loss: 4, recordBonus: 12, excellent: 8, timed: 5 }
};
const CH_EXCELLENT_SCORE = 800;
const CH_EASY_XP_PER_DAY = 5;
/** Badge « Défis gagnés » : victoires pour les paliers 🥉 🥈 🥇 💎. */
const CH_WINS_TIERS = [5, 15, 30, 50];
/**
 * V9.24 : Défi chronométré — courte pause de lecture après chaque résultat (et dans les fenêtres
 * d'information) ; au-delà, le chrono repart tout seul. La fenêtre Pause et l'arrière-plan arrêtent
 * toujours le chrono. Le Défi sans limite n'est pas concerné.
 */
const CH_READ_PAUSE_MS = 5000;
/** Fenêtres qui comptent comme « lecture » (pause limitée) en Défi chronométré ; les autres arrêtent le chrono. */
const CH_READ_MODALS = ['notebook'];
/**
 * V9.26 : questions adaptées à la plage (1–9, 1–15, 1–30, 1–50, 1–100). Sur la plage entière, une
 * question proposable doit laisser au moins QUESTION_MIN_SIDE × max numéros de CHAQUE côté (au moins 1) :
 * « ajoute 3, dépasse-t-il 4 ? » (un seul NON possible sur 1–50) n'est plus proposée.
 * Les anciennes questions restent connues (historique, carnet) : seule la proposition change.
 */
const QUESTION_MIN_SIDE = 0.12;
/** V9.24 : historique du Défi du jour affiché (jours). */
const DAILY_HISTORY_DAYS = 30;

/** Version affichée dans les Réglages : versionName de app/build.gradle, injecté par tools/build.mjs. */
const APP_VERSION = /* @inject version */ '';
