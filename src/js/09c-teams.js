/*
 * V9.22 : ÉQUIPES 2 CONTRE 2 (Wi-Fi, exactement 4 joueurs). Ordre de jeu = sièges 1, 2, 3, 4 :
 * les équipes alternent (sièges 1 et 3 = équipe bleue, 2 et 4 = équipe dorée). Règles de la Course :
 * la première équipe qui attrape le numéro gagne.
 * Vraie coopération : la RÉPONSE d'une question (ou du calcul) n'est envoyée qu'aux deux téléphones de
 * l'équipe qui l'a obtenue ; l'équipe adverse voit la question, pas la réponse (🤫). Chaque équipe a donc
 * son propre carnet de numéros possibles ; les captures ratées et les sauts restent publics.
 */
const isTeams = () => g.gameMode === 'teams' && g.players === 4;
const teamOf = seat => seat % 2;
const myTeam = () => (g.net ? teamOf(g.net.seat) : 0);
const teamName = team => t(team ? 'teamB' : 'teamA');

/** Numéros possibles pour une équipe : on rejoue l'historique depuis la dernière capture avec SES indices. */
function teamCandidates(team) {
  const h = g.history || [],
    max = maxN();
  let from = 0;
  for (let i = h.length - 1; i >= 0; i--)
    if (['found', 'netHit'].includes(h[i].type)) {
      from = i + 1;
      break;
    }
  let S = all(max);
  for (const e of h.slice(from)) {
    const mine = teamOf(e.player) === team;
    const q = e.qid ? qbyid(e.qid) : null;
    if (e.type === 'question' && mine && q && e.answer != null) S = S.filter(n => !!q.test(n) === e.answer);
    else if (e.type === 'math' && e.correct && mine && e.answer != null)
      S = S.filter(n => (q ? !!q.test(n) : n > e.math.threshold) === e.answer);
    else if (e.type === 'wrong') S = S.filter(n => n !== e.n);
    else if (e.type === 'netMiss') S = S.filter(n => !e.nums.includes(n));
    if (e.shift != null && e.shift !== 0) S = moveImage(S, e.shift);
  }
  return S.includes(g.secret) || g.secret == null ? S : [...S, g.secret].sort((a, b) => a - b);
}
/** Ce que CE téléphone sait (carnet, aide) : en équipes, seulement les indices de son équipe. */
function knownCands() {
  if (!isTeams() || !g.net) return g.candidates;
  return g.net.role === 'host' ? teamCandidates(myTeam()) : g.candidates;
}
/** La réponse de cet événement est-elle cachée à ce téléphone ? (indice de l'équipe adverse) */
function hiddenFor(e) {
  if (!isTeams() || !g.net || !e || !['question', 'math'].includes(e.type)) return false;
  return e.hidden === true || teamOf(e.player) !== myTeam();
}
/** Copie d'un événement pour l'équipe `team` : réponse retirée si l'indice est à l'autre équipe. */
function maskFor(e, team) {
  if (!e || !['question', 'math'].includes(e.type) || teamOf(e.player) === team) return e;
  return { ...e, answer: null, hidden: true };
}
/** Gagnants en équipes : les deux membres de l'équipe qui a attrapé le numéro (ou au meilleur total). */
function teamWinners() {
  let team = null;
  if (isRace()) {
    const first = g.placed[0];
    if (first) team = teamOf(first.player);
  } else if (g.captures) {
    const sum = [0, 1].map(tm =>
      g.scores.reduce((a, s, i) => a + (teamOf(i) === tm ? s + (g.stars[i] || 0) : 0), 0)
    );
    team = sum[0] === sum[1] ? null : sum[0] > sum[1] ? 0 : 1;
  }
  return team == null ? [] : [0, 1, 2, 3].filter(i => teamOf(i) === team);
}
/** Pastille d'équipe (sur les pastilles des joueurs). */
const teamDot = i =>
  isTeams() ? `<i class="team-dot t${teamOf(i)}" title="${esc(teamName(teamOf(i)))}"></i>` : '';
/** Composition des équipes (salle d'attente, écran de fin). */
function teamsLine(names) {
  const n = i => esc(names[i] || t('player', { n: i + 1 }));
  return `<div class="teams-line"><span class="tl t0">🔵 ${t('teamA')} : ${n(0)} + ${n(2)}</span><span class="tl t1">🟡 ${t('teamB')} : ${n(1)} + ${n(3)}</span></div>`;
}
