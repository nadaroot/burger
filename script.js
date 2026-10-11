const wall = document.getElementById('wall');
const stage = document.getElementById('stage');
const landing = document.getElementById('landing');
const btnStart = document.getElementById('btnStart');
const card = document.getElementById('card');
const questionEl = document.getElementById('question');
const subtitle = document.getElementById('subtitle');
const answerEl = document.getElementById('answer');
const btnYes = document.getElementById('btnYes');
const btnNo = document.getElementById('btnNo');
const btnReset = document.getElementById('btnReset');
const rain = document.getElementById('rain');
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

const RESULT_TITLE = 'ТИП ЛИЧНОСТИ: ЖИРНАЯ СВИНКА';
const RESULT_SUB = 'Иди есть бургеры';

const MAX_BURGERS = 90;
const FLEE_RADIUS = 230;
const FLEE_COOLDOWN = 32;

const state = {
  started: false,
  index: 0,
  locked: false,
  raining: false,
  scores: { yes: 0, no: 0 },
  advanceTimer: 0,
  audio: null,
  primed: false,
  speechPrimed: false,
  moanOk: true
};

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
}

function playStartSound() {
  const ctx = unlockAudioCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(420, t);
  osc.frequency.exponentialRampToValueAtTime(880, t + 0.25);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.15, t + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.45);
}

function playDodgeSound() {
  const ctx = unlockAudioCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(800, t);
  osc.frequency.exponentialRampToValueAtTime(180, t + 0.16);
  gain.gain.setValueAtTime(0.1, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.2);
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

function placeNoButton() {
  const rect = btnNo.getBoundingClientRect();
  btnNo.style.left = (window.innerWidth / 2 - rect.width / 2) + 'px';
  btnNo.style.top = (window.innerHeight - rect.height - 18) + 'px';
  btnNo.style.bottom = 'auto';
  btnNo.style.transform = 'rotate(0deg)';
}

function applyNoMode() {
  const rogue = isTrap();
  btnNo.classList.toggle('rogue', rogue);
  btnNo.style.left = '';
  btnNo.style.top = '';
  btnNo.style.bottom = '';
  btnNo.style.transform = '';
  btnNo.style.pointerEvents = rogue ? 'none' : '';
  lastFlee = 0;
}

function moveAway(px, py) {
  const rect = btnNo.getBoundingClientRect();
  const margin = 10;
  const maxLeft = Math.max(0, window.innerWidth - rect.width - margin * 2);
  const maxTop = Math.max(0, window.innerHeight - rect.height - margin * 2);
  const minDistance = Math.max(rect.width, rect.height) * 1.05 + 70;

  let best = null;
  let bestDist = -Infinity;

  for (let i = 0; i < 100; i++) {
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

  btnNo.style.left = (best.left + margin) + 'px';
  btnNo.style.top = (best.top + margin) + 'px';
  btnNo.style.transform = 'rotate(' + rand(-18, 18) + 'deg)';
}

let lastFlee = 0;

function flee(event) {
  if (!state.started || state.locked || !isTrap()) return;
  const px = event.clientX;
  const py = event.clientY;
  if (typeof px !== 'number' || typeof py !== 'number') return;

  const now = Date.now();
  if (now - lastFlee < FLEE_COOLDOWN) return;

  const rect = btnNo.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  if (Math.hypot(cx - px, cy - py) > FLEE_RADIUS) return;

  lastFlee = now;
  moveAway(px, py);
  playDodgeSound();
}

function startle(event) {
  if (!state.started || state.locked || !isTrap()) return;
  if (event.cancelable) event.preventDefault();
  lastFlee = Date.now();
  moveAway(event.clientX, event.clientY);
  playDodgeSound();
}

function lockButtons() {
  state.locked = true;
  btnYes.disabled = true;
  btnNo.disabled = true;
  btnYes.style.pointerEvents = 'none';
  btnNo.style.pointerEvents = 'none';
  btnYes.style.opacity = '0.4';
  btnNo.style.opacity = '0.4';
}

function unlockButtons() {
  state.locked = false;
  btnYes.disabled = false;
  btnNo.disabled = false;
  btnYes.style.pointerEvents = '';
  btnNo.style.pointerEvents = isTrap() ? 'none' : '';
  btnYes.style.opacity = '1';
  btnNo.style.opacity = '1';
}

function renderQuestion() {
  questionEl.textContent = current().q;
  subtitle.textContent = 'Отвечай честно, результат зависит от тебя';
  answerEl.hidden = true;
  answerEl.textContent = '';
  applyNoMode();
}

function advance() {
  clearTimeout(state.advanceTimer);
  if (state.index >= QUESTIONS.length - 1) return;
  state.index++;
  unlockButtons();
  btnYes.style.transform = 'translate(-50%, -50%) rotate(0deg)';
  renderQuestion();
  if (isTrap()) placeNoButton();
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
  if (!state.started || state.locked) return;
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
  if (!state.started || state.locked || isTrap()) return;
  lockButtons();
  state.scores.no++;
  answerEl.textContent = current().no;
  answerEl.hidden = false;
  playDodgeSound();
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
  state.locked = true;
  renderQuestion();
  unlockButtons();
  btnYes.style.transform = 'translate(-50%, -50%) rotate(0deg)';
}

function start() {
  if (state.started) return;
  state.started = true;

  unlockAll();
  playStartSound();

  landing.classList.add('is-hidden');
  card.classList.remove('is-hidden');
  state.locked = true;
  renderQuestion();
  unlockButtons();
}

btnStart.addEventListener('click', start);

document.addEventListener('pointermove', flee, { passive: true });

document.addEventListener('pointerdown', (event) => {
  if (!state.started) return;
  const target = event.target.closest('.btn-no');
  if (!target || state.locked) return;
  event.preventDefault();
  startle(event);
}, { passive: false });

btnYes.addEventListener('click', onYes);
btnNo.addEventListener('click', (event) => {
  if (isTrap()) {
    event.preventDefault();
    startle(event);
    return;
  }
  onNo();
});
btnReset.addEventListener('click', reset);

btnNo.addEventListener('pointerenter', startle);
btnNo.addEventListener('pointerover', startle);
btnNo.addEventListener('touchstart', startle, { passive: false });
btnNo.addEventListener('mousedown', startle);

document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => {
  if (e.target.closest('.btn-yes, .btn-no')) e.preventDefault();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) player.pause();
  else if (state.raining && state.moanOk && player.src) player.play().catch(() => {});
});

window.addEventListener('resize', () => {
  if (state.started && !state.locked && isTrap()) moveAway(-99999, -99999);
});
