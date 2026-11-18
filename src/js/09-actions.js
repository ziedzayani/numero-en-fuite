/*
 * Actions du joueur. Chacune vérifie qu'elle est permise (écran, phase, aide déjà utilisée…)
 * puis modifie `g`, remplit g.last (ce qui vient de se passer) et appelle render().
 * Un tour : au plus UNE aide (question OU calcul), puis UNE capture (tir précis OU filet).
 */

/** Pose la question `id` : réponse oui / non, le carnet se met à jour, le numéro bouge. */
function ask(id) {
  if (g.screen !== 'game' || g.phase !== 'choose' || g.helpUsed || !g.choices.includes(id)) return;
  const q = qbyid(id);
  if (!q) return;
  const player = active(),
    answer = !!q.test(g.secret),
    shift = afterClue(n => q.test(n) === answer);
  g.helpUsed = true;
  g.helpKind = 'question';
  sfx('move');
  g.last = { type: 'question', qid: id, answer, shift, player };
  pushHist();
  g.phase = 'result';
  g.showHints = false;
  render();
}
/** Tir précis sur le numéro n. */
function guess(n) {
  if (g.screen !== 'game' || g.phase !== 'choose' || n < 1 || n > maxN()) return;
  g.sel = null;
  g.capturing = null;
  const player = active(),
    found = n === g.secret;
  sfx(found ? 'win' : 'bad');
  const bonus = g.helpKind === 'question' ? SCORE.deductionBonus : 0;
  if (found) {
    g.scores[player] += SCORE.precise + bonus;
    g.captures++;
    g.last = { type: 'found', player, n, bonus };
    pushHist();
    g.secret = 1 + rnd(maxN());
    g.candidates = all(maxN());
    g.shownIds = [];
    offerReplay();
  } else {
    g.scores[player] += SCORE.miss;
    g.candidates = g.candidates.filter(x => x !== n);
    const shift = nextMove();
    g.last = { type: 'wrong', player, n, shift };
    pushHist();
  }
  g.phase = 'result';
  g.showHints = false;
  render();
}
/* ---- Filet magique : LEVELS[niveau].netSize numéros voisins (2 au niveau Petit, 3 ailleurs). ---- */
// En défi, le filet couvre toujours 3 numéros : « Facile » ne doit pas rendre la capture plus étroite.
const netSize = () => (g.mode === 'challenge' ? 3 : (LEVELS[g.level] || LEVELS.expert).netSize);
/** Numéros couverts par le filet autour de n, sans sortir de 1…max. */
function netRange(n) {
  const k = netSize(),
    max = maxN(),
    first = Math.min(Math.max(1, k === 3 ? n - 1 : n), max - k + 1);
  return Array.from({ length: k }, (_, i) => first + i);
}
/** Lance le filet autour de n (consomme un des NETS_MAX filets du joueur). */
function netCapture(n) {
  if (g.screen !== 'game' || g.phase !== 'choose' || !(n >= 1 && n <= maxN()) || !netAvailable()) return;
  g.netsLeft[active()] = netsLeft() - 1;
  g.sel = null;
  g.capturing = null;
  const nums = netRange(n),
    player = active(),
    hit = nums.includes(g.secret);
  sfx(hit ? 'win' : 'bad');
  const bonus = g.helpKind === 'question' ? SCORE.deductionBonus : 0;
  if (hit) {
    g.scores[player] += SCORE.net + bonus;
    g.captures++;
    g.last = { type: 'netHit', player, n: g.secret, nums, bonus };
    pushHist();
    g.secret = 1 + rnd(maxN());
    g.candidates = all(maxN());
    g.shownIds = [];
    offerReplay();
  } else {
    g.scores[player] += SCORE.miss * nums.length;
    g.candidates = g.candidates.filter(x => !nums.includes(x));
    const shift = nextMove();
    g.last = { type: 'netMiss', player, nums, shift };
    pushHist();
  }
  g.phase = 'result';
  g.showHints = false;
  render();
}
/** Après une capture : propose de revoir le film du parcours (si le réglage le permet). */
function offerReplay() {
  if (g.replayAsk === false || g.net) return; // en Wi-Fi : bouton « Revoir son parcours » sur chaque téléphone
  setTimeout(
    () => {
      if (
        g.screen === 'game' &&
        g.phase === 'result' &&
        g.last &&
        ['found', 'netHit'].includes(g.last.type) &&
        !g.modal &&
        g.lastHunt
      ) {
        g.modal = 'replayAsk';
        render();
      }
    },
    g.reduceMotion ? 60 : 1500
  );
}
/** Bouton de capture : courte animation, puis guess() ou netCapture() sur le numéro sélectionné. */
function launchCapture(mode) {
  if (mode === 'net' && !netAvailable()) return;
  if (g.screen !== 'game' || g.phase !== 'choose' || g.sel == null || g.capturing || g.modal) return;
  const n = g.sel;
  g.capturing = { mode, nums: mode === 'net' ? netRange(n) : [n] };
  sfx(mode === 'net' ? 'net' : 'aim');
  render();
  const go = () => {
    if (!g.capturing) return;
    mode === 'net' ? netCapture(n) : guess(n);
  };
  if (g.reduceMotion) go();
  else setTimeout(go, 800);
}
/** Aide « numéros possibles » : activée joueur par joueur (jamais en défi). */
const helpMode = () =>
  g.mode === 'challenge' ? 'off' : g.playerHelp && g.playerHelp[active()] ? 'auto' : 'off';
const showPossible = () => helpMode() === 'auto' || (helpMode() === 'ask' && g.showHints);
/** Réponse au calcul : juste = étoile + indice (et avantages en défi). */
function mathAnswer(ans) {
  if (g.screen !== 'game' || g.phase !== 'choose' || g.helpUsed || !g.math || !g.math.options.includes(ans))
    return;
  if (g.timerMode !== 'off' && g.mathStarted && mathLeft() <= 0) return mathTimeout();
  const player = active(),
    correct = ans === g.math.result;
  let answer = null;
  if (correct) {
    g.stars[player]++;
    const c = [...g.candidates].sort((a, b) => a - b);
    if (c.length > 1) g.math.threshold = c[Math.floor((c.length - 1) / 2)];
    answer = g.secret > g.math.threshold;
    g.candidates = g.candidates.filter(n => n > g.math.threshold === answer);
  }
  g.helpUsed = true;
  g.helpKind = 'math';
  g.lastPick = ans;
  sfx(correct ? 'good' : 'bad');
  const ch = g.mode === 'challenge',
    frozen = ch && correct;
  let chBonus = 0;
  if (ch) {
    if (correct) {
      g.chStreak = (g.chStreak || 0) + 1;
      chBonus = CHALLENGE_SCORE.goodMath; // le combo (g.chStreak) n'est qu'un effet visuel
      if (g.chKind === 'timed') g.chElapsed = Math.max(0, g.chElapsed - CHALLENGE_SCORE.timeRefundMs);
    } else g.chStreak = 0;
  }
  const shift = frozen ? 0 : nextMove();
  g.last = {
    type: 'math',
    player,
    picked: ans,
    correct,
    answer,
    shift,
    frozen,
    chBonus,
    streak: g.chStreak || 0,
    math: { ...g.math }
  };
  pushHist();
  g.phase = 'result';
  g.showHints = false;
  render();
}
/*
 * Mode Course à plusieurs : un podium plutôt qu'une fin brutale.
 * Celui qui attrape le numéro prend une place ; un nouveau numéro est tiré pour les autres,
 * qui finissent le tour (une capture dans le MÊME tour = même place, ex aequo), puis continuent
 * la chasse pour les places suivantes. Personne n'est privé de son tour.
 */
/** Tour de table en cours (0, 1, 2…) : chaque joueur joue une fois par tour de table. */
const raceRound = () => Math.floor(g.turn / g.players);
/** Le joueur i est-il déjà sur le podium ? */
const isPlaced = i => (g.placed || []).some(p => p.player === i);
/** Place obtenue par une capture faite pendant le tour de table r (les captures d'un même tour sont ex aequo). */
const placeFor = r => 1 + (g.placed || []).filter(p => p.round < r).length;
/** Annonces de capture que le joueur i n'a pas encore vues (affichées dans la fenêtre « passe le téléphone »). */
const raceNewsUnseen = i => (g.placed || []).filter(p => !(p.seen || []).includes(i));
/** Le joueur i a lu les annonces : on ne les lui remontre plus. */
function markRaceNewsSeen(i) {
  for (const p of raceNewsUnseen(i)) (p.seen = p.seen || []).push(i);
}
/** Fin de la course : premier(s) du podium vainqueur(s). */
function finishRace() {
  const first = g.placed[0];
  g.raceWinner = first ? first.player : null;
  g.raceTurns = first ? first.turn : g.turn;
  g.screen = 'end';
  g.inGame = false;
  g.modal = null;
  sfx('win');
}
/** Onglet Indice / Calcul / Deviner ; ouvrir « Calcul » lance son chrono. */
function setTab(tab) {
  if (!['question', 'math', 'guess'].includes(tab) || (g.helpUsed && tab !== 'guess')) return;
  g.tab = tab;
  if (tab === 'math' && !g.mathStarted) {
    g.mathStarted = true;
    g.mathElapsed = 0;
    lastTick = Date.now();
  }
  render();
}
/** 🔀 : une seule fois par tour, avant toute aide, trois nouvelles questions. */
function rerollChoices() {
  if (g.rerolled || g.helpUsed || g.phase !== 'choose') return;
  makeChoices();
  g.rerolled = true;
  render();
}
function pauseGame() {
  if (g.screen !== 'game' || g.modal) return;
  sfx('tap');
  g.modal = 'pause';
  render();
}
function resumeGame() {
  if (g.modal !== 'pause') return;
  sfx('tap');
  g.modal = null;
  lastTick = Date.now();
  render();
}
/** Capture lancée depuis un numéro choisi (le numéro voyage avec l'action en multijoueur). */
function captureAt(mode, n) {
  n = Number(n);
  if (!(n >= 1 && n <= maxN())) return;
  g.sel = n;
  launchCapture(mode === 'net' ? 'net' : 'precise');
}
/** Actions de jeu : même table pour le joueur local, l'hôte et les messages réseau. */
const GAME_ACTIONS = {
  tab: setTab,
  ask: id => ask(String(id)),
  math: v => mathAnswer(Number(v)),
  capture: captureAt,
  next: () => nextTurn(),
  reroll: rerollChoices,
  pause: pauseGame,
  resume: resumeGame
};

/** Joueur absent (multijoueur Wi-Fi : parti sans revenir) : ses tours sont sautés. */
const isAbsent = i => (g.absent || []).includes(i);
/** Joueur dont on saute le tour : absent, ou déjà sur le podium en Course. */
const isSkipped = i => isAbsent(i) || (isRace() && g.players > 1 && isPlaced(i));
/**
 * Passe au joueur suivant (en sautant les joueurs absents ou déjà placés), ou termine la partie :
 * limite de tours, podium complet en Course, ou moins de deux joueurs encore présents.
 */
function advanceTurn() {
  const turnBefore = g.turn;
  g.turn++;
  if (g.players > 1) while (g.turn < g.limit && isSkipped(active())) g.turn++;
  const present = colors
    .slice(0, g.players)
    .map((_, i) => i)
    .filter(i => !isAbsent(i));
  if (isRace() && g.players > 1 && g.placed.length) {
    const roundEnded = Math.floor(g.turn / g.players) > Math.floor(turnBefore / g.players),
      left = present.filter(i => !isPlaced(i));
    // fin : tout le monde est placé, ou un tour complet est fini et il reste au plus un chercheur
    if (!left.length || (roundEnded && left.length <= 1) || g.turn >= g.limit) {
      finishRace();
      render();
      return;
    }
  }
  if ((g.limit && g.turn >= g.limit) || (g.players > 1 && present.length < 2)) {
    g.raceWinner = null;
    g.soloWon = false;
    g.soloSecret = g.secret;
    if (g.players === 1 && g.mode !== 'challenge') settleSolo(false); // 12 tours joués : +10 XP
    g.screen = 'end';
    g.inGame = false;
    g.modal = null;
    sfx(g.players === 1 ? 'bad' : 'win');
  } else {
    g.phase = 'choose';
    g.last = null;
    prepareTurn();
    if (g.players > 1 && !g.net) g.modal = 'handoff'; // en Wi-Fi, chacun a son téléphone
  }
  render();
}
/** Bouton « Continuer » : après une aide on reste dans le tour, sinon victoire / fin / joueur suivant. */
function nextTurn() {
  if (g.phase !== 'result') return;
  if (g.last && ['question', 'math'].includes(g.last.type)) {
    g.phase = 'choose';
    g.tab = 'guess';
    g.sel = null;
    g.typed = '';
    g.last = null;
    render();
    return;
  }
  if (g.mode === 'challenge' && g.last && ['found', 'netHit'].includes(g.last.type)) {
    finishChallenge(true);
    render();
    return;
  }
  if (isRace() && g.players > 1 && g.last && ['found', 'netHit'].includes(g.last.type)) {
    // Course : le joueur monte sur le podium (un nouveau numéro a déjà été tiré pour les autres).
    g.placed.push({ player: g.last.player, round: raceRound(), turn: g.turn + 1, seen: [g.last.player] });
  }
  if (g.mode !== 'challenge' && g.players === 1 && g.last && ['found', 'netHit'].includes(g.last.type)) {
    g.soloWon = true;
    g.soloTurns = g.turn + 1;
    {
      const k = 'solo_' + g.level,
        r = records(),
        prev = r[k];
      g.soloBest = prev || null;
      g.soloNewRecord = !prev || g.soloTurns < prev;
      if (g.soloNewRecord) {
        r[k] = g.soloTurns;
        try {
          localStorage.setItem(RECORDS_STORAGE, JSON.stringify(r));
        } catch (e) {}
      }
    }
    settleSolo(true); // score, étoiles, record par niveau, XP (une seule fois par partie)
    g.screen = 'end';
    g.inGame = false;
    g.modal = null;
    sfx('win');
    render();
    return;
  }
  advanceTurn();
}
