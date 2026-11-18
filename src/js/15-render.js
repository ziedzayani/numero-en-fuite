/*
 * Affichage : render() reconstruit tout l'écran à partir de `g`, puis bind() branche
 * les événements. Simple et sûr pour un petit jeu : il n'y a jamais d'écran « désynchronisé ».
 */

let lastScreen = null,
  enterTimer = null,
  lastModalKey = null;
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
    const bc = 'scr-' + g.screen + (g.reduceMotion ? ' reduce-motion' : '');
    if (document.body.className !== bc) document.body.className = bc;
  }
  document.title = t('title');
  const screens = { home, game, settings, end, office };
  app.innerHTML = (screens[g.screen] || end)() + modalView();
  {
    const mk = g.screen + '|' + (g.modal || ''),
      mb = app.querySelector('.modal-back');
    if (mb && mk === lastModalKey) mb.classList.add('steady');
    lastModalKey = mk;
  }
  rpSchedule();
  if (changed && !g.reduceMotion) {
    app.classList.remove('screen-enter');
    void app.offsetWidth;
    app.classList.add('screen-enter');
    clearTimeout(enterTimer);
    enterTimer = setTimeout(() => app.classList.remove('screen-enter'), 380);
  } else if (!changed) app.classList.remove('screen-enter');
  bind();
  save();
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
      render();
    })
  );
  app.querySelectorAll('[data-tab]').forEach(b =>
    b.addEventListener('click', () => {
      if (g.helpUsed && b.dataset.tab !== 'guess') return;
      g.tab = b.dataset.tab;
      if (g.tab === 'math' && !g.mathStarted) {
        g.mathStarted = true;
        g.mathElapsed = 0;
        lastTick = Date.now();
      }
      render();
    })
  );
  app
    .querySelectorAll('[data-question]')
    .forEach(b => b.addEventListener('click', () => ask(b.dataset.question)));
  app.querySelectorAll('[data-guess]').forEach(b =>
    b.addEventListener('click', () => {
      if (g.capturing || g.phase !== 'choose') return;
      g.sel = Number(b.dataset.guess);
      sfx('select');
      render();
    })
  );
  click('capPrecise', () => launchCapture('precise'));
  click('capNet', () => launchCapture('net'));
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
  click('rpClose', () => {
    g.rpPlaying = false;
    g.modal = null;
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
    .forEach(b => b.addEventListener('click', () => mathAnswer(Number(b.dataset.math))));
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
    if (g.players > 1) g.starter = ((g.starter || 0) + 1) % g.players;
    start();
  });
  click('quitYes', () => {
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
  click('menu', () => {
    g.screen = 'home';
    g.last = null;
    g.modal = null;
    render();
  });
  click('pause', () => {
    sfx('tap');
    g.modal = 'pause';
    render();
  });
  click('resumeGame', () => {
    sfx('tap');
    g.modal = null;
    lastTick = Date.now();
    render();
  });
  click('pauseSettings', () => {
    g.settingsFrom = 'game';
    g.screen = 'settings';
    render();
  });
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
  click('next', nextTurn);
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
  click('reroll', () => {
    if (g.rerolled || g.helpUsed || g.phase !== 'choose') return;
    makeChoices();
    g.rerolled = true;
    render();
  });
}
