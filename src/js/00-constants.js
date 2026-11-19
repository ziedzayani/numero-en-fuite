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
const colors = ['#8c75ef', '#31be95', '#f2af5c', '#ef7ca8'];

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
const TURN_LIMITS = [0, 12, 20, 24, 24];
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

/** Version affichée dans les Réglages : versionName de app/build.gradle, injecté par tools/build.mjs. */
const APP_VERSION = /* @inject version */ '';
