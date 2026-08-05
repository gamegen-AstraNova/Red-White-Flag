(() => {
  'use strict';

  const LEVELS = [
    { length: 3, bpm: 68, fakes: 0 },
    { length: 4, bpm: 70, fakes: 0 },
    { length: 5, bpm: 72, fakes: 0 },
    { length: 6, bpm: 74, fakes: 1 },
    { length: 7, bpm: 75, fakes: 1 },
    { length: 8, bpm: 76, fakes: 1 },
    { length: 9, bpm: 77, fakes: 2 },
    { length: 10, bpm: 78, fakes: 2 },
    { length: 11, bpm: 79, fakes: 3 },
    { length: 12, bpm: 80, fakes: 3 }
  ];
  const STORAGE_KEY = 'redWhiteFlagUnlocked';
  const SOUND_KEY = 'redWhiteFlagSound';
  const BGM_KEY = 'redWhiteFlagBgm';
  const CHEAT_KEY = 'redWhiteFlagCheat';
  const LANGUAGE_KEY = 'redWhiteFlagLanguage';
  const CHEAT_SEQUENCE = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  const MAX_REVIVES = 3;
  const MIN_BEAT_MS = 750;
  const EARLY_HIT_MS = 300;
  const LATE_HIT_MS = 600;
  const TEXTS = window.FLAG_GAME_I18N;
  delete window.FLAG_GAME_I18N;

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const ui = {
    levelRail: $('#levelRail'), levelNumber: $('#levelNumber'), reviveCount: $('#reviveCount'), message: $('#message'),
    statusDot: $('#statusDot'), phaseLabel: $('#phaseLabel'), character: $('#character'), beatTrack: $('#beatTrack'),
    countdown: $('#countdown'), controls: $('#controls'), controlHint: $('#controlHint'),
    redButton: $('#redButton'), whiteButton: $('#whiteButton'), soundButton: $('#soundButton'), bgmButton: $('#bgmButton'), languageSelect: $('#languageSelect'), bgmAudio: $('#bgmAudio'), demoStartSfx: $('#demoStartSfx'), playerStartSfx: $('#playerStartSfx'), galleryCount: $('#galleryCount'),
    galleryModal: $('#galleryModal'), cgViewer: $('#cgViewer'), cgGrid: $('#cgGrid'),
    cgFullImage: $('#cgFullImage'), cgFullNumber: $('#cgFullNumber'), cgFullTitle: $('#cgFullTitle'), adModal: $('#adModal'), adWait: $('#adWait'),
    reviveButton: $('#reviveButton'), failureReason: $('#failureReason'), watchAdButton: $('#watchAdButton'), unlockedCg: $('#unlockedCg'), nextButton: $('#nextButton')
  };

  let phase = 'home';
  let level = 1;
  let sequence = [];
  let revivesUsed = 0;
  let unlocked = Math.min(LEVELS.length, Math.max(0, Number(localStorage.getItem(STORAGE_KEY) || 0)));
  let cheatUnlocked = localStorage.getItem(CHEAT_KEY) === 'true';
  let cheatProgress = 0;
  let language = getInitialLanguage();
  let soundOn = localStorage.getItem(SOUND_KEY) !== 'false';
  let bgmOn = localStorage.getItem(BGM_KEY) !== 'false';
  let audioContext = null;
  let scheduled = [];
  let adLoop = null;
  let beatMs = 800;
  let playerAnchor = 0;
  let hitBeats = new Set();
  let messageState = { key: 'homeMessage', vars: {} };
  let failureState = { key: 'failDefault', vars: {} };
  let adSeconds = 3;
  let viewedCg = 1;

  if (cheatUnlocked) unlocked = LEVELS.length;

  function getInitialLanguage() {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    if (TEXTS[saved]) return saved;
    const browser = navigator.language.toLowerCase();
    if (browser.startsWith('ja')) return 'ja';
    if (browser.startsWith('zh-cn') || browser.startsWith('zh-sg')) return 'zh-CN';
    return browser.startsWith('zh') ? 'zh-TW' : 'en';
  }

  function t(key, vars = {}) {
    const value = TEXTS[language][key] ?? TEXTS['zh-TW'][key] ?? key;
    if (typeof value !== 'string') return value;
    return Object.entries(vars).reduce((text, [name, replacement]) => text.split(`{${name}}`).join(replacement), value);
  }

  function cgTitle(number) { return t('cgTitles')[number - 1]; }

  function renderMessage() {
    ui.message.textContent = t(messageState.key, messageState.vars);
  }

  function setMessage(key, vars = {}) {
    messageState = { key, vars };
    renderMessage();
  }

  function renderPhaseText() {
    const controlKey = phase === 'play' ? 'keepBeat' : phase === 'demo' ? 'dontPress' : 'ready';
    const phaseKey = phase === 'demo' ? 'phaseDemo' : phase === 'play' ? 'phasePlay' : phase === 'handoff' ? 'phaseHandoff' : 'phaseHome';
    ui.controlHint.textContent = t(controlKey);
    ui.phaseLabel.textContent = t(phaseKey);
  }

  function renderAdText() {
    ui.adWait.innerHTML = t('adWait', { count: adSeconds });
    ui.watchAdButton.innerHTML = t('watchAd', { remaining: MAX_REVIVES - revivesUsed });
  }

  function renderSuccessPanel() {
    ui.unlockedCg.innerHTML = `<img src="${cgPath(level)}" alt=""><span>${t('cgUnlocked')}</span><b>${cgTitle(level)}</b>`;
    ui.nextButton.innerHTML = t('nextLevel', { level: level + 1 });
  }

  function renderViewedCg() {
    ui.cgFullImage.src = cgPath(viewedCg);
    ui.cgFullImage.alt = cgTitle(viewedCg);
    ui.cgFullNumber.textContent = t('cgNumber', { number: String(viewedCg).padStart(2, '0') });
    ui.cgFullTitle.textContent = cgTitle(viewedCg);
  }

  function applyLanguage() {
    document.documentElement.lang = t('htmlLang');
    document.title = t('title');
    ui.languageSelect.value = language;
    ui.languageSelect.setAttribute('aria-label', t('languageAria'));
    $$('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n); });
    $$('[data-i18n-html]').forEach(element => { element.innerHTML = t(element.dataset.i18nHtml); });
    $$('[data-i18n-aria]').forEach(element => { element.setAttribute('aria-label', t(element.dataset.i18nAria)); });
    renderMessage();
    renderPhaseText();
    renderAdText();
    updateAudioButtons();
    renderRail();
    updateGallery();
    if (phase === 'success') renderSuccessPanel();
    if (phase === 'fail') ui.failureReason.textContent = t(failureState.key, failureState.vars);
    if (!ui.cgViewer.hidden) renderViewedCg();
  }

  function later(fn, delay) {
    const id = window.setTimeout(fn, delay);
    scheduled.push(id);
  }

  function clearSchedule() {
    scheduled.forEach(window.clearTimeout);
    scheduled = [];
  }

  function cueFlag(cue) { return cue.includes('red') ? 'red' : 'white'; }
  function isFake(cue) { return cue.startsWith('fake'); }
  function cgPath(number) { return `./assets/cg/cg-${String(number).padStart(2, '0')}.webp`; }

  function createSequence(levelNumber) {
    const config = LEVELS[levelNumber - 1];
    const fakePositions = new Set();
    while (fakePositions.size < config.fakes) {
      fakePositions.add(1 + Math.floor(Math.random() * Math.max(1, config.length - 2)));
    }
    const result = [];
    let previous = null;
    let repeats = 0;
    for (let index = 0; index < config.length; index += 1) {
      let flag = Math.random() > .5 ? 'red' : 'white';
      repeats = flag === previous ? repeats + 1 : 1;
      if (repeats > 2) {
        flag = flag === 'red' ? 'white' : 'red';
        repeats = 1;
      }
      previous = flag;
      result.push(fakePositions.has(index) ? `fake-${flag}` : flag);
    }
    return result;
  }

  function tone(kind) {
    if (!soundOn) return;
    try {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return;
      const ctx = audioContext || new AudioCtor();
      audioContext = ctx;
      if (ctx.state === 'suspended') ctx.resume();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      const frequencies = { red: 523, white: 659, 'fake-red': 190, 'fake-white': 190, tick: 330, ui: 440, success: 784, fail: 145 };
      oscillator.type = kind.startsWith('fake') || kind === 'tick' || kind === 'ui' ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(frequencies[kind], now);
      if (kind === 'success') oscillator.frequency.exponentialRampToValueAtTime(1046, now + .22);
      if (kind === 'fail') oscillator.frequency.exponentialRampToValueAtTime(95, now + .28);
      gain.gain.setValueAtTime(.0001, now);
      const peakGain = kind === 'tick' ? .3 : kind === 'ui' ? .36 : .48;
      gain.gain.exponentialRampToValueAtTime(peakGain, now + .012);
      gain.gain.exponentialRampToValueAtTime(.0001, now + (kind === 'success' || kind === 'fail' ? .34 : .14));
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(now);
      oscillator.stop(now + .36);
    } catch (_) {}
  }

  function setPose(pose) {
    ui.character.dataset.pose = pose;
  }

  function updateAudioButtons() {
    ui.soundButton.innerHTML = `<span class="button-icon" aria-hidden="true">${soundOn ? '♪' : '×'}</span><span class="button-label">${t(soundOn ? 'sound' : 'muted')}</span>`;
    ui.soundButton.classList.toggle('off', !soundOn);
    ui.soundButton.setAttribute('aria-label', t(soundOn ? 'soundOffAria' : 'soundOnAria'));
    ui.bgmButton.innerHTML = `<span class="button-icon" aria-hidden="true">${bgmOn ? '♫' : '×'}</span><span class="button-label">BGM</span>`;
    ui.bgmButton.classList.toggle('off', !bgmOn);
    ui.bgmButton.setAttribute('aria-label', t(bgmOn ? 'bgmOffAria' : 'bgmOnAria'));
  }

  function syncBgm(allowPlay = false) {
    ui.bgmAudio.volume = .2;
    if (!bgmOn) {
      ui.bgmAudio.pause();
      return;
    }
    if (allowPlay) ui.bgmAudio.play().catch(() => {});
  }

  function playStartSfx(audio) {
    if (!soundOn) return;
    audio.volume = 1;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  function renderRail() {
    ui.levelRail.classList.toggle('cheat-enabled', cheatUnlocked);
    ui.levelRail.setAttribute('aria-label', t(cheatUnlocked ? 'railCheatAria' : 'railAria'));
    ui.levelRail.innerHTML = LEVELS.map((_, index) => {
      const targetLevel = index + 1;
      const state = index < level - 1 ? 'done' : index === level - 1 ? 'current' : '';
      return `<button type="button" class="${state}" data-level="${targetLevel}" aria-label="${t(cheatUnlocked ? 'railJump' : 'railLevel', { level: targetLevel })}" ${index === level - 1 ? 'aria-current="step"' : ''} ${cheatUnlocked ? '' : 'disabled'}></button>`;
    }).join('');
    ui.levelNumber.textContent = String(level).padStart(2, '0');
    ui.reviveCount.textContent = String(MAX_REVIVES - revivesUsed);
  }

  function unlockCheat() {
    cheatUnlocked = true;
    unlocked = LEVELS.length;
    localStorage.setItem(CHEAT_KEY, 'true');
    localStorage.setItem(STORAGE_KEY, String(unlocked));
    updateGallery();
    renderRail();
    setMessage('cheatMessage');
    tone('success');
  }

  function trackCheat(key) {
    if (cheatUnlocked) return false;
    const normalized = key.length === 1 ? key.toLowerCase() : key;
    if (normalized === CHEAT_SEQUENCE[cheatProgress]) {
      cheatProgress += 1;
      if (cheatProgress === CHEAT_SEQUENCE.length) unlockCheat();
      return true;
    }
    cheatProgress = normalized === CHEAT_SEQUENCE[0] ? 1 : 0;
    return cheatProgress === 1;
  }

  function renderBeatTrack() {
    ui.beatTrack.innerHTML = sequence.map(() => '<i></i>').join('');
    ui.beatTrack.hidden = sequence.length === 0;
  }

  function markBeat(active, passed = -1) {
    [...ui.beatTrack.children].forEach((dot, index) => {
      dot.classList.toggle('active', index === active);
      if (index <= passed) dot.classList.add('passed');
    });
  }

  function setPhase(next, messageKey, messageVars) {
    phase = next;
    document.body.dataset.phase = next;
    if (messageKey) setMessage(messageKey, messageVars);
    ui.statusDot.className = `status-dot ${next}`;
    $$('[data-screen]').forEach(screen => { screen.hidden = screen.dataset.screen !== next; });
    const playing = next === 'play';
    ui.redButton.disabled = !playing;
    ui.whiteButton.disabled = !playing;
    ui.controls.classList.toggle('enabled', playing);
    renderPhaseText();
    if (['home','success','fail','complete'].includes(next)) ui.beatTrack.hidden = true;
  }

  function endFailure(key, vars = {}) {
    if (phase !== 'play') return;
    clearSchedule();
    setPose('neutral');
    failureState = { key, vars };
    ui.failureReason.textContent = t(key, vars);
    renderAdText();
    ui.watchAdButton.hidden = revivesUsed >= MAX_REVIVES;
    setPhase('fail', key, vars);
    tone('fail');
  }

  function endSuccess() {
    if (phase !== 'play') return;
    clearSchedule();
    setPose('neutral');
    unlocked = Math.max(unlocked, level);
    localStorage.setItem(STORAGE_KEY, String(unlocked));
    updateGallery();
    tone('success');
    if (level === LEVELS.length) {
      setPhase('complete', 'allClearMessage');
      return;
    }
    renderSuccessPanel();
    setPhase('success', 'successMessage', { level });
  }

  function beginPlayerTurn() {
    const leadIn = 650;
    playerAnchor = performance.now() + leadIn;
    hitBeats = new Set();
    setPhase('play', 'playerMessage');
    playStartSfx(ui.playerStartSfx);
    ui.beatTrack.hidden = false;
    markBeat(-1);

    sequence.forEach((cue, index) => {
      const center = leadIn + index * beatMs;
      later(() => {
        if (phase !== 'play') return;
        markBeat(index);
        tone('tick');
      }, center);
      later(() => {
        if (phase !== 'play') return;
        if (!isFake(cue) && !hitBeats.has(index)) {
          endFailure(cueFlag(cue) === 'red' ? 'lateRed' : 'lateWhite');
          return;
        }
        markBeat(index, index);
      }, center + LATE_HIT_MS + 18);
    });

    later(() => {
      if (phase !== 'play') return;
      const required = sequence.filter(cue => !isFake(cue)).length;
      if (hitBeats.size === required) endSuccess();
    }, leadIn + (sequence.length - 1) * beatMs + LATE_HIT_MS + 70);
  }

  function runDemo(nextLevel, suppliedSequence) {
    clearSchedule();
    level = nextLevel;
    sequence = suppliedSequence ? [...suppliedSequence] : createSequence(level);
    const config = LEVELS[level - 1];
    beatMs = Math.max(MIN_BEAT_MS, 60000 / config.bpm);
    renderRail();
    renderBeatTrack();
    setPose('neutral');
    setPhase('demo', 'demoMessage');
    ui.beatTrack.hidden = false;
    playStartSfx(ui.demoStartSfx);
    const leadIn = 700;

    sequence.forEach((cue, index) => {
      const at = leadIn + index * beatMs;
      later(() => {
        if (phase !== 'demo') return;
        markBeat(index);
        setPose(cue);
        tone(cue);
      }, at);
      later(() => { if (phase === 'demo') setPose('neutral'); }, at + beatMs * (isFake(cue) ? .34 : .62));
    });

    later(() => {
      setPhase('handoff', 'handoffMessage');
      ui.beatTrack.hidden = false;
      markBeat(-1);
      ui.countdown.hidden = false;
      [3,2,1].forEach((count, index) => later(() => {
        ui.countdown.textContent = count;
        ui.countdown.style.animation = 'none';
        void ui.countdown.offsetWidth;
        ui.countdown.style.animation = '';
        tone('tick');
      }, index * 520));
      later(() => {
        ui.countdown.hidden = true;
        beginPlayerTurn();
      }, 3 * 520 + 180);
    }, leadIn + sequence.length * beatMs + 250);
  }

  function handleFlag(flag) {
    if (phase !== 'play') return;
    const now = performance.now();
    const index = sequence.findIndex((_, beatIndex) => {
      if (hitBeats.has(beatIndex)) return false;
      const center = playerAnchor + beatIndex * beatMs;
      return now >= center - EARLY_HIT_MS && now <= center + LATE_HIT_MS;
    });
    if (index === -1) {
      endFailure('offbeat');
      return;
    }
    const expected = sequence[index];
    if (isFake(expected)) {
      endFailure('fake');
      return;
    }
    if (expected !== flag) {
      endFailure(expected === 'red' ? 'wrongRed' : 'wrongWhite');
      return;
    }
    hitBeats.add(index);
    setPose(flag);
    tone(flag);
    markBeat(index, index);
    later(() => { if (phase === 'play') setPose('neutral'); }, Math.min(270, beatMs * .42));
  }

  function startRun() {
    syncBgm(true);
    revivesUsed = 0;
    runDemo(1);
  }

  function goHome() {
    clearSchedule();
    level = 1;
    revivesUsed = 0;
    sequence = [];
    setPose('neutral');
    renderRail();
    setPhase('home', 'homeMessage');
  }

  function showAd() {
    adSeconds = 3;
    renderAdText();
    ui.adWait.hidden = false;
    ui.reviveButton.hidden = true;
    ui.adModal.hidden = false;
    if (adLoop) window.clearInterval(adLoop);
    adLoop = window.setInterval(() => {
      adSeconds -= 1;
      renderAdText();
      if (adSeconds <= 0) {
        window.clearInterval(adLoop);
        adLoop = null;
        ui.adWait.hidden = true;
        ui.reviveButton.hidden = false;
      }
    }, 1000);
  }

  function revive() {
    revivesUsed += 1;
    ui.adModal.hidden = true;
    runDemo(level, sequence);
  }

  function updateGallery() {
    ui.galleryCount.textContent = String(unlocked);
    ui.cgGrid.innerHTML = t('cgTitles').map((title, index) => {
      const number = index + 1;
      const available = index < unlocked;
      return `<button type="button" class="cg-card${available ? '' : ' locked'}" data-cg="${number}" ${available ? '' : 'disabled'}>
        <span class="cg-art">${available ? `<img src="${cgPath(number)}" alt="">` : ''}</span>
        <span class="cg-caption"><small>CG ${String(number).padStart(2, '0')}</small><strong>${available ? title : '？？？？'}</strong></span>
        ${available ? '' : `<b class="lock">${t('locked')}</b>`}
      </button>`;
    }).join('');
  }

  function showCg(number) {
    viewedCg = number;
    renderViewedCg();
    ui.cgViewer.hidden = false;
  }

  $('#startButton').addEventListener('click', startRun);
  $('.game-page').addEventListener('click', () => syncBgm(true), { once: true });
  ui.languageSelect.addEventListener('change', event => {
    language = event.target.value;
    localStorage.setItem(LANGUAGE_KEY, language);
    applyLanguage();
    tone('ui');
  });
  ui.levelRail.addEventListener('click', event => {
    const button = event.target.closest('button[data-level]');
    if (!button || !cheatUnlocked) return;
    revivesUsed = 0;
    runDemo(Number(button.dataset.level));
  });
  ui.cgGrid.addEventListener('click', event => {
    const button = event.target.closest('button[data-cg]');
    if (button && !button.disabled) showCg(Number(button.dataset.cg));
  });
  document.addEventListener('click', event => {
    const button = event.target.closest?.('button');
    if (!button || button.disabled || button === ui.redButton || button === ui.whiteButton) return;
    tone('ui');
  }, true);
  $('#nextButton').addEventListener('click', () => runDemo(level + 1));
  $('#resetRunButton').addEventListener('click', goHome);
  $('#watchAdButton').addEventListener('click', showAd);
  $('#reviveButton').addEventListener('click', revive);
  $('#homeButton').addEventListener('click', goHome);
  $('#completeHomeButton').addEventListener('click', goHome);
  $('#galleryButton').addEventListener('click', () => { ui.galleryModal.hidden = false; });
  $('#completeGalleryButton').addEventListener('click', () => { ui.galleryModal.hidden = false; });
  ui.redButton.addEventListener('click', () => handleFlag('red'));
  ui.whiteButton.addEventListener('click', () => handleFlag('white'));
  ui.soundButton.addEventListener('click', () => {
    soundOn = !soundOn;
    localStorage.setItem(SOUND_KEY, String(soundOn));
    if (!soundOn) {
      [ui.demoStartSfx, ui.playerStartSfx].forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
      });
    }
    updateAudioButtons();
    if (soundOn) tone('ui');
  });
  ui.bgmButton.addEventListener('click', () => {
    bgmOn = !bgmOn;
    localStorage.setItem(BGM_KEY, String(bgmOn));
    updateAudioButtons();
    syncBgm(true);
  });
  $$('[data-close]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.close === 'gallery') ui.galleryModal.hidden = true;
    if (button.dataset.close === 'viewer') ui.cgViewer.hidden = true;
  }));
  [ui.galleryModal, ui.cgViewer].forEach(modal => modal.addEventListener('click', event => {
    if (event.target === modal) {
      tone('ui');
      modal.hidden = true;
    }
  }));
  window.addEventListener('keydown', event => {
    if (event.target.matches?.('select,input,textarea')) return;
    if (event.repeat) return;
    if (trackCheat(event.key)) {
      event.preventDefault();
      return;
    }
    if (event.key.toLowerCase() === 'r' || event.key === 'ArrowLeft') {
      event.preventDefault();
      handleFlag('red');
    }
    if (event.key.toLowerCase() === 'w' || event.key === 'ArrowRight') {
      event.preventDefault();
      handleFlag('white');
    }
    if (event.key === 'Escape') {
      if (!ui.galleryModal.hidden || !ui.cgViewer.hidden) tone('ui');
      ui.galleryModal.hidden = true;
      ui.cgViewer.hidden = true;
    }
  });

  setPhase('home', 'homeMessage');
  applyLanguage();
  syncBgm();
})();
