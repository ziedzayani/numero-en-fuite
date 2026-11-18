# Multijoueur Wi-Fi local

2 à 4 joueurs, **un téléphone chacun**, sur le **même Wi-Fi** (ou le partage de connexion d'un des téléphones).
Sans Internet, sans serveur, sans compte. Le jeu à plusieurs sur **un seul** téléphone reste disponible.

## Parcours

1. Accueil › **📶 Partie Wi-Fi** › prénom › **Créer une partie** : un code à 4 chiffres s'affiche.
   Le niveau et le mode (Course / Points) sont ceux choisis sur l'accueil.
2. Les autres : **Rejoindre avec un code** › prénom + code › salle d'attente.
3. L'hôte voit la liste et **lance** (2 joueurs minimum, 4 maximum).
4. En partie, seul le joueur dont c'est le tour peut agir ; les autres voient tout en direct
   (« Au tour de Omar… » dans la bulle du détective). Pas de « passe le téléphone ».
5. Fin : podium (Course) ou classement (Points) sur tous les écrans ; seul l'hôte relance.

## Architecture

```
 Téléphone HÔTE (joueur 1)                       Téléphones INVITÉS
 ┌─────────────────────────────┐                ┌──────────────────────────┐
 │ moteur habituel (g, ask…)   │  ← action ─────│ act('ask', id)           │
 │ arbitre : bon joueur ?      │                │                          │
 │ redactState(seat) ──────────┼── state ──────→│ clientApplyState(s)      │
 │ chronos (tick)  ────────────┼── timers ─────→│ paintTimers()            │
 └──────────┬──────────────────┘                └───────────┬──────────────┘
            │ window.NumeroNet (NetBridge.java)             │
            └──────── TCP, une ligne JSON par message ──────┘
```

- **L'hôte est le seul arbitre.** Il fait tourner le moteur normal. Une action reçue n'est appliquée que si elle vient
  du joueur dont c'est le tour (sauf pause / reprise). Les actions passent par la même table `GAME_ACTIONS`
  que l'interface locale : il n'existe pas de « deuxième moteur ».
- **Le secret ne quitte jamais l'hôte** : `redactState()` retire `secret`, `hunt` (parcours en cours) et
  `math.result` (réponse du calcul en cours). Le film du parcours (`lastHunt`) n'est envoyé qu'après la capture.
  Limite assumée : l'hôte possède le secret en mémoire (jeu familial).
- **Réglages d'affichage locaux** (`NET_LOCAL_KEYS` : langue, son, animations, ℹ️…) et sélection du numéro :
  jamais écrasés par l'état reçu. Fenêtres partagées : pause, attente d'un joueur ; les autres sont locales.
- Une partie Wi-Fi n'est jamais reprise après un redémarrage de l'application (retour à l'accueil).

## Contrat du transport `window.NumeroNet`

Fourni par `NetBridge.java` (Android) ; simulé par les tests (`tests/game.test.cjs`, section 3k).

| Méthode | Rôle |
|---|---|
| `hostStart(code)` | Serveur TCP (port libre) + annonce NSD/mDNS du service `NEF-<code>` (type `_nefgame._tcp`) |
| `joinStart(code)` | Recherche `NEF-<code>` sur le réseau (12 s), résolution, connexion TCP |
| `send(peer, data)` | Hôte → invité (`p1`, `p2`…) ; invité → hôte (`host`). `data` = une chaîne JSON sans saut de ligne |
| `stop()` | Ferme tout, sans événement |
| `keepAwake(bool)` | Garde l'écran allumé pendant une partie (sinon Android coupe le Wi-Fi) |

Événements reçus par le jeu : `window.__netEvent('{"type": …}')`

| `type` | Champs | Côté |
|---|---|---|
| `hosting` | `ip`, `port` | hôte |
| `peerJoined` / `peerLeft` | `peer` | hôte |
| `connected` / `disconnected` | — | invité |
| `message` | `peer`, `data` | les deux |
| `error` | `code` : `host`, `notFound`, `wifi` | les deux |

## Messages du jeu (`NET_PROTOCOL = 1`)

| Message | Sens | Contenu |
|---|---|---|
| `hello` | invité → hôte | `v` (protocole), `code`, `name`, `token` (pour revenir à sa place) |
| `welcome` | hôte → invité | `seat`, `token` |
| `lobby` | hôte → invités | `players` [{ seat, name, connected }], `started` |
| `state` | hôte → invités | `s` : copie de l'état sans secret |
| `timers` | hôte → invités | `v` : temps écoulés (2 fois par seconde) |
| `action` | invité → hôte | `name` (tab, ask, math, capture, next, reroll, pause, resume), `args` |
| `error` | hôte → invité | `code` : `version`, `code`, `started`, `full` |

Changer un message ⇒ incrémenter `NET_PROTOCOL` : deux versions différentes refusent alors de jouer ensemble.

## Coupures

- **Un invité se déconnecte** : il garde sa place ; s'il revient (« Réessayer », même code), son `token` lui rend
  la même place. Si c'était son tour, tout le monde voit « En attente de … » ; l'hôte peut **continuer sans lui**
  (ses tours sont sautés). Moins de deux joueurs présents : fin de partie.
- **L'hôte se déconnecte** : « Connexion perdue » chez les invités (Réessayer / Quitter). Pas de changement d'hôte en V1.

## Autorisations Android

`INTERNET`, `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE`, `CHANGE_WIFI_MULTICAST_STATE` : autorisations
**normales**, accordées à l'installation, **sans fenêtre de demande**. La CI refuse tout autre autorisation.

## Ce qui est testé automatiquement / ce qui ne l'est pas

Testé (Chromium, 3 téléphones simulés reliés par un faux réseau au même contrat) : salle d'attente, mauvais code,
lancement, secret absent des copies, action hors tour refusée, jeu en direct, sélection locale, capture arbitrée,
podium, chronos, langue locale, coupure pendant son tour, retour à sa place, continuer sans, relance par l'hôte,
départ de l'hôte, redémarrage. Mise en page des écrans Wi-Fi : `npm run audit:layout`.

**Non testé (impossible sans vrais téléphones)** : `NetBridge.java` lui-même (TCP, NSD). À vérifier :

1. 2 téléphones sur le Wi-Fi de la maison : créer, rejoindre par le code, jouer une partie complète.
2. 3 et 4 téléphones ; un ancien Android (8 à 10) et un récent (14–15).
3. Partage de connexion : l'hôte active son point d'accès, les autres s'y connectent.
4. Un invité éteint son écran ou quitte l'application 30 s, puis revient (Réessayer).
5. Wi-Fi « invité » / public : vérifier que le message « Partie introuvable » s'affiche (réseaux qui isolent les appareils).
6. L'hôte quitte en pleine partie.
