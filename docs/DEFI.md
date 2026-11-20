# Mode Défi — règles V8.18 et équilibrage

## Constat (V8.17, mesuré sur le vrai moteur)

Avec un joueur qui réussit tous ses calculs, le numéro était attrapé en **4,4 tours en moyenne, quelle que
soit la difficulté** (les difficultés ne changeaient que les calculs). Causes mesurées :

- le calcul donnait le **meilleur seuil** (milieu exact des possibles) : une recherche dichotomique offerte ;
- **×2 et ÷2 fusionnaient des numéros** (÷2 ramène 1–100 à 1–50) : ils réduisaient l'incertitude sans indice ;
- la **capture obligatoire** à chaque tour : 27 à 37 % des victoires venaient d'un tir à moins d'une chance sur 3 ;
- contre la montre : +15 s par calcul juste, pour ~17 s par tour, calculer ne coûtait presque rien.

Pour un joueur au carnet parfait, compliquer les sauts ne change presque rien (4,5 → 5,1 tours) : la limite
est l'information (≈ un oui/non par indice). La difficulté doit jouer sur ce que le joueur **sait**.

## Règles V8.18

| | Facile | Moyen | Difficile |
|---|---|---|---|
| Sauts | ±3, ±5, ±7 | ±7, ±9, ±11, ±13, miroir, ×2 | idem + ×3 ; 10 % de doubles sauts |
| Sens caché (« saut de 7… vers où ? ») | jamais | 20 % des décalages | 30 % des décalages |
| Indice du calcul juste | meilleur seuil | meilleur seuil | question **au choix** parmi 3 |
| Gels | à chaque calcul juste | 3 par partie | 1 par partie |
| Capture | facultative (« Laisser filer », sans pénalité, le numéro bouge) | idem | idem |

- ×2 et ×3 sont **modulo 101** : au-delà de 100 on retire 101 (60 × 2 = 120 → 19). Bijectifs : deux numéros
  n'arrivent jamais sur la même case. ÷2 est retiré (aucune version simple ne l'est).
- Sens caché : le carnet automatique et « Décaler mes marques » gardent les **deux** positions possibles ;
  l'interface n'affiche jamais le vrai sens (`publicShift`, symbole « ↔ ±k »).
- Contre la montre : +8 s par calcul juste (au lieu de 15).
- Records : nouvelles clés `kind-diff-v2` ; les anciens records restent affichés « pour mémoire ».

## Résultats (3 000 parties par cas, `node tools/defi/compare.cjs`)

Joueur qui suit parfaitement les possibles — médiane des tours (90 % des parties en moins de…) :

| | V8.17 F / M / D | V8.18 F / M / D |
|---|---|---|
| Calculatrice 100 % | 5 / 5 / 5 | 5 / 7 / 9 (6 / 9 / 14) |
| Calculs 70 % | 6 / 5 / 6 | 7 / 10 / 15 |
| Questions seulement | 5 / 5 / 5 | 6 / 8 / 9 |
| Victoires « chanceuses » (< 1/3) | 27–37 % | 0 % (filet malin : 10–22 %) |
| Parties ≥ 15 tours (calculatrice) | 0 % | 0 / 0,2 / 10 % |

Un enfant qui suit seulement une plage de tête gagne 94 % en Facile, mais beaucoup moins en Moyen et
Difficile : le carnet (et « Décaler mes marques ») fait partie du jeu.

`tests/game.test.cjs` (section V8.18) rejoue 150 parties « calculatrice » par difficulté sur le vrai moteur et
vérifie que les médianes restent ordonnées (Facile ≤ 6 < Moyen < Difficile ≤ 12).

## Défis et Bureau (V9.24)

- Un Défi terminé passe par `settleChallenge()` (une seule fois par `g.gameId`) : XP de `CHALLENGE_XP`, badges
  `CH_BADGES` et missions `chWin` / `chTimed` dans la même carrière que le Solo classique.
- Le score n'est calculé qu'à un endroit, `chScoreParts()` : l'écran de fin (avec son détail), le record et l'XP
  utilisent les mêmes chiffres. Formule inchangée.
- « Excellent » = score de base (avant victoire au filet et secondes restantes) ≥ `CH_EXCELLENT_SCORE` (800), soit
  une capture en 4 ou 5 tours environ (médianes : Moyen 7, Difficile 9).
- Anti-abus : `CH_EASY_XP_PER_DAY` Défis Faciles récompensés par jour (compteur `p.challenge.easyDay`).
- Contre la montre : `CH_READ_PAUSE_MS` de lecture par résultat (`g.chReadKey` = taille de l'historique,
  `g.chReadMs`), aussi dans les fenêtres `CH_READ_MODALS` ; Pause, arrière-plan et capture réussie arrêtent le chrono.
