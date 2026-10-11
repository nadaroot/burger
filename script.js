const wall = document.getElementById('wall');
const stage = document.getElementById('stage');
const questionEl = document.getElementById('question');
const subtitle = document.getElementById('subtitle');
const answerEl = document.getElementById('answer');
const btnYes = document.getElementById('btnYes');
const btnNo = document.getElementById('btnNo');
const btnReset = document.getElementById('btnReset');
const rain = document.getElementById('rain');
const unlockBar = document.getElementById('unlock');
const player = document.getElementById('player');

const SILENT_WAV = 'data:audio/wav;base64,UklGRqQCAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YYACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

const MOAN_URL = 'assets/moan.mp3';

const QUESTIONS = [
  {
    kind: 'persona',
    q: 'На вечеринке ты пойдёшь танцевать, даже если не умеешь?',
    yes: 'Ты — тот самый человек в углу, который всех заводит.',
    no: 'Ты наблюдаешь в углу. Все за тобой наблюдают.'
  },
  {
    kind: 'persona',
    q: 'Тебя бесит, когда тебе перебивают?',
    yes: 'Тип личности: взрывной.',
    no: 'Тип личности: тёплый и пушистый.'
  },
  {
    kind: 'persona',
    q: 'Ты планируешь выходные заранее или в субботу утром?',
    yes: 'Стратег. Это всё равно не поможет.',
    no: 'Спонтанный. Очень даже в тебе.'
  },
  {
    kind: 'persona',
    q: 'Ты скорее съешь то, что лежит дома, чем пойдёшь в магазин?',
    yes: 'Логика. Хотя и путь к холодильнику.',
    no: 'Приключение. А счёт — потом.'
  },
  {
    kind: 'trap',
    q: 'Ты жирная свинка?',
    yes: 'ИДИ ЕСТЬ БУРГЕРЫ!',
    no: 'Не ври мне. Ты жирная свинка.'
  }
];

const TAUNTS = [
  'Не, не, не...',
  'Ага, попробуй ещё!',
  'Ловко ты щёлкнул(а).',
  'Кнопка занята.',
  'Руки короткие?',
  'Всё, сдаюсь. Жми.'
];

const RESULT_TITLE = 'ТИП ЛИЧНОСТИ: ЖИРНАЯ СВИНКА';
const RESULT_SUB = 'Иди есть бургеры';

const MAX_DODGES = 5;
const MAX_BURGERS = 90;
const FLEE_RADIUS = 200;
const FLEE_COOLDOWN = 60;
const INTRO_LINE = 'Ты жирная свинка';

const isIos = /iP(hone|ad|od)/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const state = {
  index: 0,
  locked: false,
  raining: false,
  scores: { yes: 0, no: 0 },
  advanceTimer: 0,
  audio: null,
  primed: false,
  speechPrimed: false,
  introSpoken: false,
  moanOk: true,
  mp3Url: null
};

const yes = { el: btnYes, flees: false, dodges: 0, tamed: true, lastFlee: 0 };
const no = { el: btnNo, flees: true, dodges: 0, tamed: false, lastFlee: 0 };

function rand(min, max) {
  return min + Math.max(0, max - min);
}

function current() {
  return QUESTIONS[state.index];
}

function isTrap() {
  return current().kind === 'trap';
}

function unlockAudioCtx() {
  if (state.audio) {
    if (state.audio.state === 'suspended') state.audio.resume();
    return state.audio;
  }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  state.audio = new Ctx();
  return state.audio;
}

function primeMediaElement() {
  if (state.primed) return;
  state.primed = true;

  const silent = new Audio(SILENT_WAV);
  silent.volume = 0.01;
  silent.playsInline = true;
  const attempt = silent.play();
  if (attempt && attempt.catch) attempt.catch(() => {});
}

function primeSpeech() {
  if (state.speechPrimed) return;
  state.speechPrimed = true;
  if (!('speechSynthesis' in window)) return;
  try {
    const utter = new SpeechSynthesisUtterance(' ');
    utter.volume = 0;
    window.speechSynthesis.speak(utter);
  } catch (e) {
    return;
  }
}

function unlockAll() {
  unlockAudioCtx();
  primeMediaElement();
  primeSpeech();
  unlockBar.classList.add('hidden');

  if (!state.introSpoken) {
    state.introSpoken = true;
    setTimeout(() => speak(INTRO_LINE), 120);
  }
}

function playDodgeSound() {
  const ctx = unlockAudioCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(760, t);
  osc.frequency.exponentialRampToValueAtTime(170, t + 0.18);
  gain.gain.setValueAtTime(0.12, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.22);
}

function playBurgerSound() {
  const ctx = unlockAudioCtx();
  if (!ctx) return;

  const duration = 1.6;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / ctx.sampleRate;
    const env = Math.exp(-3.2 * t) * (0.6 + 0.4 * Math.sin(t * 90));
    data[i] = (Math.random() * 2 - 1) * env * 0.7;
  }

  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.setValueAtTime(1400, ctx.currentTime);

  const gain = ctx.createGain();
  gain.gain.value = 0.5;

  src.connect(lowpass).connect(gain).connect(ctx.destination);
  src.start();

  const bass = ctx.createOscillator();
  const bassGain = ctx.createGain();
  bass.type = 'sine';
  bass.frequency.setValueAtTime(90, ctx.currentTime);
  bass.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.5);
  bassGain.gain.setValueAtTime(0.35, ctx.currentTime);
  bassGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
  bass.connect(bassGain).connect(ctx.destination);
  bass.start();
  bass.stop(ctx.currentTime + 0.65);
}

function synthMoan(ctx, startOffset, length) {
  const t = ctx.currentTime + startOffset;
  const end = t + length;

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(185, t);
  osc.frequency.linearRampToValueAtTime(315, t + length * 0.28);
  osc.frequency.linearRampToValueAtTime(240, t + length * 0.55);
  osc.frequency.linearRampToValueAtTime(165, end);

  const vibrato = ctx.createOscillator();
  vibrato.frequency.value = 5.4;
  const vibratoGain = ctx.createGain();
  vibratoGain.gain.setValueAtTime(0, t);
  vibratoGain.gain.linearRampToValueAtTime(16, t + length * 0.3);
  vibrato.connect(vibratoGain).connect(osc.frequency);

  const breath = ctx.createOscillator();
  breath.type = 'sawtooth';
  breath.frequency.setValueAtTime(370, t);
  breath.frequency.linearRampToValueAtTime(620, t + length * 0.3);
  breath.frequency.linearRampToValueAtTime(320, end);
  const breathGain = ctx.createGain();
  breathGain.gain.value = 0.12;

  const formantA = ctx.createBiquadFilter();
  formantA.type = 'bandpass';
  formantA.frequency.value = 720;
  formantA.Q.value = 5;

  const formantB = ctx.createBiquadFilter();
  formantB.type = 'bandpass';
  formantB.frequency.value = 1450;
  formantB.Q.value = 7;
  const formantBGain = ctx.createGain();
  formantBGain.gain.value = 0.45;

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(0.55, t + length * 0.22);
  env.gain.setValueAtTime(0.55, t + length * 0.5);
  env.gain.exponentialRampToValueAtTime(0.0001, end);

  osc.connect(formantA);
  breath.connect(breathGain).connect(formantA);
  osc.connect(formantB);
  formantB.connect(formantBGain).connect(env);
  formantA.connect(env);
  env.connect(ctx.destination);

  osc.start(t);
  vibrato.start(t);
  breath.start(t);
  osc.stop(end);
  vibrato.stop(end);
  breath.stop(end);
}

function synthMoans() {
  const ctx = unlockAudioCtx();
  if (!ctx) return;
  synthMoan(ctx, 0, 4.2);
  synthMoan(ctx, 4.4, 3.4);
}

function playMoans() {
  unlockAll();

  if (!state.moanOk) {
    synthMoans();
    return;
  }

  if (!player.src.endsWith(MOAN_URL)) player.src = MOAN_URL;
  player.currentTime = 0;
  player.volume = 0.9;

  const attempt = player.play();
  if (attempt && attempt.catch) {
    attempt.catch(() => {
      player.play().catch(() => {
        state.moanOk = false;
        synthMoans();
      });
    });
  }
}

player.addEventListener('error', () => {
  state.moanOk = false;
});

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  try {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ru-RU';
    utter.rate = 0.85;
    utter.pitch = 1.35;
    const voices = window.speechSynthesis.getVoices();
    const ru = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('ru'));
    if (ru) utter.voice = ru;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  } catch (e) {
    return;
  }
}

function spawnBurger() {
  const burger = document.createElement('div');
  burger.className = 'burger';
  burger.textContent = Math.random() > 0.25 ? '\u{1F354}' : '\u{1F35F}';
  burger.style.left = rand(-5, 100) + 'vw';
  burger.style.setProperty('--size', rand(38, 110) + 'px');
  burger.style.opacity = String(rand(0.75, 1));
  rain.appendChild(burger);

  const duration = rand(1.1, 2.1);
  const drift = rand(-30, 30);
  const spin = rand(-540, 540);

  burger.animate(
    [
      { transform: 'translate3d(0, -120px, 0) rotate(0deg)' },
      { transform: `translate3d(${drift}px, 105vh, 0) rotate(${spin}deg)` }
    ],
    { duration: duration * 1000, easing: 'cubic-bezier(.35,.05,.6,1)' }
  ).onfinish = () => burger.remove();
}

function startRain() {
  wall.classList.add('on');
  document.body.classList.add('party');
  if (state.raining) return;
  state.raining = true;
  for (let i = 0; i < MAX_BURGERS; i++) {
    setTimeout(spawnBurger, i * rand(45, 110));
  }
}

function resetPosition(btn) {
  if (btn === no) {
    no.el.style.left = '50%';
    no.el.style.top = '';
    no.el.style.bottom = '14px';
    no.el.style.transform = 'translate(-50%, 0) rotate(0deg)';
    return;
  }
  yes.el.style.left = '50%';
  yes.el.style.top = '26%';
  yes.el.style.transform = 'translate(-50%, -50%) rotate(0deg)';
}

function moveAway(btn, px, py) {
  const rect = btn.el.getBoundingClientRect();
  const margin = 10;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxLeft = Math.max(0, vw - rect.width - margin * 2);
  const maxTop = Math.max(0, vh - rect.height - margin * 2);
  const minDistance = Math.max(rect.width, rect.height) * 1.05 + 55;

  let best = null;
  let bestDist = -Infinity;

  for (let i = 0; i < 90; i++) {
    const left = rand(0, maxLeft);
    const top = rand(0, maxTop);
    const cx = left + margin + rect.width / 2;
    const cy = top + margin + rect.height / 2;
    const dist = Math.hypot(cx - px, cy - py);
    if (dist > bestDist) {
      bestDist = dist;
      best = { left, top };
    }
    if (dist >= minDistance) break;
  }

  btn.el.style.left = (best.left + margin) + 'px';
  btn.el.style.top = (best.top + margin) + 'px';
  btn.el.style.bottom = 'auto';
  btn.el.style.transform = 'rotate(' + rand(-16, 16) + 'deg)';
}

function tame(btn) {
  btn.tamed = true;
  btn.el.style.animation = 'none';
  resetPosition(btn);
  subtitle.textContent = '«Нет» сдался. Можешь нажать.';
  playDodgeSound();
}

function dodge(btn, px, py) {
  if (!btn.flees || btn.tamed || state.locked) return;

  btn.dodges++;

  if (btn.dodges >= MAX_DODGES) {
    tame(btn);
    return;
  }

  moveAway(btn, px, py);
  subtitle.textContent = TAUNTS[Math.min(btn.dodges, TAUNTS.length - 1)];
  playDodgeSound();
}

function flee(event) {
  if (state.locked || !no.flees || no.tamed) return;
  const px = event.clientX;
  const py = event.clientY;
  if (typeof px !== 'number' || typeof py !== 'number') return;

  const now = Date.now();
  if (now - no.lastFlee < FLEE_COOLDOWN) return;

  const rect = no.el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  if (Math.hypot(cx - px, cy - py) > FLEE_RADIUS) return;

  no.lastFlee = now;
  dodge(no, px, py);
}

function lockButtons() {
  state.locked = true;
  yes.el.disabled = true;
  no.el.disabled = true;
  yes.el.style.pointerEvents = 'none';
  no.el.style.pointerEvents = 'none';
  yes.el.style.opacity = '0.4';
  no.el.style.opacity = '0.4';
}

function unlockButtons() {
  state.locked = false;
  yes.el.disabled = false;
  no.el.disabled = false;
  yes.el.style.pointerEvents = '';
  no.el.style.pointerEvents = '';
  yes.el.style.opacity = '1';
  no.el.style.opacity = '1';
}

function resetButtons() {
  unlockButtons();
  yes.dodges = 0;
  no.dodges = 0;
  no.lastFlee = 0;
  yes.tamed = true;
  no.tamed = false;
  yes.el.style.animation = '';
  no.el.style.animation = '';
  resetPosition(yes);
  resetPosition(no);
}

function renderQuestion() {
  questionEl.textContent = current().q;
  subtitle.textContent = 'Кнопка «Нет» убегает по всему экрану. Жми «Да».';
  answerEl.hidden = true;
  answerEl.textContent = '';
}

function advance() {
  clearTimeout(state.advanceTimer);
  if (state.index >= QUESTIONS.length - 1) return;
  state.index++;
  resetButtons();
  renderQuestion();
}

function finishTest() {
  questionEl.textContent = RESULT_TITLE;
  subtitle.textContent = 'Да: ' + state.scores.yes + '. Нет: ' + state.scores.no + '.';
  answerEl.textContent = RESULT_SUB + '!';
  answerEl.hidden = false;
  playBurgerSound();
  startRain();
  playMoans();
  setTimeout(() => speak('Иди есть бургеры!'), 600);
}

function onYes() {
  if (state.locked) return;
  unlockAll();
  lockButtons();
  state.scores.yes++;

  if (isTrap()) {
    finishTest();
    return;
  }

  answerEl.textContent = current().yes;
  answerEl.hidden = false;
  playDodgeSound();
  state.advanceTimer = setTimeout(advance, 2600);
}

function onNo() {
  if (state.locked || !no.tamed) return;
  unlockAll();
  lockButtons();
  state.scores.no++;

  if (isTrap()) {
    finishTest();
    return;
  }

  answerEl.textContent = current().no;
  answerEl.hidden = false;
  state.advanceTimer = setTimeout(advance, 2600);
}

function reset() {
  clearTimeout(state.advanceTimer);
  state.index = 0;
  state.scores = { yes: 0, no: 0 };
  rain.innerHTML = '';
  wall.classList.remove('on');
  document.body.classList.remove('party');
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  resetButtons();
  renderQuestion();
}

document.addEventListener('pointermove', flee, { passive: true });

document.addEventListener('pointerdown', (event) => {
  unlockAll();

  const target = event.target.closest('.btn-no');
  if (!target || state.locked || no.tamed) return;
  event.preventDefault();
  dodge(no, event.clientX, event.clientY);
}, { passive: false });

btnYes.addEventListener('click', onYes);
btnNo.addEventListener('click', onNo);
btnReset.addEventListener('click', reset);

no.el.addEventListener('pointerenter', (event) => {
  unlockAll();
  if (event.cancelable) event.preventDefault();
  no.lastFlee = Date.now();
  dodge(no, event.clientX, event.clientY);
});

no.el.addEventListener('touchstart', (event) => {
  unlockAll();
  if (event.cancelable) event.preventDefault();
  no.lastFlee = Date.now();
  dodge(no, event.clientX, event.clientY);
}, { passive: false });

no.el.addEventListener('mousedown', (event) => {
  if (no.tamed || state.locked) return;
  if (event.cancelable) event.preventDefault();
  no.lastFlee = Date.now();
  dodge(no, event.clientX, event.clientY);
});

document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => {
  if (e.target.closest('.btn-yes, .btn-no')) e.preventDefault();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) player.pause();
  else if (state.raining && state.moanOk && player.src) player.play().catch(() => {});
});

window.addEventListener('resize', () => {
  if (!no.tamed && !state.locked && no.dodges > 0) {
    moveAway(no, -99999, -99999);
  }
});

if (isIos) {
  window.addEventListener('load', () => {
    setTimeout(() => unlockBar.classList.add('hidden'), 9000);
  });
} else {
  window.addEventListener('load', () => {
    state.introSpoken = true;
    setTimeout(() => speak(INTRO_LINE), 400);
    setTimeout(() => unlockBar.classList.add('hidden'), 6000);
  });
}
