# Historique des versions

## V9.2 — écrans « Bravo ! » / « Oups ! » et détective du logo (maquettes)

- **Le détective du logo** remplace le petit personnage dessiné : en jeu, le détective à la loupe des maquettes
  (plus grand, avec ses « ? ») ; après une erreur il se tient la tête, après une réussite il lève le pouce.
- **Écran « Oups ! »** (capture ratée, filet vide, temps écoulé, calcul faux) : bandeau rouge, détective, bandeau
  « ✕ Mauvaise réponse ! » et, pour un calcul, **« La bonne réponse était : 7 »** dans une case verte.
- **Écran « Bravo ! »** (numéro attrapé, calcul juste) : trois étoiles, bandeau vert, rayons dorés,
  « ✓ Bonne réponse ! » et « ⭐ +1 ».
- **Accueil comme la maquette** : tuiles 1 à 4 joueurs (+ Wi-Fi sur Android), tuiles de niveau avec seulement le
  nom et la plage, rangée du bas « Comment jouer ? », « Défi solo », « Tutoriel », « Mon bureau ».
- **Jeu comme la maquette** : onglets bleu nuit, l'onglet choisi en jaune, « Capture précise » jaune, pause
  orange, bulle en italique.
- 8 langues pour les nouveaux textes ; audit 3 tailles × 8 langues sans problème.

## V9.1 — tous les écrans au nouveau design

D'après les maquettes : le style seul change, les règles du jeu restent les mêmes.
- **Cartes bleu roi lumineuses** (bord bleu clair) sur fond bleu avec halo, texte blanc ; titres de section en
  pastille bleu nuit bordée d'or ; titres d'écran en pastille.
- **Accueil** : bulle blanche « Attrape-moi si tu peux ! », Solo / À plusieurs en tuiles (✓ sur le choix),
  2 / 3 / 4 joueurs et Wi-Fi sur une ligne, **niveaux en tuiles colorées** (vert, bleu, rouge, violet — pas de
  rose) avec ✓, gros bouton JOUER jaune, rangée du bas en tuiles blanches à icône.
- **Boutons** : jaune or, vert, bleu et rouge-orangé en relief (dégradé + bord inférieur épais, toujours sans ombre
  portée) ; numéros et réponses en tuiles bleu clair ; onglets Indice / Calcul / Deviner bleu nuit, l'onglet
  choisi en jaune.
- **Résultats** : bandeau vert (« Bravo », « Gagné ») ou rouge (« Raté », « Il t'a échappé ») ; bleu quand
  personne n'a attrapé le numéro en Course. Détective en manteau et chapeau bruns, comme sur le logo.
- **Réglages** en lignes claires, **Mon bureau** avec des tuiles de statistiques crème bordées d'or.
- Audit de mise en page : nouvelle vérification **« texte peu lisible »** (contraste texte / fond) sur tous les
  écrans, 3 tailles × 8 langues ; `SHOTS=dossier` enregistre une capture de chaque écran pour la relecture.

## V9.0 — The Number Hunt

Nouvelle identité pour attirer tous les joueurs, enfants et adultes.
- **Nom anglais** « The Number Hunt » (application, page web, PWA) et **nouveau logo** (icône Android, accueil,
  bandeau des écrans). Le logo de l'accueil flotte doucement et s'adapte à la hauteur de l'écran.
- **Nouveau détective animé** (SVG, inspiré du logo) à la place de la mascotte violette : mêmes mouvements
  (cherche, réfléchit, court, saute de joie, frissonne…), expressions (clin d'œil, fierté…) et chapeaux de rang.
- **Couleurs** : plus de rose ; bleu nuit et or du logo, orange à la place du rose.
- **8 langues** : + espagnol, italien, allemand, chinois (simplifié) et japonais. Au premier lancement, le jeu
  prend **la langue du téléphone** (sinon l'anglais) ; un joueur existant garde sa langue. Réglages : une ligne
  « Langue » ouvre la liste des 8 langues.
- Sauvegardes, records et progrès conservés (même identifiant d'application, mêmes clés de stockage).
- Mise en page : texte des sauts longs sous l'image, libellés de chronos qui ne débordent plus ; audit 3 tailles
  × 8 langues sans défilement ; nouveaux tests (langue du téléphone, 8 langues, logo).

## V8.18 — nouveau mode Défi

Analyse et simulations : voir `docs/DEFI.md`. Avant, un joueur « calculatrice » attrapait le numéro en ~4,4 tours
quelle que soit la difficulté ; maintenant 5 / 7 / 9 tours (médianes), sans victoire due à la chance.
- **Sauts par difficulté** : Facile ±3/±5/±7 ; Moyen ±7…±13, miroir, ×2 ; Difficile + ×3 et doubles sauts.
  ×2 / ×3 « modulo 101 » (au-delà de 100 on retire 101) : plus de numéros qui fusionnent ; ÷2 retiré.
- **Sens caché** (Moyen 20 %, Difficile 30 %) : « saut de 7… mais vers où ? » ; le carnet garde les deux sens.
- **Gels comptés** : Facile à chaque calcul juste, Moyen 3, Difficile 1.
- **Difficile** : un calcul juste laisse **choisir sa question** parmi 3 (au lieu du meilleur seuil).
- **« Laisser filer »** : capture facultative en Défi (aucune pénalité, le numéro bouge).
- Contre la montre : +8 s par calcul juste (au lieu de 15).
- Nouveaux records (règles différentes) ; les anciens restent affichés pour mémoire.
- Carnet › Indices : l'indice gagné par un calcul juste est noté. Règles de chaque difficulté dans la fenêtre
  du Défi ; astuces « sens caché » et « ×2 modulo 101 ». FR / EN / AR.
- Outils : `tools/defi/` (modèle validé contre le moteur, comparaison ancien / nouveau).
- Audit : l'état « ℹ️ avantages / risques » ne fuit plus d'un écran audité à l'autre ; boutons de questions et
  onglets un peu plus bas sous 760 px.

## V8.17

- **Une question ne suffit jamais au filet** (tous les niveaux) : chaque question proposée laisse, quelle que
  soit la réponse, au moins 2 × la taille du filet en numéros possibles (6, ou 4 au niveau Petit). En toute fin
  d'enquête, quand ce n'est plus possible, on propose celles qui en laissent le plus.
- Questions « entre a et b » : au moins 2 × filet numéros (Moyen : 6 au lieu de 4, plus de « entre 10 et 13 »).

## V8.16

Retours d'un essai sur téléphone (Génie, 4 joueurs, Course) :
- **Barres système comptées deux fois** : l'application appliquait déjà les marges des barres d'état et de
  navigation, puis les transmettait à la WebView qui les recomptait (`env(safe-area-inset-*)`) : ~40 dp perdus,
  d'où un défilement pour atteindre « Attraper » / « Filet ». Les marges ne sont plus transmises.
- Écrans courts (≤ 720 px utiles) : détective, onglets et pavé plus compacts ; vérifié en 360 × 690 à 4 joueurs.
- Pavé Génie : l'aperçu du filet (« 37·38·39 ») n'est plus collé au bas du champ.
- **Filet réussi / Numéro attrapé** : loupe à côté du titre, annonce du podium plus serrée, sans défilement.
- **Filet vide** : le pion « ? » du saut sortait de sa boîte (régression V8.13) ; il reste dans sa piste.
- **Fin de Course** : « Le numéro se cachait sur le … » et le film sont dans le cadre du podium (et non plus sous
  le détective) ; boutons Rejouer · ⌂ sur une rangée.
- Règle du filet inchangée : 3 numéros au plus, 3 filets par partie.

## V8.15

**Mon bureau** (étape 4) — 4 onglets : 🕵️ Rang · 📂 Records · 🏅 Badges · 🎯 Missions.
- **6 badges** : Œil de lynx (victoire sans erreur, capture précise), Éclair (≤ 3 tours), Cerveau d'or (3 calculs
  réussis dans une enquête), Maître du filet (capture au filet), Fin limier (Génie sans lancer le filet),
  As du détective (10 victoires au même niveau). Les badges à gagner disent comment les obtenir.
- **3 missions** sans chrono, remplacées quand elles sont réussies (+20 XP chacune) : mener 3 enquêtes,
  décaler ses marques, gagner au niveau Moyen, réussir des calculs, gagner vite, sans erreur, avec 3 étoiles…
- **Frise des 8 rangs** avec leur chapeau ; le **détective porte le chapeau de ton rang** (rang 1 : chapeau
  d'origine ; couleurs officielles ; étoile à partir du rang 6).
- Détective : **saut de joie et trophée** sur un nouveau record, **clin d'œil d'encouragement** après une défaite.
- Badges et missions sont dans la carrière, donc aussi dans le code « Mes progrès ».

**Écran de victoire solo compact et animé** (étape 5) : le score défile de 0 à sa valeur (une seule fois ;
jamais avec « Réduire les animations »), les lignes du score sont regroupées en pastilles, XP / badges /
missions sur une ligne, boutons Rejouer · 📚 · ⌂ sur une rangée. Tient en 360 × 640 sans défilement (FR, EN, AR).

## V8.14

**Carnet d'enquête « à la main »** (📓) : c'est l'enfant qui barre les numéros lui-même.
- Onglets ✏️ Mes marques · 🔎 Indices · 🤖 Détective (seulement si l'aide « numéros possibles » est activée).
- Toucher un numéro le barre / le rétablit ; en Génie, plages de 10 en plus de la grille ; en Défi (1–100),
  10 plages qu'on ouvre pour barrer leurs numéros un par un ou tous ensemble.
- Quand le numéro saute, les marques ne bougent pas toutes seules : bouton **« Décaler mes marques »** qui applique
  le(s) saut(s) (±k, ×2, ÷2, miroir) exactement comme pour le vrai numéro. Chaque joueur a son carnet, sauvegardé
  avec la partie, vierge à chaque nouveau numéro. En Wi-Fi, chacun barre sur son téléphone (seul le type des sauts
  est envoyé, jamais les positions).

**Wi-Fi — retours du premier essai sur téléphones**
- Le premier joueur est tiré au sort (avant : toujours l'hôte), puis tourne à chaque « Rejouer ».
- Chaque téléphone garde SON prénom (le champ affichait le prénom de l'hôte).
- « Rejouer » marche aussi depuis un invité ; si l'hôte est seul, retour à la salle d'attente avec le même code.
- Bug « Connexion perdue » bloquante : « Réessayer » sans hôte laisse la fenêtre ouverte avec un message clair et
  « Revenir à l'accueil » marche toujours ; fin de partie puis départ de l'hôte : message « L'hôte a quitté ».
  Appels au pont Android protégés (une erreur ne peut plus figer les boutons).

**Fin de partie sans capture** : « Le numéro se cachait sur le … » et 🎬 film de son évasion (dernière image
« Personne ne l'a attrapé »), à un téléphone comme en Wi-Fi.

**Partie plus longue à plusieurs** : 20 tours à 2 joueurs (10 essais chacun, au lieu de 16), 24 à 3 et à 4 ;
solo inchangé (12).

- Réglages : marge de sécurité (la CI de la V8.13 voyait 7 px de trop).

## V8.13

- **Accueil simplifié** : 👤 Solo (par défaut au premier lancement) ou 👥 À plusieurs (2 / 3 / 4 joueurs, raccourci
  Wi-Fi) ; le dernier choix est retenu. Niveau, JOUER, puis Défi solo · Mon bureau · ⋯ Plus (règles, tutoriel,
  partie Wi-Fi). Le rang du joueur est affiché sous le titre et ouvre « Mon bureau ».
- **Règles en 3 cartes** (se cache · s'enfuit · attrape-le) ; déplacements et points repliés ; tient sans défilement.
- **Astuces du détective** une seule fois, au moment utile : premier déplacement, miroir, ×2 / ÷2, gel en Défi,
  premier passage sur « Deviner » (le filet). Chronos en pause pendant la lecture ; jamais en partie Wi-Fi.
- Correctif : choisir un autre nombre de joueurs à l'accueil rendait la sauvegarde invalide au redémarrage
  (langue et réglages perdus, tutoriel reproposé).
- Correctif : écran Réglages (V8.12) qui débordait de 37 px en 360 px de large → CI de nouveau verte.

## V8.12

- **Mes progrès** (Réglages) : code de sauvegarde « NEF1-… » à garder (message, notes) pour retrouver rang, XP,
  records et réglages sur un nouveau téléphone ou après une réinstallation. Contrôle d'intégrité (un code abîmé est
  refusé), confirmation qui montre ce qui sera remplacé, partie en cours jamais touchée.

## V8.11

**Multijoueur Wi-Fi local (première version)** : 2 à 4 joueurs, un téléphone chacun, sur le même Wi-Fi ou le partage
de connexion d'un téléphone — sans Internet, sans serveur. Accueil › « Partie Wi-Fi » › Créer (code à 4 chiffres)
ou Rejoindre avec le code › salle d'attente › partie en direct sur tous les écrans.
- Le téléphone de l'hôte est le seul arbitre ; le **numéro secret ne quitte jamais son téléphone**.
- Seul le joueur dont c'est le tour peut agir ; les autres voient tout en direct. Course (podium) et Points.
- Coupures : « En attente de … », retour à sa place avec le même code, ou « Continuer sans lui » (hôte).
- Android : `NetBridge.java` (TCP + annonce NSD) ; 4 autorisations **normales** (aucune fenêtre de demande),
  vérifiées par la CI. Écran gardé allumé pendant une partie Wi-Fi.
- Testé avec 3 téléphones simulés ; **à valider sur de vrais téléphones** (liste dans docs/MULTIJOUEUR.md).
- Correctif : un bouton marqué « caché » restait visible (le style des boutons l'emportait).

## V8.10

- **Questions d'intervalle proportionnelles au niveau** : « Est-il entre a et b ? » couvre environ un quart des numéros
  (4 en Petit et Moyen, 8 en Grand, 13 en Génie) ; « proche de k » s'élargit aussi (écart 6 en Génie).
  Avant : en Génie, « entre 30 et 33 » + filet attrapait le numéro 72 % du temps après un « oui » ; maintenant 22 %
  (simulation de 4 000 parties). Une seule question ne suffit plus, il faut enquêter.
- **Course : chacun est prévenu** quand quelqu'un trouve le numéro. La fenêtre « passe le téléphone » annonce
  « 🥇 Joueur 1 a trouvé le numéro ! Un nouveau numéro se cache. À toi de le trouver pour la place 2 ! »,
  une seule fois par joueur.

## V8.9

**Mode Course : un podium, personne n'est privé de son tour**
- Celui qui attrape le numéro monte sur le podium ; un **nouveau numéro** est tiré pour les autres, qui finissent le tour.
  Une capture dans le **même tour** = même place (**ex aequo**). Les joueurs déjà placés ne rejouent plus ;
  les autres continuent pour les places suivantes. Personne n'attrape avant la limite : les points départagent.
- Après une capture : « 🥇 Joueur 2 monte sur le podium : place 1 ! », médaille sur sa pastille ; écran final en podium.

**Ni défilement, ni boutons collés** (retour du test sur téléphone 360 × 735)
- Audit automatique de **111 écrans et fenêtres × 3 tailles** (360 × 735, 393 × 806, 412 × 870), FR/EN/AR :
  aucun défilement, au moins 8 px entre deux boutons. Lancé à chaque compilation (`npm run audit:layout`).
- Réglages sur un seul écran (langues côte à côte, interrupteurs compacts, durées des chronos repliables).
- Écrans de fin : détective à côté du titre ; « Rejouer » / « Mon bureau » / « Accueil » espacés et alignés.
- Fenêtres Règles et Défi : explications détaillées repliables ; 10 px minimum entre boutons empilés.
- Reste à faire : les très petits écrans (360 × 640) défilent encore un peu.

## V8.8

Carrière du mode Solo classique (cahier des charges « KIT SOLO », partie V8.5 de son plan).
- **Score d'enquête** : victoire +100, +40 par tour économisé sur 12, +20 par calcul juste (3 au plus),
  +10 capture précise, −10 par capture ratée, questions gratuites ; défaite 0. Prolonger d'un tour ne rapporte jamais.
- **Records par niveau** (score et meilleur nombre de tours), « Nouveau record » seulement si strictement meilleur.
- **XP et 8 rangs** (Apprenti détective → Légende des enquêtes) : victoire +40, +10 si record, défaite après 12 tours +10,
  abandon 0. Chaque partie a un identifiant : recharger, rouvrir ou revenir ne redonne jamais XP, étoiles ni score.
- **Écran de fin** : étoiles, score, record, détail repliable, XP et barre de rang, **un conseil** pour la prochaine
  enquête, boutons Rejouer / Mon bureau / Accueil. Le film du parcours n'est pas modifié.
- **Mon bureau** (accueil et fin de partie) : rang, XP, enquêtes terminées / gagnées / pas encore résolues, étoiles,
  records des 4 niveaux, « Jouer en solo ».
- **Migration V8.4** : les meilleurs nombres de tours `solo_*` sont repris, aucun score ni XP n'est inventé ;
  stockage séparé `numeroEnFuiteCareerV1`, anciennes clés intactes. Défis, Course et Points inchangés.

Non repris du cahier : les étiquettes « Sauts de 1 case » de la maquette des niveaux (retirées en V8.6 à la demande).
Prévu ensuite : badges, missions, enquête du jour.

## V8.7

Retour du test sur téléphone (360 × 735) : en Génie, on pouvait taper « 86 » alors que les numéros vont de 1 à 50 ;
le numéro restait grisé, les boutons de capture bloqués, sans explication.
- Pavé numérique : un chiffre qui donnerait un numéro hors limites est **grisé et refusé**
  (après « 8 » en 1–50, plus rien ; « 0 » jamais en premier). Afficheur vide : « 1–50 » / « 1–100 ».
- Consigne corrigée : « Tape un numéro de 1 à 50 » en Génie (elle disait toujours 1 à 100).
- Pavé plus compact : tient sans défilement sur un écran de 360 × 735 (FR et AR), consigne masquée sur les écrans bas.

## V8.6

Retours du premier essai sur téléphone.
- Tutoriel, étape « boucle » : plus de bouton « Suivant » grisé, il apparaît seulement après la bonne case ;
  la flèche 9 → 1 reste affichée après la réponse ; « 9 + 1 » n'est plus coupé en fin de ligne.
- Tutoriel : « Fermer » devient une croix ✕ dans l'en-tête (plus de bouton collé sous « Suivant »).
- Niveaux : étiquettes « Sauts de 1 / de 1 ou 2 / spéciaux » retirées (elles n'apportaient rien).

## V8.5

Suite à l'audit de la V8.4.

**Signature et mises à jour**
- Clé de signature permanente préparée (empreinte SHA-256 `76:75:16:2D:…:C8:22`). Une fois ajoutée aux secrets
  GitHub, toutes les versions suivantes s'installent par-dessus la précédente, sans perte de données.
- La CI **refuse de publier** un APK signé avec une autre clé que celle attendue, et l'empreinte du certificat
  figure dans les notes de chaque publication.
- Les clés des V8.3 et V8.4 étaient temporaires et détruites après compilation : une **dernière** désinstallation
  est inévitable pour passer à la clé permanente.

**Accessibilité et pédagogie**
- **Plus aucune tranche d'âge** sur les niveaux (FR/EN/AR) ; « Choisis ton niveau, à tout âge » et une phrase dans les règles.
- Tutoriel : nouvelle étape **« la boucle »** (8 → 9 → 1 avec une flèche ; le joueur touche la case d'arrivée),
  cases du carnet qui glissent lors du décalage, bouton **« Rejouer ce tutoriel »**.
- Tutoriel **proposé au premier lancement**, une seule fois, jamais imposé (« Plus tard »).
- Mini-carnet centré sur les **indices** (questions, calculs justes), sans les captures ratées.

**Défi**
- Difficulté renommée **« Calculs et indices »** ; le **filet couvre 3 numéros dans les 3 difficultés**.
- Barème affiché **par variante** : le bonus de temps n'apparaît plus pour « Sans limite ».
- Les records V8.3 (ancien barème) sont affichés pour mémoire au lieu de sembler disparus.

Non retenu : filet à +5 (choix déjà fait de le garder à +4).

## V8.4

Suite à l'audit de la V8.3.

**Défi du super détective**
- **Barème anti-abus** : calcul juste +10 (le combo 🔥 n'est plus qu'un effet visuel), −45 par tour en plus,
  question −5. Rater exprès pour enchaîner les calculs ne rapporte plus jamais : le scénario de l'audit
  (1 205 points avec 7 échecs) donne maintenant moins qu'une capture rapide. Vérifié sur 168 parties simulées (3 difficultés × 2 variantes).
- **Chrono arrêté pendant la lecture du résultat** (le temps de lecture n'est plus pénalisé).
- **3 difficultés de calcul** : Facile (+ et − jusqu'à 10), Moyen (retenues, tables), Difficile (priorités, 6 choix).
  Numéros toujours de 1 à 100. Un record par variante et par difficulté (anciens records remis à zéro : barème différent).
- Barème complet affiché dès la fenêtre de lancement.

**Règles et jeu**
- **Tutoriel « Apprends en jouant »** (accueil et règles) : mini-enquête d'une minute avec un numéro visible :
  question, numéros rayés, fuite (+1) avec le carnet qui se décale, capture précise ou filet, essai raté expliqué.
- **Sauts « à l'aveugle »** : après un indice, une petite animation montre le type de saut (+2, ×2, ÷2, miroir)
  sur une piste sans numéros, donc sans révéler où se cache le numéro.
- **Mini-carnet** sous les questions : les derniers indices sur le numéro en cours, ou une astuce (masqué sur les écrans bas).
- Un saut annoncé déplace toujours le numéro (÷2 sur le 1 ou ×2 sur le maximum sont retirés au tirage).
- Règles du niveau Génie expliquées (±3, ±5, ×2, miroir) ; mode Course : « Personne ne l'a eu ? Les points départagent ».
- Classement du mode Points : sous-totaux « points de captures + ⭐ de calculs ».
- Version affichée (accueil et Réglages) = version Android, générée automatiquement (fin du « V7 »).

Inchangés à dessein : film à 6 s par étape, filet à +4.

## V8.3

**Jeu**
- Les avantages / risques (Indice, Calcul) sont cachés derrière un bouton ℹ️ : un toucher les affiche, un autre les referme.
- Filet réussi : **+4** (au lieu de +2) en mode Points.
- **Filet dans tous les modes, 3 fois par joueur et par partie** : en mode Course et en solo, un filet réussi attrape
  le numéro et fait gagner la partie.

**Qualité du code**
- Le jeu n'est plus un seul fichier de 270 Ko écrit sur quelques lignes : sources lisibles et commentées dans `src/`
  (15 modules JS, 9 feuilles CSS, traductions en JSON, polices en .woff2), assemblées par `tools/build.mjs`.
- Règles chiffrées regroupées et nommées (`LEVELS`, `SCORE`, `NETS_MAX`) au lieu de nombres répétés dans le code.
- Code mort supprimé (7 fonctions / variables jamais utilisées, une clé en double dans l'API de test) grâce à ESLint.
- Vérifications automatiques en CI : fichiers générés à jour, format Prettier, ESLint, mêmes clés dans les 3 langues.
- **APK release** (non débogable, identifiant `com.atelier.numeroenfuite`) à la place de l'APK debug.

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

## V8.2

- **Deux modes en multijoueur**, choisis avant la partie :
  - 🏁 **Course** (par défaut) : le premier qui attrape le numéro gagne, la partie s'arrête. Pas de filet.
    Si personne ne l'attrape avant le dernier tour, les points et les ⭐ départagent.
  - 🏆 **Points** : plusieurs tours, capture +10, filet +2, nouveau numéro après chaque capture ; meilleur score.
- **Solo** = règles de la Course (attraper = gagner), sans filet. Le Défi solo garde le filet et son score.
- **Le joueur qui commence change** à chaque « Rejouer » (équité).
- **Aide par joueur** (numéros possibles en vert), choisie avant la partie, désactivée par défaut
  (remplace le réglage « Aide du carnet »). En solo : fenêtre « Prêt ? » avec l'aide.
- **Boutons plats** : plus de « reflet » sous les boutons.
- **Filet limité à 3 par joueur** (mode Points et Défi solo) : ●●○ sur le bouton, puis « Plus de filet ».

## V8.1

- Film : la flèche va toujours de l’ancien au nouveau numéro (2 ──−2──➜ 15) ; quand il fait le tour : « 🔄 Après 1, il repart de 15 ».
- Fin de partie solo : 1 à 3 étoiles selon la rapidité, compteurs tours / indices / ratés, record par niveau ; perdu : loupe sur le numéro caché. Plus de « classement » ni de « pts + 0 ⭐ ».
- Multijoueur : « dont N ⭐ bonus » seulement s’il y a des étoiles. « You win! » sans espace avant « ! ».
- Film : boutons explicites « ◀ Précédent » et « Suivant ▶ » (gros bouton vert), aussi en mode « Avec les boutons ».
- Plus d'icône ❓ en début de phrase (film et carnet) : remplacée par 💡 ; ponctuation vérifiée (FR « ? » avec espace insécable, EN sans espace, AR « ؟ »).

## V8.0

- **Solo : la partie est gagnée dès que le numéro est attrapé** (« 🏆 Gagné ! Tu as attrapé le numéro en 3 tours »).
  Pas trouvé en 12 tours : « Il t'a échappé », le numéro est révélé.
- Film du parcours : **plus d'écran noir** entre les étapes ; **6 secondes** par étape ;
  choix **Automatique / Avec les boutons** ; les **choix ratés du joueur** sont montrés (🎯 12 ✗, filet 8·9·10 ✗,
  calcul faux) avec « il était sur le … » et les cases en rouge sur la grille ; la capture finale en vert.

## V7.9

- Film du parcours plus lent : **5 secondes par étape**, avec une barre de temps. Animation en 2 temps :
  l'ancien numéro reste affiché, puis il s'envole (avec des traces de pas) et le nouveau numéro atterrit à sa place.

## V7.8

- **🎬 Film du parcours** : après chaque capture, une fenêtre propose « Revoir l’évasion du numéro ? ».
  Le film montre le numéro de départ, puis chaque question, calcul ou capture ratée avec le saut
  (ex. 13 ➡ +1 → 14), les traces sur la grille, jusqu’à la capture (confettis). Lecture automatique,
  pas à pas (◀ ▶▶), recommencer ⏮. Bouton « Revoir son parcours » dans le résultat ; réglage pour ne plus
  le proposer. Fonctionne aussi au niveau Génie et en défi (×2, miroir…).

## V7.7

- Onglet Indice sans défilement : onglets toujours visibles, explications compactes, bouton 🔀 à côté.
- Prénoms : « C'est parti » lance directement la partie (plus d'écran sombre ni de 2e appui).
- Miroir expliqué avec un exemple : « 1 ↔ 50, 2 ↔ 49… (le 10 devient 41) » ; ×2 : « le 7 devient 14 ».

## V7.6

- **Nouveau niveau 🦉 Génie** (13 ans et +) : numéros de 1 à 50 (pavé numérique), sauts annoncés ±3, ±5, ×2 ou miroir,
  calculs mélangés à 6 choix, chrono global 100 s.
- **Défi : le calcul devient rentable** — calcul juste : le numéro est **gelé 🧊** (pas de saut), **+30 points**
  (+10 par bonne réponse d'affilée), **+15 s** en contre la montre, et un indice. Calcul faux : −10 et saut fou.
  Captures en défi : ratée −20 (−40 au filet), victoire au filet −50.

## V7.5

- **Le numéro bouge toujours** (jamais « resté sur place ») : ±1 au niveau Petit, ±1 ou ±2 ailleurs.
- **Deux chronos visibles dès le début du tour** : 🕐 chrono global du tour (aide + choix du numéro :
  Petit 75 s, Moyen 70 s, Grand 90 s) et 💬 chrono de réponse pour la question (25 / 20 / 20 s) ou 🧮 le calcul
  (30 / 30 / 45 s). Réponse trop lente : plus d'aide ce tour. Chrono global écoulé : tour perdu. ⏸ met tout en pause.
- **🏆 Défi solo** (bouton sur l'accueil) : numéros de 1 à 100, pavé numérique, sauts « fous » annoncés
  (+7, −7, +9, +11, −13, ×2, ÷2, miroir). Deux variantes : *Contre la montre* (3 minutes) ou *Sans limite de temps*.
  Score : 1000 − 25 par tour − 10 par aide − 20 par erreur (+2 par seconde restante), record enregistré.
  Le carnet reste exact même avec ces sauts.

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
