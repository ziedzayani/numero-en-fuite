/*
 * Affichage : render() reconstruit tout l'écran à partir de `g`, puis bind() branche
 * les événements. Simple et sûr pour un petit jeu : il n'y a jamais d'écran « désynchronisé ».
 */

let lastScreen = null,
  enterTimer = null,
  lastModalKey = null;
/**
 * Accueil : le logo prend la place qui reste, pour que tout tienne sans défiler
 * quelles que soient la taille de l'écran, la langue et le mode (Solo / À plusieurs).
 */
function fitLogo() {
  const el = document.querySelector('.logo-art');
  if (!el) return;
  el.style.width = '';
  // hauteur de mise en page (sans les animations) + 6 px de marge pour le flottement du logo
  const over = app.offsetHeight + 6 - innerHeight;
  if (over <= 0) return;
  const h = el.getBoundingClientRect().height;
  el.style.width = Math.round((Math.max(96, h - over) * 640) / 488) + 'px';
}
addEventListener('resize', fitLogo);
/** Redessine l'écran courant + la fenêtre ouverte, puis sauvegarde. */
function render() {
  if (g.screen === 'home') restoreFromChallenge();
  const changed = g.screen !== lastScreen;
  if (changed) {
    lastScreen = g.screen;
    setTimeout(() => window.scrollTo(0, 0), 0);
  }
  if (g.screen === 'game' && g.phase === 'choose' && g.helpUsed && g.tab !== 'guess') g.tab = 'guess';
  document.documentElement.lang = g.lang;
  document.documentElement.dir = g.lang === 'ar' ? 'rtl' : 'ltr';
  {
    const bc =
      'scr-' +
      g.screen +
      (g.reduceMotion ? ' reduce-motion' : '') +
      (g.net && !myTurn() ? ' net-spectator' : '') +
      (g.net && g.net.role === 'client' ? ' net-client' : '');
    if (document.body.className !== bc) document.body.className = bc;
  }
  document.title = t('title');
  const screens = { home, game, settings, end, office, lan: lanScreen };
  app.innerHTML = (screens[g.screen] || end)() + modalView();
  {
    const mk = g.screen + '|' + (g.modal || ''),
      mb = app.querySelector('.modal-back');
    if (mb && mk === lastModalKey) mb.classList.add('steady');
    lastModalKey = mk;
  }
  fitLogo();
  rpSchedule();
  if (changed && !g.reduceMotion) {
    app.classList.remove('screen-enter');
    void app.offsetWidth;
    app.classList.add('screen-enter');
    clearTimeout(enterTimer);
    enterTimer = setTimeout(() => app.classList.remove('screen-enter'), 380);
  } else if (!changed) app.classList.remove('screen-enter');
  bind();
  countUp();
  save();
  netBroadcast(); // hôte Wi-Fi : chaque changement est envoyé aux autres téléphones
}
/**
 * Score de fin qui défile de 0 à sa valeur (V8.15), une seule fois par partie ;
 * jamais si les animations sont réduites (la valeur finale est déjà écrite dans la page).
 */
let countAnim = null; // { id, t0, to, dur } : survit aux ré-affichages pendant l'animation
function countUp() {
  const el = app.querySelector('[data-count]');
  if (!el || g.reduceMotion) return;
  const id = el.dataset.countId,
    to = Number(el.dataset.count) || 0;
  if (!id || to <= 0) return;
  if (!(countAnim && countAnim.id === id)) {
    if (g.countedId === id) return; // déjà vu (retour sur l'écran, redémarrage) : valeur finale
    g.countedId = id;
    countAnim = { id, t0: performance.now(), to, dur: Math.min(1400, 500 + to) };
  }
  const a = countAnim;
  const step = now => {
    if (!el.isConnected) return; // l'écran a été redessiné : le nouvel élément reprend l'animation
    const k = Math.min(1, (now - a.t0) / a.dur);
    el.textContent = String(Math.round(a.to * (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(step);
  };
  step(performance.now());
}
/** Branche les clics des éléments de l'écran (identifiants et attributs data-*). */
function bind() {
  const click = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  };
  app.querySelectorAll('[data-players]').forEach(b =>
    b.addEventListener('click', () => {
      g.players = Number(b.dataset.players);
      if (g.players > 1) g.lastMulti = g.players;
      render();
    })
  );
  app.querySelectorAll('[data-level]').forEach(b =>
    b.addEventListener('click', () => {
      g.level = b.dataset.level;
      render();
    })
  );
  app.querySelectorAll('[data-language]').forEach(b =>
    b.addEventListener('click', () => {
      g.lang = b.dataset.language;
      if (g.modal === 'lang') closeLang();
      render();
    })
  );
  // Actions de jeu : passent par act() (multijoueur Wi-Fi : envoyées à l'hôte, seul arbitre).
  app
    .querySelectorAll('[data-tab]')
    .forEach(b => b.addEventListener('click', () => act('tab', b.dataset.tab)));
  app
    .querySelectorAll('[data-question]')
    .forEach(b => b.addEventListener('click', () => act('ask', b.dataset.question)));
  app.querySelectorAll('[data-guess]').forEach(b =>
    b.addEventListener('click', () => {
      if (g.capturing || g.phase !== 'choose') return;
      g.sel = Number(b.dataset.guess);
      sfx('select');
      render();
    })
  );
  click('capPrecise', () => act('capture', 'precise', g.sel));
  click('capNet', () => act('capture', 'net', g.sel));
  click('motionToggle', () => {
    g.reduceMotion = !g.reduceMotion;
    render();
  });
  click('replayToggle', () => {
    g.replayAsk = g.replayAsk === false;
    render();
  });
  click('rpYes', () => {
    sfx('tap');
    openReplay();
  });
  click('openReplay', () => {
    sfx('tap');
    openReplay();
  });
  click('rpNo', () => {
    g.modal = null;
    render();
  });
  click('rpNever', () => {
    g.replayAsk = false;
    g.modal = null;
    render();
  });
  click('rpModeAuto', () => {
    g.rpAuto = true;
    const n = rpFrames().length;
    if ((g.rpIdx || 0) >= n - 1) g.rpIdx = 0;
    g.rpPlaying = true;
    render();
  });
  click('rpModeManual', () => {
    g.rpAuto = false;
    g.rpPlaying = false;
    render();
  });
  // V9.4 : abandon → on peut revoir le parcours du numéro jusqu'ici, puis revenir à « Quitter la partie ? »
  click('quitFilm', () => {
    g.quitSeen = true; // le film révèle le numéro : la partie ne peut plus reprendre
    g.rpQuitHunt = g.lastHunt || null;
    g.lastHunt = {
      start: g.hunt.start,
      steps: g.hunt.steps,
      end: { type: 'escaped', n: g.secret },
      max: maxN()
    };
    g.rpFromQuit = true;
    sfx('tap');
    openReplay();
  });
  click('rpClose', () => {
    g.rpPlaying = false;
    g.modal = null;
    if (g.rpFromQuit) {
      g.rpFromQuit = false;
      g.lastHunt = g.rpQuitHunt; // le film de la dernière capture reste disponible si on reprend
      g.rpQuitHunt = null;
      g.modal = 'quit';
    }
    render();
  });
  click('rpRestart', () => {
    g.rpIdx = 0;
    g.rpPlaying = g.rpAuto !== false;
    render();
  });
  click('rpPrev', () => {
    g.rpPlaying = false;
    g.rpIdx = Math.max(0, (g.rpIdx || 0) - 1);
    render();
  });
  click('rpNext', () => {
    g.rpPlaying = false;
    g.rpIdx = Math.min(rpFrames().length - 1, (g.rpIdx || 0) + 1);
    render();
  });
  click('rpPlay', () => {
    const n = rpFrames().length;
    if (!g.rpPlaying && (g.rpIdx || 0) >= n - 1) g.rpIdx = 0;
    g.rpPlaying = !g.rpPlaying;
    render();
  });
  app
    .querySelectorAll('[data-math]')
    .forEach(b => b.addEventListener('click', () => act('math', Number(b.dataset.math))));
  click('start', () => {
    sfx('tap');
    g.modal = 'names';
    render();
  });
  app.querySelectorAll('[data-name]').forEach(el =>
    el.addEventListener('input', () => {
      g.names[+el.dataset.name] = el.value.slice(0, 12);
    })
  );
  app.querySelectorAll('[data-phelp]').forEach(b =>
    b.addEventListener('click', () => {
      const i = +b.dataset.phelp;
      g.playerHelp[i] = !g.playerHelp[i];
      b.classList.toggle('on', g.playerHelp[i]);
      b.setAttribute('aria-checked', g.playerHelp[i]);
      sfx('tap');
      save();
    })
  );
  app.querySelectorAll('[data-gmode]').forEach(b =>
    b.addEventListener('click', () => {
      g.gameMode = b.dataset.gmode;
      app.querySelectorAll('[data-gmode]').forEach(x => {
        x.classList.toggle('on', x === b);
        x.setAttribute('aria-checked', x === b);
      });
      sfx('tap');
      save();
    })
  );
  app.querySelectorAll('[data-series]').forEach(b =>
    b.addEventListener('click', () => {
      g.seriesPref = Number(b.dataset.series) || 0;
      app.querySelectorAll('[data-series]').forEach(x => {
        x.classList.toggle('on', x === b);
        x.setAttribute('aria-checked', x === b);
      });
      sfx('tap');
      save();
    })
  );
  click('namesGo', () => {
    for (let i = 0; i < g.players; i++) {
      const el = document.getElementById('name' + i);
      if (el) g.names[i] = el.value.replace(/\s+/g, ' ').trim().slice(0, 12);
    }
    if (g.players === 1) g.starter = 0;
    g.modal = null;
    sfx('tap');
    const ae = document.activeElement;
    if (ae && ae.blur) ae.blur();
    if (g.namesStarting) return;
    g.namesStarting = true;
    setTimeout(() => {
      g.namesStarting = false;
      start(true);
    }, 120);
  });
  click('again', () => {
    sfx('tap');
    if (g.mode === 'challenge') return startChallenge(g.chKind, g.chDiff);
    // V9.16 Wi-Fi : « Rejouer » = « je suis prêt » ; la revanche part quand tout le monde est prêt
    if (g.net) return netAgain();
    if (g.players > 1) g.starter = ((g.starter || 0) + 1) % g.players;
    g.seriesContinue = true; // « Manche suivante » : la série continue (si elle n'est pas finie)
    start();
  });
  click('shareWin', () => shareVictory()); // V9.18 : carte de victoire
  click('quitYes', () => {
    g.quitSeen = false;
    if (g.net) return netLeave();
    g.modal = null;
    g.inGame = false;
    g.screen = 'home';
    render();
  });
  click('quitNo', () => {
    g.modal = 'pause';
    render();
  });
  click('askQuit', () => {
    g.modal = 'quit';
    render();
  });
  click('handoffGo', () => {
    sfx('tap');
    markRaceNewsSeen(active()); // l'annonce « X a trouvé le numéro » n'est montrée qu'une fois
    g.modal = null;
    lastTick = Date.now();
    render();
  });
  app.querySelectorAll('[data-timer]').forEach(b =>
    b.addEventListener('click', () => {
      g.timerMode = b.dataset.timer;
      render();
    })
  );
  // Mes progrès : sauvegarde de secours
  const setBackup = b => {
    g.backup = b;
    g.modal = b ? 'backup' : null;
    sfx('tap');
    render();
  };
  click('openLang', () => {
    g.langFrom = g.modal; // ex. 'pause' quand on vient d'une partie : rétablie à la fermeture
    g.modal = 'lang';
    sfx('tap');
    render();
  });
  click('closeLang', () => {
    closeLang();
    render();
  });
  click('openBackup', () => setBackup({ view: 'menu' }));
  click('backupClose', () => setBackup(null));
  click('backupExport', () => setBackup({ view: 'export', code: exportProgress() }));
  click('backupImport', () => setBackup({ view: 'import' }));
  click('backupCopy', () => {
    const ta = document.getElementById('backupCode');
    const done = () => setBackup({ ...g.backup, copied: true });
    ta.select();
    try {
      document.execCommand('copy'); // fonctionne dans la WebView Android (pas de contexte sécurisé)
    } catch (e) {}
    if (navigator.clipboard && window.isSecureContext)
      navigator.clipboard.writeText(ta.value).then(done, done);
    else done();
  });
  click('backupCheck', () => {
    const input = (document.getElementById('backupInput') || {}).value || '';
    const r = readBackup(input);
    setBackup(
      r.ok ? { view: 'confirm', input, summary: r.summary } : { view: 'import', input, error: r.error }
    );
  });
  click('backupApply', () => {
    const b = g.backup;
    if (importProgress(b.input)) setBackup({ view: 'done', summary: b.summary });
    else setBackup({ view: 'import', input: b.input, error: 'damaged' });
  });
  click('soundToggle', () => {
    g.sound = !g.sound;
    render();
    sfx('tap');
  });
  click('openOffice', () => {
    g.officeFrom = g.screen === 'end' ? 'end' : 'home';
    g.screen = 'office';
    g.modal = null;
    sfx('tap');
    render();
  });
  app.querySelectorAll('[data-olevel]').forEach(b =>
    b.addEventListener('click', () => {
      g.officeLevel = b.dataset.olevel;
      sfx('tap');
      render();
    })
  );
  app.querySelectorAll('[data-otab]').forEach(b =>
    b.addEventListener('click', () => {
      g.officeTab = b.dataset.otab;
      sfx('tap');
      render();
    })
  );
  click('closeOffice', () => {
    g.screen = g.officeFrom === 'end' && g.soloResult ? 'end' : 'home';
    sfx('tap');
    render();
  });
  click('officePlay', () => {
    // solo, au dernier niveau joué : on passe par la fenêtre « Prêt ? » habituelle
    g.players = 1;
    g.mode = 'normal';
    g.screen = 'home';
    g.modal = 'names';
    sfx('tap');
    render();
  });
  click('homeMulti', () => {
    // À plusieurs : on reprend le dernier nombre de joueurs choisi (2 par défaut)
    g.players = Math.max(2, g.lastMulti || 2);
    sfx('tap');
    render();
  });
  // Défi V8.18 : question offerte par le calcul (Difficile) et « Laisser filer »
  app
    .querySelectorAll('[data-mpick]')
    .forEach(b => b.addEventListener('click', () => mathPick(b.dataset.mpick)));
  click('passTurn', passTurn);
  click('tipOk', () => {
    g.modal = null;
    lastTick = Date.now(); // le temps passé à lire l'astuce n'est pas décompté
    sfx('tap');
    render();
  });
  click('openMore', () => {
    g.modal = 'more';
    sfx('tap');
    render();
  });
  click('openOffice2', () => {
    g.officeFrom = 'home';
    g.screen = 'office';
    sfx('tap');
    render();
  });
  bindNet(click);
  click('menu', () => {
    if (g.net) return netLeave();
    g.screen = 'home';
    g.last = null;
    g.modal = null;
    render();
  });
  click('pause', () => act('pause'));
  click('resumeGame', () => act('resume'));
  click('pauseSettings', () => {
    g.settingsFrom = 'game';
    g.screen = 'settings';
    render();
  });
  // Carnet « à la main » (V8.14) : onglets, numéros barrés par l'enfant, plages, décalage des marques
  const nbDo = fn => () => {
    fn();
    sfx('tap');
    render();
  };
  app.querySelectorAll('[data-nbtab]').forEach(b =>
    b.addEventListener(
      'click',
      nbDo(() => (g.nbTab = b.dataset.nbtab))
    )
  );
  app.querySelectorAll('[data-mark]').forEach(b =>
    b.addEventListener(
      'click',
      nbDo(() => toggleMark(Number(b.dataset.mark)))
    )
  );
  app.querySelectorAll('[data-range]').forEach(b =>
    b.addEventListener(
      'click',
      nbDo(() => toggleRange(...b.dataset.range.split('-').map(Number)))
    )
  );
  app.querySelectorAll('[data-zoom]').forEach(b =>
    b.addEventListener(
      'click',
      nbDo(() => (g.nbZoom = g.nbZoom === Number(b.dataset.zoom) ? null : Number(b.dataset.zoom)))
    )
  );
  click('shiftMarks', nbDo(shiftMarks));
  click('clearMarks', nbDo(clearMarks));
  click('openNotebook', () => {
    g.modal = 'notebook';
    render();
  });
  click('openRules', () => {
    g.modal = 'rules';
    render();
  });
  click('openChallenge', () => {
    g.modal = 'challenge';
    render();
  });
  app.querySelectorAll('[data-chdiff]').forEach(b =>
    b.addEventListener('click', () => {
      g.chDiffPref = b.dataset.chdiff;
      sfx('tap');
      render();
    })
  );
  click('openTutorial', openTutorial);
  click('rulesTutorial', openTutorial);
  click('inviteTutorial', openTutorial);
  click('tutRestart', openTutorial);
  click('tutNext', tutNext);
  click('tutAsk', tutNext);
  click('tutPrecise', () => tutCapture('precise'));
  click('tutNet', () => tutCapture('net'));
  click('tutClose', () => {
    g.modal = null;
    g.tut = null;
    render();
  });
  click('tutPlay', () => {
    g.tut = null;
    g.modal = 'names';
    render();
  });
  app.querySelectorAll('[data-tutpick]').forEach(b =>
    b.addEventListener('click', () => {
      if (g.tut.step === TUT_STEPS.indexOf('loop')) return tutLoopPick(Number(b.dataset.tutpick));
      g.tut.sel = Number(b.dataset.tutpick);
      g.tut.miss = null;
      sfx('tap');
      render();
    })
  );
  click('chTimed', () => startChallenge('timed'));
  click('chEndless', () => startChallenge('endless'));
  app.querySelectorAll('[data-key]').forEach(b => b.addEventListener('click', () => pressKey(b.dataset.key)));
  click('closeModal', () => {
    g.modal = null;
    lastTick = Date.now();
    render();
  });
  click('openSettings', () => {
    g.settingsFrom = g.screen;
    g.screen = 'settings';
    render();
  });
  const close = () => {
    g.screen = ['home', 'game', 'end'].includes(g.settingsFrom) ? g.settingsFrom : 'home';
    render();
  };
  click('closeSettings', close);
  click('next', () => act('next'));
  click('history', () => {
    g.showHistory = !g.showHistory;
    render();
  });
  click('hints', () => {
    g.showHints = !g.showHints;
    render();
  });
  app.querySelectorAll('[data-info]').forEach(b =>
    b.addEventListener('click', () => {
      g.showInfo = !g.showInfo;
      sfx('tap');
      render();
    })
  );
  click('reroll', () => act('reroll'));
}
