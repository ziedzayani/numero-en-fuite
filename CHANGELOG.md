# Historique des versions

## V9.20 — Duel express (Wi-Fi)

- Nouveau mode **⚡ Duel express** dans la salle Wi-Fi (2 à 4 joueurs, 8 manches, 3 à 5 minutes). Tout le monde joue
  en même temps : un indice automatique pour tous, le numéro bouge, puis chacun choisit EN SECRET une capture
  (🎯 précise +10, 🕸️ filet +4, 3 par partie) en 25 s. Révélation simultanée ; le numéro n'est montré que s'il est
  attrapé. Fin : écran des Points (séries, duels, partage, revanche « Prêt » compris).
- Choix secrets garantis par l'hôte (chacun ne reçoit que le sien + qui a déjà choisi). Pas de grisage des numéros
  impossibles : ce serait l'« Aide » (la déduction reste le cœur du jeu).
- Écrans de fin aux Points : bouton Accueil à maison blanche (charte de l'écran de victoire).
- Moteur séparé (`09b-duel.js`) : le jeu tour par tour n'est pas modifié.

## V9.19 — pronostics des spectateurs (Wi-Fi)

- Pendant le tour d'un autre, chaque joueur touche « 🔮 Pronostic » dans la bulle du détective et choisit EN SECRET
  où sera le numéro quand le joueur actif capturera (petit filet de la même largeur que le filet magique).
  Pronostic juste au moment de la capture (ou de la fin du chrono) : +1 ⭐, annoncé à tous dans le résultat.
  Plus de temps mort : tout le monde déduit à chaque tour.
- Secret garanti par l'hôte : chaque téléphone ne reçoit que SON pronostic ; le joueur actif ne voit aucun pronostic.
- Français : espaces insécables corrigées dans plusieurs textes (« : », « ; », « » »).

## V9.18 — parties proches, carte de victoire, charte des boutons

- **Rejoindre d'un toucher** : l'écran « Rejoindre » liste les parties Wi-Fi trouvées (« Partie de Zied · 4933 ») ;
  le code reste possible en dessous. L'hôte annonce son prénom (« NEF-code-Prénom », 63 octets maximum).
- **Carte de victoire à partager** : bouton « Partager » (Rejouer | Partager | Accueil) sur les écrans de victoire à
  plusieurs. Le jeu dessine une image 1080 × 1350 (titre, numéro, podium, série) avec ses propres images, puis ouvre
  le menu de partage Android, avec un lien de téléchargement. Aucune autorisation ni connexion du jeu
  (petit `ShareProvider` en lecture seule, sans bibliothèque). Pas de bouton quand personne n'a trouvé le numéro.
- **Charte des boutons** (comme l'écran de victoire et la Pause) : actions principales jaune-or glossy (les anciens
  boutons verts comme « C'est parti ! » ou « Lancer la partie » aussi), secondaires bleu électrique glossy,
  « Oui, quitter » / remplacer en bleu nuit bordé cyan (plus d'orange) ; boutons de choix en pastilles claires,
  le choix en jaune-or. Icônes Wi-Fi et Partager dessinées (pas d'emoji).
- À tester sur de vrais téléphones : la liste des parties proches et le menu de partage (code Android).
- Corrigé avant publication : une partie trouvée pendant la saisie du code effaçait le code tapé (l'écran était
  redessiné en entier) ; seule la liste est maintenant mise à jour.

## V9.17 — Duels et « Pendant ton absence »

- **Mon bureau → onglet « Duels »** (statistiques à plusieurs, sur ce téléphone, sans serveur) : victoires / parties,
  captures, meilleure série de victoires, et les face-à-face (« Zied 5 – 3 Ahlem »). Seuls les prénoms saisis
  comptent ; chaque partie ne compte qu'une fois (même en Wi-Fi, où chaque téléphone garde ses statistiques).
  Nouvelle clé `numeroEnFuiteVersusV1` : la sauvegarde de partie, la carrière solo et les records ne changent pas.
- **« Pendant ton absence »** (même téléphone) : à l'écran « Passe le téléphone », les 3 derniers indices ou captures
  ratées des autres joueurs depuis ton dernier tour.
- Fenêtre des prénoms à 4 joueurs : marge de sécurité (la V9.16 défilait de 11 px sur la machine de compilation).
- La V9.16 n'a pas été publiée (contrôle de mise en page refusé) : son contenu (séries, revanche « Prêt ») est inclus ici.

## V9.16 — Séries et revanche

- **Séries** à plusieurs (même téléphone et Wi-Fi) : « 1 partie », « Premier à 2 » ou « Premier à 3 » victoires.
  Gagnant d'une manche : 1er de la Course, ou meilleur total aux Points (manche nulle si personne n'a attrapé le
  numéro). « Manche suivante » garde le score ; la série gagnée affiche « Zied remporte la série ! » et
  « Nouvelle série ». Score de la série sur les pastilles des joueurs (⚔️) et sur l'écran de fin (pastille, ou
  sur chaque ligne du podium à 3–4 joueurs). Une manche ne compte qu'une fois (identifiant de partie).
- **Revanche Wi-Fi avec « Prêt »** : « Rejouer » ne relance plus tout de suite pour tout le monde ; chacun se déclare
  prêt (✅ / ⏳ visibles par tous), la revanche part quand tous les joueurs connectés sont prêts. L'hôte peut
  « Lancer maintenant » si quelqu'un ne répond pas.
- Salle Wi-Fi : l'hôte choisit aussi la série ; les invités la voient.
- Fenêtre des prénoms à 4 joueurs resserrée : toujours sans défilement avec le choix de la série.
- Abandonné (redondant avec les séries) : la « Course en 2 captures ».

## V9.15 — fondations du multijoueur

- **Questions : au moins une réponse OUI**, sans rien révéler. Les 3 questions proposées couvrent tous les numéros
  encore possibles : quel que soit le numéro caché, au moins une répond OUI (OUI/OUI/OUI, OUI/OUI/NON et
  OUI/NON/NON restent possibles). Comme le trio ne dépend pas du numéro caché, il ne permet aucune déduction
  gratuite. Partout : solo, à plusieurs, Wi-Fi, 🔀, Défi. Les questions restent « fortes » (≥ 2 × filet).
- **Wi-Fi : battement de cœur** (protocole 2). Un téléphone muet depuis 10 s est repéré (avant : partie bloquée
  jusqu'à la fin du chrono) ; il reprend sa place s'il répond de nouveau.
- **Wi-Fi : hôte en arrière-plan** : les invités sont prévenus tout de suite, la fenêtre se referme à son retour.
- **Salle Wi-Fi** : l'hôte choisit le niveau et le mode (Course / Points) dans la salle d'attente ; les invités les voient.
- Deux versions du jeu différentes refusent de jouer ensemble en Wi-Fi : installer la V9.15 sur tous les téléphones.

## V9.14 — retour des questions comme avant la V9.12

- À ta demande : une question ne change plus le score (ni +1 pour OUI, ni −1 pour NON), et les 3 questions
  proposées ne sont plus forcées à contenir une vraie et une fausse. Le rappel « OUI +1 · NON −1 » et la phrase
  ajoutée à la règle « Points » sont retirés (8 langues).
- Écran de victoire (V9.12) et fenêtre Pause (V9.13) inchangés.

## V9.13 — fenêtre Pause alignée sur la maquette

- Panneau bleu royal à rayons, bordure cyan lumineuse ; détective officiel à la loupe (image existante) posé
  derrière le bandeau titre « Pause » (bleu nuit bordé d'or, icône pause jaune glossy) ; message dans un
  cartouche clair.
- REPRENDRE jaune-or glossy dominant (icône Play), Réglages bleu électrique (engrenage existant), QUITTER LA
  PARTIE bleu nuit bordé cyan avec une icône de porte dessinée (plus d'orange ni d'emoji). La confirmation
  « Quitter la partie ? » existante est conservée.
- Responsive : pas de défilement de 640 à 932 px de haut, 8 langues (pas d'italique artificiel en ar / zh / ja).

## V9.12 — à plusieurs, chaque question compte (+1 / −1)

- Partie à plusieurs (Course et Points, hors Défi) : une question dont la réponse est **OUI** rapporte **+1 point**,
  une réponse **NON** coûte **−1 point**. Le gain s'affiche dans le jeton « Ton score » et sur la pastille du joueur.
- Les 3 questions proposées contiennent toujours **au moins une vraie et au moins une fausse** pour le numéro
  caché (aussi après 🔀). Elles restent toutes utiles (elles coupent les numéros possibles en deux).
- Rappel « OUI +1 · NON −1 » à côté de « Choisis une question », ligne 🎲 dans ℹ️, règle « Points » complétée
  (8 langues). Solo et Défi inchangés. Le jeton « Ton score » se place à côté de OUI / NON (pas de défilement).

### Écran de victoire (pack d'images fourni)

- Détective : buste à base fondue (plus de coupe nette au torse), proportions conservées.
- REJOUER : le confetti du décor qui dépassait sous le bouton est déplacé ; contour doré continu, ombre adoucie,
  icône bleue fournie (meilleure résolution).
- ACCUEIL : bouton bleu glossy avec une maison blanche dessinée dans le bouton.
- Trophée centré sur le bord du bandeau vert ; podium : 1re place bordée d'or, 2e place entre pointillés avec un
  fond argenté. Images remplacées en meilleure résolution (trophée, médailles, flèches, engrenage), sans doublon.
- Pas de coureur dans le bandeau « Le numéro se cachait sur le … » (à ta demande).

## V9.11 — écran de victoire : corrections d'après la maquette

Fond bleu nuit à rayons ; détective du logo pouce levé, yeux ouverts ; bandeau vert glossy (reflet, contour doré
lumineux) ; trophée agrandi ; bandeau « Podium » fourni (lauriers + couronne, texte traduit par-dessus) ;
panneau à contour cyan néon ; ligne du gagnant lumineuse ; boutons Rejouer / Accueil glossy ; espacements
resserrés ; coureur retiré du bandeau du numéro caché. Valeurs toujours calculées par le jeu.

## V9.10 — écran de victoire avec les images fournies

- Détective pouce levé du pack (en pied, coupé à la taille comme sur la maquette), lauriers dorés découpés du
  trophée autour de « Podium », bouton Accueil = tuile bleue à maison dessinée, médaillon du détective dans le
  bandeau « THE NUMBER HUNT ».
- Mise en page exacte de la maquette : bandeau « Le numéro se cachait… » hors du cadre, « Podium » posé sur le
  bord du cadre lumineux, « Prochaine partie » entre deux traits dorés, boutons Rejouer / Accueil sous le cadre,
  fond bleu vif à rayons.

## V9.9 — écran de victoire fidèle à la maquette

- Grand détective pouce levé, trophée posé sur le bandeau vert bordé d'or, « Numéro attrapé au **tour 4** » en
  pastille, « Le numéro se cachait sur le **50** » en bandeau crème, « Podium » entre deux lauriers avec la
  couronne, podium dans son cadre (gagnant bordé d'or, lignes en pointillés), « 🏁 Prochaine partie : **Zied**
  commence » en pastille, maison blanche sur le bouton bleu, confettis et loupe en décor ; version compacte à 3–4
  joueurs et sur petit écran.

## V9.8 — icônes dessinées des écrans de fin

- Pack d'icônes « victoire » à la place des émojis : engrenage (Réglages), flèches (Rejouer), maison (Accueil),
  coureur (« le numéro se cachait… »), trophée et confettis (victoire), médailles 1, 2, 3 (podium), couronne
  (« Podium »). Le détective pouce levé du pack n'est pas repris : il existe déjà.

## V9.7

- Le niveau **« Petit » s'appelle « Facile »** (8 langues : Easy, Fácil, Facile, Leicht, سهل, 简单, かんたん).
- **Course à plusieurs : la première capture termine la partie** (plus de main donnée aux autres joueurs) ;
  les autres sont classés aux points. Bouton « 🏆 Voir les résultats » après la capture.
- **Écran de victoire de la Course refait** (maquette) : détective pouce levé, trophée, bandeau vert « X gagne la
  course ! », podium avec médailles, le gagnant encadré d'or.
- **« ×2 » n'est plus caché par le drap** : l'étiquette du saut reste au-dessus, le drap grossit moins.

## V9.6 — Mon bureau ne mélange plus les niveaux

- **XP selon le niveau** : victoire 10 / 15 / 20 / 30 XP (Petit / Moyen / Grand / Génie), défaite 2 / 3 / 4 / 5,
  bonus record 5 / 8 / 10 / 15 ; le niveau est rappelé à côté des XP sur l'écran de victoire.
- **Avec l'aide 💡 : aucune récompense** — 0 XP, pas de badge, pas de mission (la victoire reste notée « avec
  aide » dans le bureau). Dit dans la fenêtre « Prêt ? » et sur l'écran de victoire.
- **Badges à 4 paliers**, un par niveau : 🥉 Petit, 🥈 Moyen, 🥇 Grand, 💎 Génie ; on regagne un badge à un niveau
  plus haut ; l'onglet Badges montre le palier obtenu et le suivant. « Fin limier » : 💎 seulement. Les anciens
  badges sont gardés au palier 🥉.
- **Statistiques par niveau** dans l'onglet Rang : on choisit Petit / Moyen / Grand / Génie (enquêtes, victoires,
  défaites, étoiles du niveau), Petit et Génie ne se mélangent plus.
- **Missions adaptées** : chacune a un niveau minimum (le niveau où l'on joue le plus, ou le suivant une fois sur
  deux pour progresser) ; une partie à un niveau plus facile ne compte pas, plus difficile compte.

## V9.6

- **Mon bureau › Rang : statistiques par niveau** (Petit, Moyen, Grand, Génie) au lieu d'un total mélangé :
  enquêtes, victoires (dont avec aide), pas encore résolues et étoiles du niveau choisi (par défaut le dernier joué).

## V9.5 — « Mon bureau » d'après les maquettes

- Titre avec le bureau dessiné ; onglets en tuiles avec leurs images (détective, dossier, médaille,
  presse-papiers), l'onglet choisi en violet bordé d'or.
- Rang : médaillon du détective, chapeaux plus grands (le rang actuel en or).
- Records : une carte par niveau avec son image (poussin, cerveau, fusée, hibou), score en pastille bleue,
  « À découvrir » en pastille claire.
- Badges : pastille « Badges 2/6 », cartes sur 2 colonnes, les badges obtenus en doré ; œil dessiné pour
  « Œil de lynx ».
- **Abandon et film** : revoir le parcours depuis « Quitter la partie ? » dévoile le numéro, donc la partie ne
  peut plus reprendre ; au retour du film, seul le bouton « Fermer » reste (Retour ferme aussi la partie).
- **Capture ratée** : les points perdus sont dans un jeton « Ton score 🔻 −1 point » à part, pour ne plus les
  confondre avec le déplacement du numéro (« ← −2 »).
- Missions : intro avec le presse-papiers, une carte par mission avec la cible, progression en pastille verte.

## V9.4 — images définitives et déplacements plus clairs

- **Nouvelles images en haute qualité** (fond transparent) : détective à la loupe (jeu), pouce levé (« Bravo ! »),
  main sur la tête (« Oups ! ») ; poussin, cerveau, fusée, hibou des niveaux ; livre, cible, toque, bureau de
  l'accueil ; drap qui cache le numéro.
- **Déplacement bien visible** : l'étiquette du saut (« → +2 », « ✖️ ×2 », « 🪞 ») arrive en grand puis reprend sa
  taille ; l'explication (×2, miroir…) est dans un encadré lisible.
- **Miroir expliqué en 3 lignes** d'exemples (au niveau Génie : 50 → 1, 49 → 2, 10 → 41) ; le drap part d'un côté
  de la ligne du miroir et réapparaît de l'autre, sans la toucher.
- **Pas de fête quand personne n'a trouvé le numéro** (Course, ou Points sans aucune capture), même si un joueur
  a plus de points : pas de confettis, bandeau bleu « Personne ne l'a attrapé… ».
- **30 tours à 2 joueurs** (15 chacun) au lieu de 20.
- **Film du parcours aussi quand on perd ou qu'on abandonne** : bouton « 🎬 Revoir son parcours » sur l'écran
  du Défi perdu et dans « Quitter la partie ? » (on y revient après le film).
- **Victoires « avec l'aide » notées dans Mon bureau** : « Gagnées · dont N avec aide 💡 », record marqué 💡 s'il a
  été obtenu avec l'aide, pastille « 💡 Gagné avec l'aide » sur l'écran de victoire.
- **Défi : calculs d'un cran plus difficiles** (Facile : retenues et tables ; Moyen / Difficile : priorités),
  plus de « 5 + 2 » ; 45 s pour répondre en Moyen et Difficile.
- **Plus de fenêtre « Revoir l'évasion du numéro ? »** après une capture : le bouton « Revoir son parcours » est déjà
  dans le résultat (le réglage « Proposer le film » disparaît).
- Tuile Génie choisie à nouveau lisible ; carte de résultat plus compacte (« Tu gardes ton tour » est dit par le
  bouton « Choisir mon numéro »).

## V9.3.1

- Accueil : les 4 tuiles du bas sont alignées (« Comment jouer ? » sur deux lignes ne décale plus son icône).

## V9.3 — illustrations des niveaux

- Tuiles de niveau de l'accueil avec les illustrations de la maquette : poussin (Petit), cerveau (Moyen),
  fusée (Grand), hibou diplômé (Génie), plage en pastille blanche.
- Rangée du bas illustrée de même : livre « ? » (Comment jouer ?), cible et fléchette (Défi solo), toque
  (Tutoriel), bureau et plante (Mon bureau).
- **« Le numéro s'échappe ! » sous un drap** (maquette « drap furtif ») : le numéro caché glisse d'une case à
  l'autre sous un drap qui ondule, avec une traînée de vitesse et des petits nuages de poussière ; le saut en
  pastille violette « → +1 », le titre souligné de jaune. Animation coupée avec « Réduire les animations ».

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
