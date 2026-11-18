# Le Numéro en fuite

Jeu familial de logique et de calcul mental (1 à 4 joueurs sur un seul téléphone, en français, anglais et arabe).
Application Android (WebView) qui fonctionne **entièrement hors ligne**. Multijoueur sur **un seul téléphone** ou
**un téléphone chacun** sur le même Wi-Fi ([docs/MULTIJOUEUR.md](docs/MULTIJOUEUR.md)) — sans Internet ni serveur.

- Nouveautés : [CHANGELOG.md](CHANGELOG.md)
- Fonctionnement du code, conventions, comment ajouter une langue / une question / un niveau :
  [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Télécharger l'APK

Dernière version, compilée et vérifiée automatiquement :
**Releases › [apk-latest](../../releases/tag/apk-latest) › `NumeroEnFuite.apk`** (lien utilisable depuis le téléphone).

## Contenu du projet

| Chemin | Rôle |
|---|---|
| `src/` | **Sources du jeu** (à modifier) : `js/` logique et écrans, `styles/` CSS, `i18n/` traductions, `assets/fonts/` police |
| `tools/build.mjs` | Assemble `src/` en un seul fichier HTML autonome (hors ligne) |
| `tools/lint.mjs` | Analyse statique ESLint du script assemblé |
| `tools/layout-audit.cjs` | Audit de mise en page : aucun défilement, aucun bouton collé (3 tailles × 3 langues) |
| `app/src/main/assets/index.html` | Jeu **généré** embarqué dans l'APK (ne pas modifier à la main) |
| `app/src/main/java/.../MainActivity.java` | Conteneur Android (WebView sécurisée, bouton Retour, Android 15) |
| `app/src/main/AndroidManifest.xml` | Manifeste (autorisations réseau local normales, RTL, portrait) |
| `app/src/main/java/.../NetBridge.java` | Transport du multijoueur Wi-Fi local (TCP + annonce NSD), exposé au jeu |
| `app/build.gradle` | compileSdk/targetSdk 35, minSdk 23 (Android 6+), **version du jeu** |
| `gradlew`, `gradle/wrapper/` | Gradle Wrapper 8.11.1 : compilation reproductible |
| `.github/workflows/build-apk.yml` | Vérifications + tests + compilation + vérification + publication de l'APK |
| `tests/game.test.cjs` | ~4 200 vérifications automatiques du jeu dans Chromium |
| `web/Numero_en_Fuite.html` | Version navigateur autonome (générée) |
| `web/PWA/` | Version web installable, à héberger en HTTPS (`index.html` et `sw.js` générés) |
| `LICENCE-POLICE.txt` | Licence libre (SIL OFL 1.1) de la police Baloo Bhaijaan 2 |

## Modifier le jeu

Prérequis : Node.js 20 ou plus.

```bash
npm ci                          # installe les outils (versions figées)
# … modifier les fichiers de src/ …
npm run build                   # régénère index.html, la version web et la PWA
npm run check                   # fichiers générés à jour + ESLint + format (comme la CI)
npx playwright install chromium # une seule fois
npm test                        # tests complets (~10 min)
npm run audit:layout            # aucun défilement / bouton collé sur 3 tailles de téléphone
```

`npm run format` remet le code au format standard (Prettier). Ne jamais modifier les fichiers générés :
la CI refuse un commit où ils ne correspondent pas aux sources.

Nouvelle version : incrémenter `versionCode` et `versionName` dans `app/build.gradle`, puis `npm run build`
(le cache de la PWA change automatiquement), et ajouter une section dans `CHANGELOG.md`.

## Compilation automatique (GitHub Actions)

À chaque envoi sur `main`, le workflow :

1. vérifie que les fichiers générés correspondent à `src/`, le format et l'analyse ESLint ;
2. lance les tests du jeu (1 à 4 joueurs, 4 niveaux, 3 langues, défi, film, sauvegarde) ;
3. compile l'**APK release** avec Gradle et le SDK Android officiel ;
4. vérifie la signature (`apksigner`), le manifeste (`aapt2`, dont « non débogable »), l'alignement (`zipalign`)
   et la présence du jeu, puis publie l'APK dans **Releases › apk-latest**.

Si une étape échoue, aucun APK n'est publié.

En local : `./gradlew assembleRelease` (avec les variables de la section « Clé de signature »)
→ `app/build/outputs/apk/release/app-release.apk`. Android Studio : ouvrir le dossier contenant `settings.gradle`.

## Installer sur le téléphone

1. Si une ancienne version est installée et que l'installation est refusée, **désinstalle-la** d'abord
   (voir « Clé de signature » ; l'ancienne version de test s'appelait `com.atelier.numeroenfuite.debug`).
2. Télécharge `NumeroEnFuite.apk` et touche-le dans l'application *Fichiers*.
3. Android demande d'autoriser l'installation d'applications pour *Fichiers* : accepte (réglage normal
   « Sources inconnues » pour toute application qui ne vient pas du Play Store).
4. Play Protect peut afficher « Application inconnue » / « Analyser l'application » : choisis **Analyser** ;
   l'application ne demande aucune autorisation à l'écran (seulement l'accès au réseau local, accordé d'office).
   Ne désactive pas Play Protect.

## Clé de signature (recommandé)

Android n'accepte une mise à jour que si elle est signée avec la **même clé** que la version installée.
Sans clé permanente, la CI signe chaque APK avec une clé temporaire : il faut alors désinstaller le jeu
avant chaque mise à jour (la partie sauvegardée et les records sont perdus).

Une clé permanente a été générée pour le projet (empreinte SHA-256
`76:75:16:2D:B8:85:BA:8F:C9:F2:2D:29:7D:62:9E:41:7C:56:4B:E7:15:B7:77:51:22:FC:A5:A5:6A:B3:C8:22`) ; cette empreinte
est inscrite dans le workflow (`EXPECTED_CERT_SHA256`) : avec les secrets en place, la CI refuse de publier un APK
signé par une autre clé. Pour utiliser une autre clé, la créer ainsi puis mettre à jour cette empreinte :

```bash
keytool -genkeypair -v -keystore numero.jks -storetype PKCS12 -alias numero -keyalg RSA -keysize 4096 -validity 10000
base64 -w0 numero.jks > numero.jks.b64     # sur macOS : base64 -i numero.jks -o numero.jks.b64
```

Puis dans le dépôt GitHub : *Settings › Secrets and variables › Actions › New repository secret* :
`NEF_KEYSTORE_BASE64` (contenu du `.b64`), `NEF_KEYSTORE_PASSWORD`, `NEF_KEY_ALIAS` (`numero`), `NEF_KEY_PASSWORD`
(identique au mot de passe du keystore pour PKCS12).
Garde `numero.jks` et son mot de passe en lieu sûr, **jamais dans le dépôt** (`*.jks` est ignoré par git) :
sans eux, plus aucune mise à jour ne pourra remplacer l'application installée.
