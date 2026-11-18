/*
 * Traductions français / anglais / arabe.
 * Source : src/i18n/{fr,en,ar}.json (une clé par ligne, facile à relire et à traduire).
 * tools/build.mjs les injecte ici et refuse de construire si une langue n'a pas
 * exactement les mêmes clés que fr.json.
 * Dans les textes, {nom} est remplacé (et échappé) par t('clé', { nom: valeur }).
 */
const dictionaries = /* @inject dictionaries */ {};
