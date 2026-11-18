# Architecture du code

## Vue d'ensemble

```
src/ (sources)  ──npm run build──▶  app/src/main/assets/index.html  ──Gradle──▶  APK release
                                    web/Numero_en_Fuite.html, web/PWA/
```

Le jeu est une page HTML **autonome** (aucune ressource externe, aucun réseau) chargée par une WebView Android
(`MainActivity.java`). Pour rester lisible, il est écrit dans plusieurs fichiers sous `src/` que
`tools/build.mjs` assemble en un seul fichier :

| Source | Contenu |
|---|---|
| `src/index.html` | Squelette de la page (marqueurs `@inject styles` / `@inject scripts`) |
| `src/styles/NN-*.css` | Feuilles de style, **dans l'ordre** des numéros (l'ordre compte pour la cascade CSS) |
| `src/js/NN-*.js` | Script du jeu, concaténé dans l'ordre et enfermé dans **une seule** fonction `(() => { 'use strict'; … })()` |
| `src/i18n/{fr,en,ar}.json` | Textes traduits, injectés dans `01-i18n.js` |
| `src/assets/fonts/*.woff2` | Police Baloo Bhaijaan 2 (latin + arabe), intégrée en base64 |
| `src/pwa/sw.js` | Service worker de la PWA (`__VERSION__` = `versionName` de `app/build.gradle`) |

Les fichiers `src/js/*.js` partagent la même portée : une fonction de `08-actions.js` peut appeler `render()` de
`13-render.js` sans import. C'est voulu (pas de bundler, pas de dépendance d'exécution) ; ESLint (`npm run lint`)
analyse le script **assemblé** et signale les variables non définies ou inutilisées, en indiquant le fichier source.

## Modules JavaScript

| Fichier | Rôle |
|---|---|
| `00-constants.js` | Règles chiffrées : `LEVELS` (numéros max, taille du filet), `SCORE`, `NETS_MAX`, clés de stockage |
| `01-i18n.js` | `dictionaries` (généré à partir de `src/i18n/`) |
| `02-state.js` | État `g`, `t()` (traduction), utilitaires, sons Web Audio, `save()` / `load()` |
| `03-questions.js` | Questions-indices, choix de 3 questions utiles par tour |
| `04-math.js` | Calculs adaptés à l'âge, `prepareTurn()` |
| `05-challenge.js` | Défi solo (score, records) et `start()` (nouvelle partie) |
| `06-timers.js` | Chronos global / réponse / calcul / défi, `tick()` toutes les 200 ms |
| `07-moves.js` | Déplacements du numéro (jamais nuls), parcours pour le film |
| `08-actions.js` | Actions du joueur : `ask`, `mathAnswer`, `guess`, `netCapture`, `nextTurn` |
| `09-view-mascot.js` | Détective animé, confettis |
| `10-view-screens.js` | Écrans : accueil, réglages, jeu, résultat, fins de partie |
| `11-replay.js` | Film du parcours du numéro |
| `12-modals.js` | Fenêtres : règles, noms et mode, pause, carnet, quitter, « passe le téléphone » |
| `13-render.js` | `render()` (redessine tout) et `bind()` (branche les clics) |
| `14-boot.js` | Bouton Retour Android `back()`, démarrage, API `window.__numero` |

## Flux de données

```
clic ──▶ bind() ──▶ action (ask / guess / netCapture / nextTurn…) ──▶ modifie g ──▶ render()
                                                                                  ├─ écran = f(g) (HTML)
                                                                                  ├─ bind()
                                                                                  └─ save() → localStorage
```

- **Un seul état** : l'objet `g` (écran, joueurs, scores, numéro secret, candidats, chronos, fenêtre ouverte…).
  `start()` et `load()` le **remplacent** : toujours lire `g`, ne jamais garder une copie.
- **Les vues sont pures** : `home()`, `game()`, `resultView()`… renvoient du HTML à partir de `g` sans le modifier.
- **Les actions vérifient leurs préconditions** (écran, phase, aide déjà utilisée, filets restants) : un double
  appui ou un appel direct hors contexte ne fait rien.
- `g.last` décrit le dernier coup (`question`, `math`, `found`, `wrong`, `netHit`, `netMiss`, `timeout`) ;
  `pushHist()` l'ajoute au carnet (`g.history`) et au parcours du numéro (`g.hunt` → `g.lastHunt` pour le film).
- **Le carnet est toujours exact** : chaque déplacement est appliqué au secret ET à tous les candidats
  (`applyMove`, `applyShift`) ; les tests le vérifient en reconstruisant le carnet indépendamment.

## Conventions

- Texte affiché : toujours `t('clé', { variable })`. Les variables sont échappées ; les noms des joueurs passent par `esc()`.
- Nombres et opérations dans une phrase arabe : `<bdi dir="ltr">…</bdi>` pour garder « 12 + 3 » dans le bon sens.
- Chiffres de règles : dans `00-constants.js` (ou `LIMITS` pour les chronos), pas en dur dans les écrans.
- Format : Prettier (`npm run format`) ; commentaires et documentation en français.
- Fichiers générés : jamais modifiés à la main (`npm run check` le vérifie).

## Recettes

**Modifier un texte / ajouter une langue.** Modifier la clé dans les trois fichiers `src/i18n/*.json`. Pour une
nouvelle langue : nouveau fichier JSON avec **toutes** les clés de `fr.json` (le build refuse sinon), l'ajouter à
`LANGUAGES` dans `tools/build.mjs`, au choix de langue de `settings()` et à la validation de `load()`.

**Ajouter une question.** Dans `qpool()` (`03-questions.js`) : `add(id, typeKey, icône, texteKey, valeurs, test)`.
L'identifiant doit être stable (il est sauvegardé dans le carnet) et le texte présent dans les 3 langues.

**Ajouter un niveau.** `LEVELS` (`00-constants.js`), `LIMITS` (`06-timers.js`), le choix de niveau dans `home()`,
les textes `level…` / `age…`, et si besoin les branches de `makeMath()`, `qpool()` et `nextMove()`.

**Changer les points.** `SCORE` dans `00-constants.js` ; mettre à jour la règle affichée (`rule3`, `modeScoreSub`…)
dans les 3 langues et les tests qui vérifient les scores.

## Tests

`tests/game.test.cjs` pilote le jeu dans Chromium (Playwright) via l'interface et l'API `window.__numero` :
parties complètes de 1 à 4 joueurs à tous les niveaux et dans les 3 langues, 450 parties simulées (questions toujours
utiles, carnet exact), chronos et pause, défi, film, sauvegarde et reprise, bouton Retour, affichage sur petits
écrans (captures d'écran dans `test-screenshots/`).

## Application Android

`MainActivity` crée une WebView sans accès aux fichiers ni au réseau, n'autorise que `file:///android_asset/`,
gère l'affichage bord à bord (Android 15) et transmet le bouton Retour à `window.__numero.back()`.
L'APK distribué est la variante **release** (non débogable) ; la signature est décrite dans le README.
