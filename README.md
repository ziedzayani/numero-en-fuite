# Le Numéro en fuite — V6

Jeu familial de logique et de calcul mental (1 à 4 joueurs sur un seul téléphone).
Application Android native (WebView) qui fonctionne **entièrement hors ligne**, **sans aucune permission**.

## Contenu du projet

| Chemin | Rôle |
|---|---|
| `app/src/main/assets/index.html` | Le jeu complet (HTML/CSS/JS, 3 langues, détective violet, police Baloo intégrée) |
| `app/src/main/java/.../MainActivity.java` | Conteneur Android (WebView sécurisée, bouton Retour, Android 15) |
| `app/src/main/AndroidManifest.xml` | Manifeste (aucune permission, RTL, portrait) |
| `app/build.gradle` | compileSdk/targetSdk 35, minSdk 23 (Android 6+) |
| `gradlew`, `gradle/wrapper/` | Gradle Wrapper 8.11.1 : compilation reproductible |
| `.github/workflows/build-apk.yml` | Tests + compilation + vérification automatique de l'APK |
| `tests/game.test.cjs` | ~2 840 vérifications automatiques du jeu |
| `LICENCE-POLICE.txt` | Licence libre (SIL OFL 1.1) de la police Baloo Bhaijaan 2 |
| `web/Numero_en_Fuite_V6.html` | Version navigateur autonome |
| `web/PWA/` | Version web installable (à héberger en HTTPS) |

## Nouveautés V6

- Nouveau design « ciel bleu », police arrondie Baloo Bhaijaan 2 intégrée (lisible en français, anglais et arabe, sans Internet).
- **Chrono des calculs adapté à l'âge** : Petit (5–7 ans) 30 s, Moyen (8–10 ans) 25 s, Grand (11 ans et +) 20 s.
  Réglages : *Normal*, *Plus de temps* (×1,5) ou *Sans chrono*. Le chrono démarre à l'ouverture du calcul, se met en pause
  pendant les fenêtres et quand l'appli passe en arrière-plan. Temps écoulé : pas d'étoile, pas de pénalité, le joueur garde son tour.
- Écran « Passe le téléphone » entre les joueurs, bouton « Reprendre la partie », fenêtres de confirmation intégrées.
- Bouton Retour Android géré, affichage correct sur Android 15 (barres système), sons (désactivables).

## Obtenir l'APK avec GitHub Actions (sans rien installer)

1. Crée un dépôt GitHub (privé ou public) et envoie **le contenu de ce dossier à la racine** (on doit voir `app/`, `gradlew`, `.github/` à la racine).
   Le plus simple : sur la page du dépôt vide, « uploading an existing file », puis glisse tout le contenu du dossier.
   ⚠️ Le dossier `.github` est caché sur certains ordinateurs : vérifie qu'il a bien été envoyé.
   S'il manque, sur GitHub : *Add file › Create new file*, nomme-le `.github/workflows/build-apk.yml`
   et colle le contenu du fichier du même nom.
2. Onglet **Actions** → **Construire APK Android** → **Run workflow** (ou il démarre seul après l'envoi).
3. Après environ 10 minutes (coche verte), l'APK est publié automatiquement dans **Releases** :
   `https://github.com/<ton-compte>/<ton-dépôt>/releases/tag/apk-latest` → touche `NumeroEnFuite-V6-debug.apk`
   (lien utilisable directement depuis le téléphone, sans compte ni décompression).
4. Il est aussi disponible dans l'artefact **NumeroEnFuite-V6-APK-debug** de l'exécution (Actions).

Le workflow : lance les tests du jeu, compile avec Gradle et le SDK Android officiel, puis vérifie la signature
(`apksigner`), le manifeste (`aapt2`), l'alignement (`zipalign`) et la présence du jeu dans l'APK.
Si une étape échoue, aucun APK n'est publié.

## Compiler avec Android Studio

Ouvre le dossier contenant `settings.gradle`, attends la synchronisation Gradle, puis **Build › Build APK(s)**.
En ligne de commande : `./gradlew assembleDebug` → `app/build/outputs/apk/debug/app-debug.apk`.

## Installer sur le téléphone

1. **Désinstalle les anciennes versions** du jeu (une ancienne version signée avec une autre clé bloque l'installation).
2. Copie l'APK sur le téléphone et touche-le dans l'application *Fichiers*.
3. Android demande d'autoriser l'installation d'applications pour l'application *Fichiers* : accepte (c'est le réglage
   normal « Sources inconnues » pour toute application qui ne vient pas du Play Store).
4. Play Protect peut afficher « Application inconnue » / « Analyser l'application » : choisis **Analyser** ;
   l'application ne demande aucune permission. Ne désactive pas Play Protect.

L'APK debug s'installe sous le nom « Le Numéro en fuite » (identifiant `com.atelier.numeroenfuite.debug`).

## APK « release » signé avec ta propre clé (facultatif)

Une clé personnelle donne une identité stable à l'application (nécessaire pour publier plus tard sur le Play Store).

```bash
keytool -genkeypair -v -keystore numero.jks -alias numero -keyalg RSA -keysize 4096 -validity 10000
base64 -w0 numero.jks > numero.jks.b64     # sur macOS : base64 -i numero.jks
```

Dans le dépôt GitHub : *Settings › Secrets and variables › Actions*, crée `NEF_KEYSTORE_BASE64` (contenu du .b64),
`NEF_KEYSTORE_PASSWORD`, `NEF_KEY_ALIAS` (`numero`) et `NEF_KEY_PASSWORD`. Le workflow produira alors aussi
l'artefact **NumeroEnFuite-V6-APK-release**. Garde `numero.jks` et ses mots de passe en lieu sûr : ne les mets jamais dans le dépôt.

## Lancer les tests sur ton ordinateur

```bash
npm install --no-save playwright && npx playwright install chromium
node tests/game.test.cjs
```
