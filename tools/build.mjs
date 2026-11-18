#!/usr/bin/env node
/**
 * Assemble le jeu en UN seul fichier HTML autonome.
 *
 * Le jeu doit fonctionner hors ligne dans la WebView Android : aucune ressource
 * externe. Toutes les sources de src/ sont donc intégrées dans la page :
 *
 *   src/index.html           squelette de la page, avec deux marqueurs :
 *                              /* @inject styles *\/   →  src/styles/*.css (ordre alphabétique)
 *                              /* @inject scripts *\/  →  src/js/*.js      (ordre alphabétique)
 *   src/js/01-i18n.js        contient /* @inject dictionaries *\/ {} → src/i18n/{fr,en,ar}.json
 *   src/styles/00-fonts.css  référence fonts/*.woff2 → intégrées en data: URI (base64)
 *   src/js/00-constants.js   contient /* @inject version *\/ '' → versionName de app/build.gradle
 *   src/pwa/sw.js            service worker ; __VERSION__ remplacé par versionName
 *
 * Fichiers GÉNÉRÉS (versionnés pour que l'APK et la version web soient reproductibles,
 * mais à ne jamais modifier à la main) :
 *   app/src/main/assets/index.html   le jeu embarqué dans l'APK
 *   web/Numero_en_Fuite.html         le même fichier, à ouvrir dans un navigateur
 *   web/PWA/index.html + sw.js       version web installable (hors ligne)
 *
 * Utilisation :
 *   node tools/build.mjs           construit
 *   node tools/build.mjs --check   échoue si les fichiers générés ne sont pas à jour (CI)
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const LANGUAGES = ['fr', 'en', 'ar'];
const read = p => readFileSync(join(ROOT, p), 'utf8');
const listDir = (dir, ext) =>
  readdirSync(join(ROOT, dir))
    .filter(f => f.endsWith(ext))
    .sort();

/** Remplace exactement UNE occurrence de `marker` : un marqueur absent ou dupliqué arrête la construction. */
function inject(text, marker, content, where) {
  const parts = text.split(marker);
  if (parts.length !== 2)
    throw new Error(`${where}: le marqueur "${marker}" doit apparaître exactement une fois`);
  return parts[0] + content + parts[1];
}

/** versionName de app/build.gradle : source unique du numéro de version. */
function versionName() {
  const m = read('app/build.gradle').match(/versionName\s+'([^']+)'/);
  if (!m) throw new Error('versionName introuvable dans app/build.gradle');
  return m[1];
}

/** Charge les traductions et vérifie que les 3 langues ont exactement les mêmes clés, toutes non vides. */
function dictionaries() {
  const dicts = Object.fromEntries(LANGUAGES.map(l => [l, JSON.parse(read(`src/i18n/${l}.json`))]));
  const ref = Object.keys(dicts.fr).sort();
  for (const lang of LANGUAGES) {
    const keys = Object.keys(dicts[lang]).sort();
    const missing = ref.filter(k => !(k in dicts[lang]));
    const extra = keys.filter(k => !(k in dicts.fr));
    if (missing.length || extra.length)
      throw new Error(
        `i18n/${lang}.json: clés manquantes [${missing}], en trop [${extra}] par rapport à fr.json`
      );
    for (const [k, v] of Object.entries(dicts[lang]))
      if (typeof v !== 'string' || !v.trim()) throw new Error(`i18n/${lang}.json: "${k}" est vide`);
  }
  return dicts;
}

function styles() {
  return listDir('src/styles', '.css')
    .map(f => {
      let css = read(`src/styles/${f}`);
      css = css.replace(/url\(fonts\/([\w.-]+\.woff2)\)/g, (_, font) => {
        const b64 = readFileSync(join(SRC, 'assets/fonts', font)).toString('base64');
        return `url(data:font/woff2;base64,${b64})`;
      });
      return `/* ---- ${f} ---- */\n${css}`;
    })
    .join('\n');
}

function scripts() {
  const dicts = dictionaries();
  const body = listDir('src/js', '.js')
    .map(f => {
      let js = read(`src/js/${f}`);
      // « {} » garde le fichier source valide (lisible par l'éditeur, Prettier, ESLint).
      if (js.includes('/* @inject version */'))
        js = inject(js, "/* @inject version */ ''", JSON.stringify(versionName()), f);
      if (js.includes('/* @inject dictionaries */'))
        js = inject(js, '/* @inject dictionaries */ {}', JSON.stringify(dicts, null, 1), f);
      return `/* ---- ${f} ---- */\n${js}`;
    })
    .join('\n');
  if (body.includes('</script')) throw new Error('« </script » dans les sources casserait la page');
  // Une seule portée privée : rien ne fuit dans window, sauf l'API documentée window.__numero.
  return `(() => {\n'use strict';\n${body}\n})();`;
}

function buildGame() {
  let html = read('src/index.html');
  html = inject(html, '/* @inject styles */', styles(), 'src/index.html');
  html = inject(html, '/* @inject scripts */', scripts(), 'src/index.html');
  return html;
}

/** PWA : le même jeu + manifeste, icônes et service worker (enregistré seulement en HTTPS ou localhost). */
function buildPwa(html) {
  const head =
    '<link rel="manifest" href="manifest.webmanifest"><link rel="icon" href="icon-192.png">' +
    '<meta name="apple-mobile-web-app-capable" content="yes">' +
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n';
  const register =
    "<script>if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost'))" +
    "{navigator.serviceWorker.register('./sw.js').catch(()=>{});}</script>\n";
  return inject(inject(html, '<title>', head + '<title>', 'pwa'), '</body>', register + '</body>', 'pwa');
}

const game = buildGame();
const outputs = {
  'app/src/main/assets/index.html': game,
  'web/Numero_en_Fuite.html': game,
  'web/PWA/index.html': buildPwa(game),
  'web/PWA/sw.js': read('src/pwa/sw.js').replaceAll('__VERSION__', versionName())
};

if (process.argv.includes('--check')) {
  const stale = Object.entries(outputs).filter(
    ([p, content]) => !existsSync(join(ROOT, p)) || read(p) !== content
  );
  if (stale.length) {
    console.error(
      'Fichiers générés pas à jour (lancez « npm run build ») :\n  ' + stale.map(s => s[0]).join('\n  ')
    );
    process.exit(1);
  }
  console.log('Fichiers générés à jour.');
} else {
  for (const [p, content] of Object.entries(outputs)) writeFileSync(join(ROOT, p), content);
  console.log(
    `Construit v${versionName()} (${(game.length / 1024).toFixed(0)} KB):\n  ` +
      Object.keys(outputs).join('\n  ')
  );
}
