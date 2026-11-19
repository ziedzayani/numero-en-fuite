/*
 * Traductions : français, anglais, arabe, espagnol, italien, allemand, chinois (simplifié), japonais.
 * Source : src/i18n/<code>.json (une clé par ligne, facile à relire et à traduire).
 * tools/build.mjs les injecte ici et refuse de construire si une langue n'a pas
 * exactement les mêmes clés que fr.json.
 * Dans les textes, {nom} est remplacé (et échappé) par t('clé', { nom: valeur }).
 */
const dictionaries = /* @inject dictionaries */ {};
/** Langues proposées dans Réglages : [code, drapeau, nom dans la langue]. */
const LANGS = [
  ['fr', '🇫🇷', 'Français'],
  ['en', '🇬🇧', 'English'],
  ['es', '🇪🇸', 'Español'],
  ['it', '🇮🇹', 'Italiano'],
  ['de', '🇩🇪', 'Deutsch'],
  ['ar', '🇸🇦', 'العربية'],
  ['zh', '🇨🇳', '中文'],
  ['ja', '🇯🇵', '日本語']
];
/** Codes des langues disponibles. */
const LANG_CODES = LANGS.map(l => l[0]);
/**
 * Langue du téléphone au premier lancement (navigator.languages, ex. « es-MX » → es, « zh-Hans-CN » → zh).
 * Première langue reconnue de la liste ; sinon l'anglais. Un joueur existant garde sa langue sauvegardée.
 */
function deviceLang(list) {
  let prefs = list;
  if (!prefs) {
    try {
      prefs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
    } catch {
      prefs = [];
    }
  }
  for (const tag of prefs || []) {
    const base = String(tag || '')
      .toLowerCase()
      .split(/[-_]/)[0];
    if (LANG_CODES.includes(base)) return base;
  }
  return 'en';
}
