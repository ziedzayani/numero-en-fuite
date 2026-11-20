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
  tipAfterMove(shift);
  render();
}
/** Défi : utilise un gel s'il en reste (null = illimité). */
function useFreeze() {
  if (g.chFreezes == null) return true;
  if (g.chFreezes <= 0) return false;
  g.chFreezes--;
  return true;
}
/**
 * Défi Difficile : après un calcul juste, le joueur CHOISIT sa question parmi les 3 du tour
 * (au lieu de recevoir le meilleur seuil). Puis gel s'il en reste, sinon le numéro bouge.
 */
function mathPick(id) {
  const x = g.last;
  if (
    g.screen !== 'game' ||
    g.phase !== 'result' ||
    !x ||
    x.type !== 'math' ||
    !x.pick ||
    !g.choices.includes(id)
  )
    return;
  const q = qbyid(id);
  if (!q) return;
  const answer = !!q.test(g.secret);
  g.candidates = g.candidates.filter(n => !!q.test(n) === answer);
  const frozen = useFreeze(),
    shift = frozen ? 0 : nextMove();
  g.last = { ...x, pick: false, qid: id, answer, frozen, shift };
  pushHist();
  sfx('move');
  if (frozen) maybeTip('chFreeze');
  else tipAfterMove(shift);
  render();
}
/** Défi : « Laisser filer » — pas de capture ce tour-ci (aucune pénalité), le numéro bouge. */
function passTurn() {
  if (g.screen !== 'game' || g.phase !== 'choose' || g.mode !== 'challenge') return;
  g.sel = null;
  g.capturing = null;
  const shift = nextMove();
  g.last = { type: 'pass', player: active(), shift };
  pushHist();
  sfx('move');
  g.phase = 'result';
  g.showHints = false;
  tipAfterMove(shift);
  render();
}
/** Tir précis sur le numéro n. */
/*
 * V9.19 : pronostics des spectateurs (Wi-Fi). Pendant le tour d'un autre, chacun place EN SECRET un petit filet
 * (même largeur que le filet magique) : « où sera le numéro quand il capturera ? ». Au moment de la capture
 * (ou de la fin du chrono), chaque pronostic juste rapporte +1 ⭐. L'hôte n'envoie à chacun que son pronostic.
 */
const turnOver = () =>
  g.phase === 'result' &&
  !!g.last &&
  ['found', 'netHit', 'wrong', 'netMiss', 'timeout', 'pass'].includes(g.last.type);
function pronoAllowed(seat) {
  return (
    !!g.net && g.screen === 'game' && seat !== active() && !isAbsent(seat) && seat < g.players && !turnOver()
  );
}
function setProno(seat, n) {
  n = Number(n);
  if (!pronoAllowed(seat) || !(n >= 1 && n <= maxN())) return;
  g.prono = { ...(g.prono || {}), [seat]: netRange(n) };
  render();
}
/** Juste avant la capture : pronostics gagnants (+1 ⭐), puis plus de pronostic pour ce tour. */
function pronoSettle() {
  if (!g.net || !g.prono) return;
  const hits = Object.entries(g.prono)
    .filter(([s, nums]) => Number(s) !== active() && Array.isArray(nums) && nums.includes(g.secret))
    .map(([s]) => Number(s));
  hits.forEach(s => (g.stars[s] = (g.stars[s] || 0) + 1));
  g.pronoHits = hits;
  g.prono = {};
}
function guess(n) {
  if (g.screen !== 'game' || g.phase !== 'choose' || n < 1 || n > maxN()) return;
  pronoSettle();
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
  pronoSettle();
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
/**
 * Après une capture : plus de fenêtre « Revoir l'évasion du numéro ? » (V9.4) — le bouton
 * « Revoir son parcours » est déjà dans le résultat et sur l'écran de fin.
 */
function offerReplay() {}
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
  const ch = g.mode === 'challenge',
    choosing = ch && correct && chRules().pickClue; // Difficile : le joueur choisira sa question
  if (correct) {
    g.stars[player]++;
    if (!choosing) {
      const c = [...g.candidates].sort((a, b) => a - b);
      if (c.length > 1) g.math.threshold = c[Math.floor((c.length - 1) / 2)];
      answer = g.secret > g.math.threshold;
      g.candidates = g.candidates.filter(n => n > g.math.threshold === answer);
    }
  }
  g.helpUsed = true;
  g.helpKind = 'math';
  g.lastPick = ans;
  sfx(correct ? 'good' : 'bad');
  // Défi V8.18 : gels comptés en Moyen (3) et Difficile (1) ; sans gel, le numéro bouge quand même
  const frozen = ch && correct && !choosing && useFreeze();
  let chBonus = 0;
  if (ch) {
    if (correct) {
      g.chStreak = (g.chStreak || 0) + 1;
      chBonus = CHALLENGE_SCORE.goodMath; // le combo (g.chStreak) n'est qu'un effet visuel
      if (g.chKind === 'timed') g.chElapsed = Math.max(0, g.chElapsed - CHALLENGE_SCORE.timeRefundMs);
    } else g.chStreak = 0;
  }
  if (choosing) {
    // le saut (ou le gel) attend que le joueur ait choisi sa question : voir mathPick()
    g.last = {
      type: 'math',
      player,
      picked: ans,
      correct,
      pick: true,
      chBonus,
      streak: g.chStreak || 0,
      math: { ...g.math }
    };
    g.phase = 'result';
    g.showHints = false;
    render();
    return;
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
  if (frozen) maybeTip('chFreeze');
  else tipAfterMove(shift);
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
/**
 * Fin de partie alors que le numéro court toujours : on révèle où il était et on prépare
 * le film de son évasion (bouton 🎬 sur l'écran de fin).
 */
function revealEscaped() {
  g.escaped = { n: g.secret };
  // pas un seul saut depuis le dernier numéro : rien à montrer (et surtout pas le film d'une capture précédente)
  g.lastHunt =
    g.hunt && g.hunt.steps.length
      ? { start: g.hunt.start, steps: g.hunt.steps, end: { type: 'escaped', n: g.secret }, max: maxN() }
      : null;
}
/**
 * V9.16 : fin d'une manche d'une série. Gagnant(s) : 1re place de la Course, ou meilleur total aux Points
 * (seulement si quelqu'un a attrapé le numéro : sinon, manche nulle). Une seule fois par partie (gameId).
 */
/** Gagnant(s) d'une partie à plusieurs : 1er de la Course, ou meilleur total aux Points (si capture). */
function roundWinners() {
  if (isTeams()) return teamWinners(); // V9.22 : les deux membres de l'équipe gagnante
  if (isRace()) return g.placed.filter(p => placeFor(p.round) === 1).map(p => p.player);
  if (!g.captures) return [];
  const tot = g.scores.map((v, i) => v + (g.stars[i] || 0)),
    best = Math.max(...tot);
  return tot.map((v, i) => (v === best ? i : -1)).filter(i => i >= 0);
}
function seriesRecord() {
  const s = g.series;
  if (!s || g.players < 2 || s.recorded === g.gameId) return;
  s.recorded = g.gameId;
  const win = roundWinners();
  win.forEach(i => (s.wins[i] = (s.wins[i] || 0) + 1));
  s.last = win;
  s.done = Math.max(...s.wins) >= s.target;
}
/** Fin de la course : premier(s) du podium vainqueur(s) ; `escaped` : des joueurs cherchaient encore. */
function finishRace(escaped = false) {
  if (escaped) revealEscaped();
  const first = g.placed[0];
  g.raceWinner = first ? first.player : null;
  g.raceTurns = first ? first.turn : g.turn;
  g.screen = 'end';
  g.inGame = false;
  g.modal = null;
  g.netReady = [];
  seriesRecord();
  versusRecord();
  sfx('win');
}
/*
 * Astuces « première fois » : le détective explique une règle au moment où elle sert,
 * UNE seule fois par appareil (g.tipsSeen, conservé d'une partie à l'autre). Pendant l'astuce,
 * les chronos sont en pause (c'est une fenêtre). Jamais en multijoueur Wi-Fi.
 */
const TIP_KEYS = ['moved', 'net', 'chFreeze', 'mirror', 'double', 'hidden', 'mod101'];
function maybeTip(key) {
  if (g.net || g.screen !== 'game' || g.modal || (g.tipsSeen || {})[key]) return;
  g.tipsSeen = { ...(g.tipsSeen || {}), [key]: true };
  g.tipKey = key;
  g.modal = 'tip';
}
/** Après un déplacement : astuce sur le miroir / le double (Génie, Défi), sinon sur la fuite elle-même. */
function tipAfterMove(shift) {
  const ops = shift && shift.op === 'seq' ? shift.steps.map(x => x.op) : [shift && shift.op];
  if (ops.includes('±')) maybeTip('hidden');
  else if (ops.includes('mirror')) maybeTip('mirror');
  else if (ops.includes('×m')) maybeTip('mod101');
  else if (ops.includes('×') || ops.includes('÷')) maybeTip('double');
  else if (shift) maybeTip('moved');
}

/** Onglet Indice / Calcul / Deviner ; ouvrir « Calcul » lance son chrono. */
function setTab(tab) {
  if (!['question', 'math', 'guess'].includes(tab) || (g.helpUsed && tab !== 'guess')) return;
  g.tab = tab;
  if (tab === 'guess' && netAvailable()) maybeTip('net');
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
  resume: resumeGame,
  prono: (n, seat) => setProno(seat == null ? (g.net ? g.net.seat : 0) : seat, n),
  duelPick: (kind, n) => duelPick(g.net ? g.net.seat : 0, kind, n),
  duelNext: () => duelNext()
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
      finishRace(left.length > 0);
      render();
      return;
    }
  }
  if ((g.limit && g.turn >= g.limit) || (g.players > 1 && present.length < 2)) {
    g.raceWinner = null;
    g.soloWon = false;
    g.soloSecret = g.secret;
    revealEscaped();
    if (g.players === 1 && g.mode !== 'challenge') settleSolo(false); // 12 tours joués : +10 XP
    if (g.players === 1) dailyRecord(false);
    g.screen = 'end';
    g.inGame = false;
    g.modal = null;
    g.netReady = [];
    seriesRecord();
    versusRecord();
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
  if (g.phase !== 'result' || (g.last && g.last.pick)) return; // Difficile : question à choisir d'abord
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
    // Course (V9.7) : le premier qui attrape le numéro gagne, la partie s'arrête (pas de main aux autres).
    g.placed.push({ player: g.last.player, round: raceRound(), turn: g.turn + 1, seen: [g.last.player] });
    finishRace(false);
    render();
    return;
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
    dailyRecord(true);
    g.screen = 'end';
    g.inGame = false;
    g.modal = null;
    sfx('win');
    render();
    return;
  }
  advanceTurn();
}
