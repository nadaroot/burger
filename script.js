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
  for (let i = 0; i < 6; i++) {
    synthMoan(ctx, i * 4.2, 4);
  }
}

function playMoans() {
  if (!state.moanOk) {
    synthMoans();
    return;
  }

  if (!player.src.endsWith(MOAN_URL)) player.src = MOAN_URL;
  player.loop = true;
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

const falling = [];
let tickerId = null;

function tick() {
  const now = Date.now();
  for (let i = falling.length - 1; i >= 0; i--) {
    const item = falling[i];
    const progress = Math.min(1, (now - item.start) / item.duration);
    const y = item.from + (item.to - item.from) * progress;
    const x = item.drift * progress;
    const rotation = item.spin * progress;
    item.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) rotate(' + rotation.toFixed(1) + 'deg)';
    if (progress >= 1) {
      item.el.remove();
      falling.splice(i, 1);
    }
  }
}

function startTicker() {
  if (tickerId !== null) return;
  tickerId = setInterval(tick, 33);
}

function spawnBurger() {
  const burger = document.createElement('div');
  burger.className = 'burger';
  burger.textContent = Math.random() > 0.25 ? '\u{1F354}' : '\u{1F35F}';
  burger.style.left = rand(-4, 96) + 'vw';
  burger.style.setProperty('--size', rand(42, 120) + 'px');
  burger.style.opacity = String(rand(0.8, 1));
  burger.style.zIndex = String(5 + Math.floor(Math.random() * 4));
  burger.style.transform = 'translate3d(0,-180px,0)';
  rain.appendChild(burger);

  falling.push({
    el: burger,
    start: Date.now(),
    duration: rand(1100, 2200),
    from: -180,
    to: viewport().h + 220,
    drift: rand(-40, 40),
    spin: rand(-620, 620)
  });

  startTicker();
}

function startRain() {
  wall.classList.add('on');
  document.body.classList.add('party');
  if (state.raining) return;
  state.raining = true;

  for (let wave = 0; wave < 10; wave++) {
    for (let i = 0; i < 14; i++) {
      setTimeout(spawnBurger, wave * 900 + i * rand(40, 90));
    }
  }
}

function viewport() {
  const vv = window.visualViewport;
  return {
    w: Math.round(vv ? vv.width : document.documentElement.clientWidth),
    h: Math.round(vv ? vv.height : window.innerHeight)
  };
}

function placeNoButton() {
  const rect = btnNo.getBoundingClientRect();
  const vp = viewport();
  const left = Math.min(Math.max(10, vp.w / 2 - rect.width / 2), Math.max(10, vp.w - rect.width - 10));
  const top = Math.min(Math.max(10, vp.h - rect.height - 18), Math.max(10, vp.h - rect.height - 10));
  btnNo.style.left = left + 'px';
  btnNo.style.top = top + 'px';
  btnNo.style.bottom = 'auto';
  btnNo.style.transform = 'rotate(0deg)';
}

function applyNoMode() {
  const rogue = isTrap();

  if (rogue && btnNo.parentElement !== document.body) {
    document.body.appendChild(btnNo);
  } else if (!rogue && btnNo.parentElement !== stage) {
    stage.appendChild(btnNo);
  }

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
  const margin = 12;
  const vp = viewport();
  const maxLeft = Math.max(0, vp.w - rect.width - margin * 2);
  const maxTop = Math.max(0, vp.h - rect.height - margin * 2);
  const minDistance = Math.max(rect.width, rect.height) * 1.05 + 70;

  let best = null;
  let bestDist = -Infinity;

  for (let i = 0; i < 120; i++) {
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
  btnNo.style.bottom = 'auto';
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
}

function startle(event) {
  if (!state.started || state.locked || !isTrap()) return;
  if (event.cancelable) event.preventDefault();
  lastFlee = Date.now();
  moveAway(event.clientX, event.clientY);
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
  subtitle.textContent = 'Тест пройден. Честно, как и просили.';
  answerEl.textContent = RESULT_SUB + '!';
  answerEl.hidden = false;
  playBurgerSound();
  startRain();
  playMoans();
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
  state.advanceTimer = setTimeout(advance, 1800);
}

function onNo() {
  if (!state.started || state.locked || isTrap()) return;
  lockButtons();
  state.scores.no++;
  answerEl.textContent = current().no;
  answerEl.hidden = false;
  state.advanceTimer = setTimeout(advance, 1800);
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

  landing.classList.add('is-hidden');
  card.classList.remove('is-hidden');
  state.locked = true;
  renderQuestion();
  unlockButtons();
}

btnStart.addEventListener('click', start);

document.addEventListener('pointermove', flee, { passive: true });

document.addEventListener('pointerdown', (event) => {
  if (!state.started || !isTrap()) return;
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
