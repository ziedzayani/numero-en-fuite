# Le Numéro en fuite — V7

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
| `tests/game.test.cjs` | ~4 230 vérifications automatiques du jeu |
| `LICENCE-POLICE.txt` | Licence libre (SIL OFL 1.1) de la police Baloo Bhaijaan 2 |
| `web/Numero_en_Fuite_V7.html` | Version navigateur autonome |
| `web/PWA/` | Version web installable (à héberger en HTTPS) |

## Nouveautés V7

- **Deux façons de capturer** : touche un numéro, puis 🎯 *Capture précise* (+10 / −1) ou 🕸️ *Filet magique*
  (+2, ou −1 par numéro si le filet est vide : −2 au niveau Petit, −3 ailleurs) sur 2 numéros voisins au niveau Petit (1–9)
  et 3 aux autres niveaux, toujours dans les limites du niveau.
  Une seule capture par tour, animations différentes (cible / filet).
- **Mon carnet 📓** : questions, réponses, calculs, déplacements, numéros éliminés et numéros encore possibles,
  recalculés à chaque déplacement. Aide *Désactivée* par défaut, ou *Automatique* / *Sur demande* (Réglages).
- **Détective vivant** : réfléchit, cherche avec sa loupe, vise, marche ou saute quand le numéro bouge, danse quand
  on gagne, grimace quand on rate ; expressions joyeuse, surprise, inquiète, curieuse, fière ; bulles amusantes FR/EN/AR.
- **Interface** : boutons qui s'enfoncent, transitions d'écran, badges « +5 / −1 » sur les scores, pluie de confettis
  à la victoire, chiffres plus lisibles, nouveaux sons, option « Réduire les animations ».

## V7.4

- Badge du niveau en haut à gauche (ex. 🧠 1–15) à la place du logo « 9? ».
- Onglet 💡 Indice ; avantages et inconvénients expliqués en 3 lignes courtes (« Attrape-le juste après : +10 +1 bonus »).
- Les étoiles ⭐ (gagnées avec les calculs) valent **+1 point chacune à la fin de la partie** ; le classement final
  affiche « points + étoiles ».

## V7.2

- Plus d'aide automatique par défaut (pas de numéros en vert, jamais « il ne reste qu'un numéro ») : le filet suffit.
  L'aide reste activable dans Réglages › Aide du carnet.
- Pour encourager les questions : avantages / inconvénients affichés pour Indice, Calcul et Deviner, et
  **+1 bonus déduction** quand on attrape le numéro juste après avoir posé une question (précise +11, filet +3).
- Capture précise réussie : **+10** (puis un nouveau numéro se cache). Le chrono du numéro ne démarre qu'à l'ouverture de « Deviner ».
- Effets : une loupe vient grossir le numéro au moment de la capture, grosse loupe sur le numéro attrapé,
  logo « 9? » qui réfléchit pendant un calcul et fête les captures.

## Correctifs V7.1

- Plus de clignotement de l'écran à chaque appui (Réglages et partie).
- Niveau Grand : calculs mélangés avec priorités (ex. 7 × 6 − 36 ÷ 4, (3 + 5) × 7 − 9), 6 propositions, 45 s.
- Prénoms des joueurs en multijoueur ; « Tour suivant » en solo.
- Quitter une partie la termine (confirmation demandée) ; l'accueil tient sur un seul écran.

## Nouveautés V6

- Nouveau design « ciel bleu », police arrondie Baloo Bhaijaan 2 intégrée (lisible en français, anglais et arabe, sans Internet).
- **Écran de jeu sur une seule page** (sans défilement) : barre compacte (tour, progression, carnet 📒, pause ⏸),
  scores, détective + bulle, onglets Indice / Calcul / Deviner.
- **Chronos adaptés à l'âge** — Petit (5–7 ans) : 30 s par calcul, 40 s pour choisir un numéro ; Moyen (8–10 ans) : 30 s / 35 s ;
  Grand (11 ans et +) : 25 s / 30 s. Calcul hors temps : pas d'étoile, le joueur garde son tour. Numéro non choisi à temps :
  tour perdu (0 point). Réglages : *Normal*, *Plus de temps* (×1,5), *Sans chrono*. Le bouton ⏸ (et le bouton Retour)
  met tout en pause ; l'appli se met aussi en pause quand on la quitte.
- **Calculs selon l'âge** — Petit : + et − jusqu'à 10 ; Moyen : additions/soustractions à retenue (ex. 47 + 28, 63 − 27),
  tables de 3 à 9 ; Grand : 23 × 7, 96 ÷ 8, 6 × 7 − 15, 238 + 57.
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
   `https://github.com/<ton-compte>/<ton-dépôt>/releases/tag/apk-latest` → touche `NumeroEnFuite-V7-debug.apk`
   (lien utilisable directement depuis le téléphone, sans compte ni décompression).
4. Il est aussi disponible dans l'artefact **NumeroEnFuite-V7-APK-debug** de l'exécution (Actions).

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
l'artefact **NumeroEnFuite-V7-APK-release**. Garde `numero.jks` et ses mots de passe en lieu sûr : ne les mets jamais dans le dépôt.

## Lancer les tests sur ton ordinateur

```bash
npm install --no-save playwright && npx playwright install chromium
node tests/game.test.cjs
```
