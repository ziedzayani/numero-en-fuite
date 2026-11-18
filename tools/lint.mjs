#!/usr/bin/env node
/**
 * Analyse statique (ESLint) du script du jeu.
 * Les fichiers src/js/*.js partagent une seule portée (ils sont concaténés par
 * tools/build.mjs) : on analyse donc le script ASSEMBLÉ, extrait de la page générée,
 * puis on renvoie chaque problème vers son fichier source d'origine.
 */
import { ESLint } from 'eslint';
import globals from 'globals';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../app/src/main/assets/index.html', import.meta.url), 'utf8');
const script = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));
const lines = script.split('\n');

// Repère « /* ---- fichier.js ---- */ » laissé par build.mjs pour retrouver la source.
const origin = line => {
  for (let i = line - 1; i >= 0; i--) {
    const m = lines[i].match(/^\/\* ---- ([\w.-]+) ---- \*\/$/);
    if (m) return `src/js/${m[1]}:${line - i - 1}`;
  }
  return `script:${line}`;
};

const eslint = new ESLint({
  overrideConfigFile: true,
  overrideConfig: {
    languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: { ...globals.browser } },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      'no-redeclare': 'error',
      'no-dupe-keys': 'error',
      'no-unreachable': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-self-assign': 'error',
      'no-shadow': 'warn',
      eqeqeq: ['warn', 'smart'],
      'prefer-const': 'warn'
    }
  }
});
const [result] = await eslint.lintText(script);
for (const m of result.messages)
  console.log(`${m.severity === 2 ? 'erreur ' : 'avert. '} ${origin(m.line)}  ${m.message}  (${m.ruleId})`);
console.log(`${result.errorCount} erreur(s), ${result.warningCount} avertissement(s)`);
process.exit(result.errorCount ? 1 : 0);
