const arena = document.getElementById('arena');
const btnYes = document.getElementById('btnYes');
const btnNo = document.getElementById('btnNo');
const btnReset = document.getElementById('btnReset');
const result = document.getElementById('result');
const resultText = document.getElementById('resultText');
const subtitle = document.getElementById('subtitle');
const rain = document.getElementById('rain');
const bgBuns = document.getElementById('wall');

const MAX_DODGES = 6;
const MAX_BURGERS = 90;

const state = {
  dodges: 0,
  tamed: false,
  raining: false,
  audio: null
};

const taunts = [
  'Не, не, не...',
  'Ага, попробуй ещё!',
  'Ловко ты щёлкнул(а).',
  'Кнопка занята.',
  'Ну ладно, ладно...',
  'Руки короткие?',
  'Всё, сдаюсь. Жми.'
];

const noAnswers = [
  'Тогда зачем ты тут сидишь?',
  'Ну иди уже покушай.',
  'Скучно. Уходи и ешь бургеры.'
];

function rand(min, max) {
  return min + Math.random() * (max - min);
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
  osc.frequency.setValueAtTime(700, t);
  osc.frequency.exponentialRampToValueAtTime(180, t + 0.18);
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
  const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
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
    utter.volume = 1;
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
  if (state.raining) return;
  state.raining = true;
  bgBuns.classList.add('on');
  document.body.classList.add('party');
  const total = MAX_BURGERS;
  for (let i = 0; i < total; i++) {
    setTimeout(spawnBurger, i * rand(45, 110));
  }
  setTimeout(() => {
    if (rain.children.length === 0) state.raining = false;
  }, 9000);
}

function moveAwayFrom(x, y) {
  const rect = arena.getBoundingClientRect();
  const btnRect = btnYes.getBoundingClientRect();
  const minDistance = Math.max(btnRect.width, btnRect.height) * 1.25 + 60;

  let best = null;
  let bestDist = -1;

  for (let i = 0; i < 40; i++) {
    const left = rand(0, Math.max(1, rect.width - btnRect.width));
    const top = rand(0, Math.max(1, rect.height - btnRect.height));
    const centerX = rect.left + left + btnRect.width / 2;
    const centerY = rect.top + top + btnRect.height / 2;
    const dist = Math.hypot(centerX - x, centerY - y);
    if (dist > bestDist) {
      bestDist = dist;
      best = { left, top };
    }
    if (dist >= minDistance) break;
  }

  btnYes.style.left = best.left + 'px';
  btnYes.style.top = best.top + 'px';
  btnYes.style.transform = 'rotate(' + rand(-14, 14) + 'deg)';
}

function dodge(event) {
  if (state.tamed) return;

  if (event) event.preventDefault();

  const x = event && event.clientX ? event.clientX : window.innerWidth / 2;
  const y = event && event.clientY ? event.clientY : window.innerHeight / 2;

  state.dodges++;

  if (state.dodges >= MAX_DODGES) {
    state.tamed = true;
    btnYes.style.animation = 'none';
    btnYes.style.transform = 'translate(-50%, -50%)';
    btnYes.style.left = '50%';
    btnYes.style.top = '45%';
    subtitle.textContent = taunts[taunts.length - 1];
    playDodgeSound();
    return;
  }

  moveAwayFrom(x, y);
  subtitle.textContent = taunts[Math.min(state.dodges, taunts.length - 1)];
  playDodgeSound();
}

function yesAnswer() {
  unlockAudio();
  subtitle.textContent = 'Ты жирная свинка. Иди есть бургеры.';
  resultText.textContent = 'ИДИ ЕСТЬ БУРГЕРЫ!';
  result.hidden = false;
  btnYes.disabled = true;
  btnNo.disabled = true;
  btnYes.style.opacity = '0.35';
  btnNo.style.opacity = '0.35';
  btnYes.style.pointerEvents = 'none';
  btnNo.style.pointerEvents = 'none';
  playBurgerSound();
  startRain();
  setTimeout(() => speak('Иди есть бургеры!'), 400);
}

function noAnswer() {
  unlockAudio();
  subtitle.textContent = noAnswers[Math.floor(Math.random() * noAnswers.length)];
  playDodgeSound();
}

function reset() {
  state.dodges = 0;
  state.tamed = false;
  result.hidden = true;
  resultText.textContent = '';
  btnYes.disabled = false;
  btnNo.disabled = false;
  btnYes.style.opacity = '1';
  btnNo.style.opacity = '1';
  btnYes.style.pointerEvents = '';
  btnNo.style.pointerEvents = '';
  btnYes.style.animation = '';
  btnYes.style.transform = 'translate(-50%, -50%) rotate(0deg)';
  btnYes.style.left = '50%';
  btnYes.style.top = '45%';
  btnNo.style.transform = 'translate(-50%, -50%)';
  subtitle.textContent = 'Выбери ответ. Но сначала подумай.';
  rain.innerHTML = '';
  state.raining = false;
  bgBuns.classList.remove('on');
  document.body.classList.remove('party');
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

btnYes.addEventListener('pointerdown', dodge);
btnYes.addEventListener('click', (event) => {
  if (state.tamed) yesAnswer();
  else dodge(event);
});

btnYes.addEventListener('pointerenter', dodge);
btnYes.addEventListener('mousemove', dodge);
btnYes.addEventListener('touchstart', dodge, { passive: false });

btnNo.addEventListener('click', noAnswer);
btnNo.addEventListener('pointerenter', dodge);
btnNo.addEventListener('mousemove', dodge);

btnReset.addEventListener('click', reset);

document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => {
  if (e.target.closest('.btn')) e.preventDefault();
});

window.addEventListener('resize', () => {
  if (!state.tamed && state.dodges > 0) {
    moveAwayFrom(-9999, -9999);
  }
});
