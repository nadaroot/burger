const wall = document.getElementById('wall');
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
    kind: 'basic',
    q: 'Ты сегодня вообще спал?',
    yes: 'Глаза открыты — считай, спал.',
    no: 'Значит, ты не спишь. И не будешь.'
  },
  {
    kind: 'basic',
    q: 'Ты сегодня пил воду или только кофе?',
    yes: 'Вода — это хорошо. Ты почти человек.',
    no: 'Только кофе. Уже не человек.'
  },
  {
    kind: 'basic',
    q: 'Ты обычно делаешь то, что обещал себе вчера?',
    yes: 'Дисциплина. Уважаю.',
    no: 'Как и обещал: никогда.'
  },
  {
    kind: 'persona',
    q: 'На вечеринке ты пойдёшь танцевать, даже если не умеешь?',
    yes: 'Ты — тот самый человек в углу.',
    no: 'Ты наблюдаешь. Все за тобой наблюдают.'
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
const FLEE_RADIUS = 190;
const FLEE_COOLDOWN = 70;

const state = {
  index: 0,
  locked: false,
  raining: false,
  scores: { yes: 0, no: 0 },
  advanceTimer: 0,
  audio: null,
  mp3: null
};

const yes = { el: btnYes, home: { top: '26%' }, dodges: 0, tamed: false, lastFlee: 0 };
const no = { el: btnNo, home: { bottom: '8px' }, dodges: 0, tamed: false, lastFlee: 0 };

function rand(min, max) {
  return min + Math.max(0, max - min);
}

function current() {
  return QUESTIONS[state.index];
}

function isTrap() {
  return current().kind === 'trap';
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

function loadMoanTrack() {
  if (state.mp3 !== null) return Promise.resolve(state.mp3);
  return fetch('assets/moan.mp3', { cache: 'force-cache' })
    .then((res) => (res.ok ? res.blob() : Promise.reject(new Error('no file'))))
    .then((blob) => {
      state.mp3 = URL.createObjectURL(blob);
      return state.mp3;
    })
    .catch(() => {
      state.mp3 = false;
      return false;
    });
}

function playMoans() {
  const ctx = unlockAudio();
  if (!ctx) return;

  loadMoanTrack().then((url) => {
    if (url) {
      const audio = new Audio(url);
      audio.volume = 0.85;
      audio.play().catch(() => synthMoan(ctx, 0, 4.2));
      return;
    }
    synthMoan(ctx, 0, 4.2);
    synthMoan(ctx, 4.4, 3.4);
  });
}

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  try {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ru-RU';
    utter.rate = 0.85;
    utter.pitch = 1.35;
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
  btn.el.style.left = '50%';
  btn.el.style.top = btn.home.top || '';
  btn.el.style.bottom = btn.home.bottom || '';
  const base = btn === no ? 'translate(-50%, 0)' : 'translate(-50%, -50%)';
  btn.el.style.transform = base + ' rotate(0deg)';
}

function moveAway(btn, px, py) {
  const stageRect = stage.getBoundingClientRect();
  const rect = btn.el.getBoundingClientRect();
  const other = btn === yes ? no : yes;
  const otherRect = other.el.getBoundingClientRect();

  const maxLeft = Math.max(0, stageRect.width - rect.width);
  const maxTop = Math.max(0, stageRect.height - rect.height);
  const minDistance = Math.max(rect.width, rect.height) * 1.05 + 45;
  const gap = rect.height + otherRect.height + 18;

  let best = null;
  let bestScore = -Infinity;

  for (let i = 0; i < 80; i++) {
    const left = rand(0, maxLeft);
    const top = rand(0, maxTop);
    const cx = stageRect.left + left + rect.width / 2;
    const cy = stageRect.top + top + rect.height / 2;
    const otherCx = otherRect.left + otherRect.width / 2;
    const otherCy = otherRect.top + otherRect.height / 2;
    const overlap = Math.hypot(cx - otherCx, cy - otherCy) < gap;
    const dist = Math.hypot(cx - px, cy - py);
    const score = dist - (overlap ? 260 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = { left, top };
    }
    if (!overlap && dist >= minDistance) break;
  }

  btn.el.style.left = best.left + 'px';
  btn.el.style.top = best.top + 'px';
  btn.el.style.bottom = 'auto';
  btn.el.style.transform = 'rotate(' + rand(-16, 16) + 'deg)';
}

function tame(btn) {
  btn.tamed = true;
  btn.el.style.animation = 'none';
  resetPosition(btn);
  subtitle.textContent = btn === yes ? '«Да» сдалась. Нажми наконец.' : '«Нет» сдался. Нажми наконец.';
  playDodgeSound();
}

function dodge(btn, px, py) {
  if (btn.tamed || state.locked) return;

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
  if (state.locked) return;
  const px = event.clientX;
  const py = event.clientY;
  if (typeof px !== 'number' || typeof py !== 'number') return;

  const now = Date.now();

  const inRange = [yes, no]
    .filter((btn) => !btn.tamed)
    .map((btn) => {
      const rect = btn.el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      return { btn, dist: Math.hypot(cx - px, cy - py) };
    })
    .filter((item) => item.dist <= FLEE_RADIUS)
    .sort((a, b) => a.dist - b.dist);

  if (!inRange.length) return;

  for (const item of inRange) {
    if (now - item.btn.lastFlee < FLEE_COOLDOWN) continue;
    item.btn.lastFlee = now;
    dodge(item.btn, px, py);
  }
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
  yes.lastFlee = 0;
  no.lastFlee = 0;
  yes.tamed = false;
  no.tamed = false;
  yes.el.style.animation = '';
  no.el.style.animation = '';
  resetPosition(yes);
  resetPosition(no);
}

function renderQuestion() {
  questionEl.textContent = current().q;
  const total = QUESTIONS.length;
  const kind = current().kind === 'trap' ? 'Главный вопрос' : current().kind === 'persona' ? 'Тест личности' : 'Разминка';
  counter.textContent = kind + ' · ' + (state.index + 1) + ' из ' + total;
  subtitle.textContent = 'Обе кнопки убегают от пальца. Трусливые.';
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
  counter.textContent = 'Результат · ' + QUESTIONS.length + ' из ' + QUESTIONS.length;
  subtitle.textContent = 'Ответов «да»: ' + state.scores.yes + '. Ответов «нет»: ' + state.scores.no + '.';
  answerEl.textContent = RESULT_SUB + '!';
  answerEl.hidden = false;
  playBurgerSound();
  startRain();
  playMoans();
  setTimeout(() => speak('Иди есть бургеры!'), 500);
}

function onYes() {
  if (!yes.tamed || state.locked) return;
  lockButtons();
  unlockAudio();
  state.scores.yes++;

  if (isTrap()) {
    finishTest();
    return;
  }

  subtitle.textContent = current().yes;
  answerEl.textContent = current().yes;
  answerEl.hidden = false;
  playDodgeSound();
  state.advanceTimer = setTimeout(advance, 2600);
}

function onNo() {
  if (!no.tamed || state.locked) return;
  lockButtons();
  unlockAudio();
  state.scores.no++;

  if (isTrap()) {
    finishTest();
    return;
  }

  subtitle.textContent = current().no;
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
  if (state.mp3 && typeof state.mp3 === 'string') state.mp3 = null;
  resetButtons();
  renderQuestion();
}

document.addEventListener('pointermove', flee, { passive: true });

document.addEventListener('pointerdown', (event) => {
  const target = event.target.closest('.btn-yes, .btn-no');
  if (!target || state.locked) return;
  const btn = target === btnYes ? yes : no;
  if (btn.tamed) return;
  event.preventDefault();
  dodge(btn, event.clientX, event.clientY);
}, { passive: false });

btnYes.addEventListener('click', onYes);
btnNo.addEventListener('click', onNo);
btnReset.addEventListener('click', reset);

[yes, no].forEach((btn) => {
  const startle = (event) => {
    if (btn.tamed || state.locked) return;
    if (event.cancelable) event.preventDefault();
    btn.lastFlee = Date.now();
    dodge(btn, event.clientX, event.clientY);
  };
  btn.el.addEventListener('pointerenter', startle);
  btn.el.addEventListener('pointerover', startle);
  btn.el.addEventListener('touchstart', startle, { passive: false });
  btn.el.addEventListener('mousedown', startle);
});

document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => {
  if (e.target.closest('.btn-yes, .btn-no')) e.preventDefault();
});

window.addEventListener('resize', () => {
  [yes, no].forEach((btn) => {
    if (!btn.tamed && !state.locked && btn.dodges > 0) {
      moveAway(btn, -99999, -99999);
    }
  });
});
