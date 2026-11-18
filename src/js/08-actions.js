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
const netSize = () => (LEVELS[g.level] || LEVELS.expert).netSize;
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
  if (g.replayAsk === false) return;
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
      chBonus = 30 + 10 * (g.chStreak - 1);
      g.chBonus = (g.chBonus || 0) + chBonus;
      if (g.chKind === 'timed') g.chElapsed = Math.max(0, g.chElapsed - 15000);
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
    g.raceWinner = g.last.player;
    g.raceTurns = g.turn + 1;
    g.screen = 'end';
    g.inGame = false;
    g.modal = null;
    sfx('win');
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
    g.screen = 'end';
    g.inGame = false;
    g.modal = null;
    sfx('win');
    render();
    return;
  }
  g.turn++;
  if (g.limit && g.turn >= g.limit) {
    g.raceWinner = null;
    g.soloWon = false;
    g.soloSecret = g.secret;
    g.screen = 'end';
    g.inGame = false;
    g.modal = null;
    sfx(g.players === 1 ? 'bad' : 'win');
  } else {
    g.phase = 'choose';
    g.last = null;
    prepareTurn();
    if (g.players > 1) g.modal = 'handoff';
  }
  render();
}
