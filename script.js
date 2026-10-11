const wall = document.getElementById('wall');
const card = document.querySelector('.card');
const stage = document.getElementById('stage');
const counter = document.getElementById('counter');
const questionEl = document.getElementById('question');
const subtitle = document.getElementById('subtitle');
const answerEl = document.getElementById('answer');
const btnYes = document.getElementById('btnYes');
const btnNo = document.getElementById('btnNo');
const btnReset = document.getElementById('btnReset');
const rain = document.getElementById('rain');

const QUESTIONS = [
  {
    q: 'Ты сегодня ел что-то, кроме воздуха?',
    yes: 'Поздравляю. Ты овощ.',
    no: 'Врёшь. Все врут. Дальше.'
  },
  {
    q: 'Ты когда-нибудь говорил «я на диете» с полным ртом?',
    yes: 'Диета — это когда ешь салат и плачешь.',
    no: 'Значит, ты не на диете. Как и все.'
  },
  {
    q: 'Ты храпишь во сне или постоянно?',
    yes: 'Тсс. Не буди свинью.',
    no: 'Тогда послушай, как ты отвечаешь на этот вопрос.'
  },
  {
    q: 'Ты последний раз бегал не за автобусом?',
    yes: 'Спорт — это дорога до холодильника.',
    no: 'Беги. Прямо сейчас. Я подожду.'
  },
  {
    q: 'Ты можешь посмотреть на салат и не подумать про стейк?',
    yes: 'Мысль — это уже половина обеда.',
    no: 'Салат проиграл. Салат всегда проигрывает.'
  },
  {
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

const MAX_DODGES = 6;
const MAX_BURGERS = 90;
const FLEE_RADIUS = 160;
const FLEE_COOLDOWN = 90;

const state = {
  index: 0,
  dodges: 0,
  tamed: false,
  locked: false,
  raining: false,
  lastFlee: 0,
  advanceTimer: 0,
  audio: null
};

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function current() {
  return QUESTIONS[state.index];
}

function isFinal() {
  return state.index === QUESTIONS.length - 1;
}

function unlockAudio() {
  if (state.audio) {
    if (state.audio.state === 'suspended') state.audio.resume();
    return state.audio;
  }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  state.audio = new Ctx();
  return state.audio;
}

function playDodgeSound() {
  const ctx = unlockAudio();
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
  const ctx = unlockAudio();
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

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  try {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ru-RU';
    utter.rate = 0.9;
    utter.pitch = 0.75;
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

function moveAwayFrom(px, py) {
  const stageRect = stage.getBoundingClientRect();
  const yesRect = btnYes.getBoundingClientRect();
  const noRect = btnNo.getBoundingClientRect();

  const maxLeft = Math.max(0, stageRect.width - yesRect.width);
  const noTop = noRect.top - stageRect.top;
  const maxTop = Math.max(0, Math.min(stageRect.height - yesRect.height, noTop - yesRect.height - 12));
  const minDistance = Math.max(yesRect.width, yesRect.height) * 1.1 + 50;

  let best = null;
  let bestScore = -Infinity;

  for (let i = 0; i < 60; i++) {
    const left = rand(0, maxLeft);
    const top = rand(0, maxTop);
    const cx = stageRect.left + left + yesRect.width / 2;
    const cy = stageRect.top + top + yesRect.height / 2;
    const dist = Math.hypot(cx - px, cy - py);
    if (dist > bestScore) {
      bestScore = dist;
      best = { left, top };
    }
    if (dist >= minDistance) break;
  }

  btnYes.style.left = best.left + 'px';
  btnYes.style.top = best.top + 'px';
  btnYes.style.transform = 'rotate(' + rand(-16, 16) + 'deg)';
}

function tame() {
  state.tamed = true;
  btnYes.style.animation = 'none';
  btnYes.style.left = '50%';
  btnYes.style.top = '26%';
  btnYes.style.transform = 'translate(-50%, -50%) rotate(0deg)';
  subtitle.textContent = 'Кнопка сдалась. Нажми наконец.';
  playDodgeSound();
}

function dodge(px, py) {
  if (state.tamed || state.locked) return;

  if (state.dodges + 1 >= MAX_DODGES) {
    state.dodges++;
    tame();
    return;
  }

  state.dodges++;
  moveAwayFrom(px, py);
  subtitle.textContent = TAUNTS[Math.min(state.dodges, TAUNTS.length - 1)];
  playDodgeSound();
}

function flee(event) {
  if (state.tamed || state.locked) return;
  const x = event.clientX;
  const y = event.clientY;
  if (typeof x !== 'number' || typeof y !== 'number') return;

  const now = Date.now();
  if (now - state.lastFlee < FLEE_COOLDOWN) return;

  const rect = btnYes.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  if (Math.hypot(cx - x, cy - y) > FLEE_RADIUS) return;

  state.lastFlee = now;
  dodge(x, y);
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
  btnNo.style.pointerEvents = '';
  btnYes.style.opacity = '1';
  btnNo.style.opacity = '1';
}

function advance() {
  clearTimeout(state.advanceTimer);
  if (isFinal()) return;

  state.index++;
  state.dodges = 0;
  state.tamed = false;
  unlockButtons();
  answerEl.hidden = true;
  answerEl.textContent = '';

  btnYes.style.animation = '';
  btnYes.style.left = '50%';
  btnYes.style.top = '26%';
  btnYes.style.transform = 'translate(-50%, -50%) rotate(0deg)';

  questionEl.textContent = current().q;
  counter.textContent = 'Вопрос ' + (state.index + 1) + ' из ' + QUESTIONS.length;
  subtitle.textContent = 'Кнопка «Да» убегает. Она трусливая.';
}

function showAnswer(text, nextIn) {
  answerEl.textContent = text;
  answerEl.hidden = false;
  if (nextIn) state.advanceTimer = setTimeout(advance, nextIn);
}

function onYes() {
  if (!state.tamed || state.locked) return;
  lockButtons();
  unlockAudio();

  if (isFinal()) {
    subtitle.textContent = 'Ты жирная свинка. Иди есть бургеры.';
    answerEl.textContent = 'ИДИ ЕСТЬ БУРГЕРЫ!';
    answerEl.hidden = false;
    playBurgerSound();
    startRain();
    setTimeout(() => speak('Иди есть бургеры!'), 400);
    return;
  }

  subtitle.textContent = 'Кнопка согласилась. И ответил(а).';
  showAnswer(current().yes, 2600);
  playDodgeSound();
}

function onNo() {
  if (state.locked) return;
  unlockAudio();
  playDodgeSound();

  if (isFinal()) {
    subtitle.textContent = 'Ну ты и свинья.';
    answerEl.textContent = current().no;
    answerEl.hidden = false;
    return;
  }

  advance();
}

function reset() {
  clearTimeout(state.advanceTimer);
  state.index = 0;
  state.dodges = 0;
  state.tamed = false;
  state.locked = false;
  rain.innerHTML = '';
  wall.classList.remove('on');
  document.body.classList.remove('party');
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();

  unlockButtons();
  btnYes.style.animation = '';
  btnYes.style.left = '50%';
  btnYes.style.top = '26%';
  btnYes.style.transform = 'translate(-50%, -50%) rotate(0deg)';

  answerEl.hidden = true;
  answerEl.textContent = '';
  questionEl.textContent = current().q;
  counter.textContent = 'Вопрос 1 из ' + QUESTIONS.length;
  subtitle.textContent = 'Кнопка «Да» убегает. Она трусливая.';
}

document.addEventListener('pointermove', flee, { passive: true });
document.addEventListener('pointerdown', (event) => {
  if (event.target.closest('.btn-yes')) {
    event.preventDefault();
    dodge(event.clientX, event.clientY);
  }
}, { passive: false });

btnYes.addEventListener('click', (event) => {
  if (state.tamed) onYes();
  else if (event.detail === 0) onYes();
});

btnNo.addEventListener('click', onNo);
btnReset.addEventListener('click', reset);

document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => {
  if (e.target.closest('.btn')) e.preventDefault();
});

window.addEventListener('resize', () => {
  if (!state.tamed && !state.locked && state.dodges > 0) {
    moveAwayFrom(-99999, -99999);
  }
});
