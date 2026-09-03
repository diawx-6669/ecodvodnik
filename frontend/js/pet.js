// Живой питомец-симбиот «Эко»: смотрит прямо на хозяина (глаза и корпус
// доворачиваются к курсору), дышит, реагирует на прикосновения и меняет
// мимику/цвет/щупальца в зависимости от настроения.

const MOOD_LABELS = {
  happy: 'Настроение: отличное',
  neutral: 'Настроение: спокойное',
  surprised: 'Настроение: удивлённое',
  worried: 'Настроение: встревоженное',
  tired: 'Настроение: уставшее',
  sad: 'Настроение: грустное',
  angry: 'Настроение: злое',
  sick: 'Настроение: болеет',
};

// Питомцу плохо — он отворачивается от хозяина
const TURN_AWAY_MOODS = ['sad', 'sick'];

// Рот: у симбиота он почти не читается, кроме злости (там включается пасть)
const MOUTH_PATHS = {
  happy: 'M 96 160 Q 110 172 124 160',
  neutral: 'M 100 160 Q 110 166 120 160',
  surprised: 'M 104 160 Q 110 170 116 160 Q 110 164 104 160',
  worried: 'M 100 164 Q 110 158 120 164',
  tired: 'M 100 162 Q 110 160 120 162',
  sad: 'M 100 168 Q 110 156 120 168',
  angry: '',
  sick: 'M 100 164 Q 105 169 110 164 Q 115 169 120 164',
};

// Оскал симбиота: клыки и разорванная пасть — только для злости
const ANGRY_MAW = `
  <g class="maw-group">
    <path d="M 76 148 C 92 138 128 138 144 148 C 136 180 84 180 76 148 Z" fill="#0a0205" stroke="var(--pet-deep)" stroke-width="1.6" />
    <path d="M 79 149 L 84 160 L 89 149 L 95 162 L 101 149 L 107 163 L 113 149 L 119 163 L 125 149 L 131 161 L 136 149 L 141 158 L 144 148 L 76 148 Z" fill="#fff6f2" />
    <path d="M 82 170 L 86 159 L 91 170 L 97 158 L 103 170 L 110 157 L 117 170 L 123 158 L 129 170 L 134 159 L 138 168 C 124 178 96 178 82 170 Z" fill="#f4e6e0" />
    <path d="M 76 148 C 92 140 128 140 144 148" fill="none" stroke="var(--pet-light)" stroke-width="1.8" opacity="0.55" />
    <path d="M 72 146 C 62 140 60 130 65 124" fill="none" stroke="var(--pet-accent)" stroke-width="3" stroke-linecap="round" opacity="0.85" />
    <path d="M 148 146 C 158 140 160 130 155 124" fill="none" stroke="var(--pet-accent)" stroke-width="3" stroke-linecap="round" opacity="0.85" />
    <path d="M 90 176 C 100 182 120 182 130 176" fill="none" stroke="#0a0205" stroke-width="2" opacity="0.6" />
  </g>`;

const EMOTES = {
  happy: '<circle cx="176" cy="52" r="4" fill="var(--pet-light)"/><circle cx="188" cy="40" r="2.6" fill="var(--pet-light)"/><path d="M 164 36 l 3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 z" fill="var(--pet-light)"/>',
  neutral: '',
  surprised: '<path d="M 166 30 l 4 8 8 2 -6 6 1 8 -7 -4 -7 4 1 -8 -6 -6 8 -2 z" fill="#ffe08a"/><circle cx="188" cy="58" r="2.4" fill="#ffe08a"/>',
  worried: '<circle cx="174" cy="50" r="3.2" fill="#ffd98a"/><path d="M 178 32 v 12" stroke="#ffd98a" stroke-width="3.4" stroke-linecap="round"/><circle cx="178" cy="50" r="2" fill="#ffd98a"/>',
  tired: '<path d="M 166 42 q 10 6 20 0" stroke="#9fb3ae" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.85"/><path d="M 170 54 q 8 5 16 0" stroke="#9fb3ae" stroke-width="2.4" fill="none" stroke-linecap="round" opacity="0.6"/>',
  sad: '<path d="M 74 150 q 5 12 0 16 q -5 -4 0 -16 z" fill="#9fd8ff"/>',
  angry: '<path d="M 168 38 q 12 -6 20 2 q -12 0 -20 -2 z" fill="#ff8f8f"/><path d="M 172 54 q 12 -6 20 2 q -12 0 -20 -2 z" fill="#ff8f8f" opacity="0.8"/><path d="M 184 18 v 12" stroke="#ff8f8f" stroke-width="3.6" stroke-linecap="round"/><circle cx="184" cy="37" r="2.2" fill="#ff8f8f"/>',
  sick: '<path d="M 162 36 q 8 -10 18 -4 q -8 2 -18 4 z" fill="#8fd98a" opacity="0.85"/><circle cx="192" cy="44" r="3" fill="#8fd98a" opacity="0.7"/><circle cx="198" cy="56" r="2" fill="#8fd98a" opacity="0.5"/>',
};

let petMood = 'neutral';
// Настоящее настроение по данным потребления (предпросмотр админа его не меняет)
let realPetMood = 'neutral';
let lastPointer = { x: 0, y: 0 };

// Глаза симбиота: сплошные однотонные «капли» без зрачков.
// Форма левого глаза задаётся в координатах SVG, правый — зеркальная копия.
const EYE_SHAPES = {
  neutral: 'M 100 122 C 92 104 68 96 56 106 C 48 114 58 132 76 136 C 90 139 99 132 100 122 Z',
  happy: 'M 100 128 C 92 110 68 104 56 114 C 50 121 60 130 76 132 C 89 133 98 133 100 128 Z',
  surprised: 'M 102 124 C 94 100 66 92 54 104 C 44 115 56 138 76 140 C 92 141 102 134 102 124 Z',
  worried: 'M 100 116 C 90 104 66 104 56 116 C 51 124 62 132 78 130 C 91 128 99 124 100 116 Z',
  tired: 'M 100 124 C 92 116 68 112 57 120 C 52 125 60 130 76 130 C 90 130 99 129 100 124 Z',
  sad: 'M 100 114 C 90 106 66 110 57 122 C 53 129 64 133 79 130 C 91 127 99 121 100 114 Z',
  angry: 'M 103 136 C 94 118 70 98 57 104 C 50 108 60 128 78 138 C 91 144 101 142 103 136 Z',
  sick: 'M 100 124 C 92 110 68 104 57 114 C 51 121 60 132 76 134 C 90 136 99 131 100 124 Z',
};

function renderEyes(mood) {
  const eyes = document.getElementById('pet-eyes');
  if (!eyes) return;
  const shape = EYE_SHAPES[mood] || EYE_SHAPES.neutral;

  // Тёмная глазница + сплошная светящаяся заливка + мокрый блик по краю
  const eyeMarkup = (transform) => `
    <g transform="${transform}">
      <path d="${shape}" fill="var(--pet-deep)" opacity="0.85" transform="translate(0 2.5) scale(1.06) translate(-6 -8)" filter="url(#petSoft)" />
      <path d="${shape}" fill="url(#petEyeFill)" filter="url(#petBloom)" />
      <path d="${shape}" fill="none" stroke="var(--pet-deep)" stroke-width="2" opacity="0.6" />
      <path d="${shape}" fill="#ffffff" opacity="0.22" transform="translate(-2 -3) scale(0.86) translate(14 18)" />
    </g>`;

  eyes.innerHTML = `
    ${eyeMarkup('translate(0 0)')}
    ${eyeMarkup('translate(220 0) scale(-1 1)')}`;

  moveGaze(lastPointer.x, lastPointer.y);
}

// Взгляд следует за курсором: глаза и корпус слегка доворачиваются к хозяину
function moveGaze(clientX, clientY) {
  const avatar = document.getElementById('pet-avatar');
  const eyes = document.getElementById('pet-eyes');
  const body = document.querySelector('.pet-body');
  if (!avatar || !eyes) return;
  const r = avatar.getBoundingClientRect();
  if (!r.width) return;
  let dx = Math.max(-1, Math.min(1, (clientX - (r.left + r.width / 2)) / (r.width * 0.9)));
  let dy = Math.max(-1, Math.min(1, (clientY - (r.top + r.height / 2)) / (r.height * 0.9)));
  // Обиженный питомец демонстративно отводит взгляд, злой — наоборот, впивается
  if (petMood === 'sad') { dx = Math.min(dx, -0.3); dy = 0.6; }
  eyes.setAttribute('transform', `translate(${(dx * 5).toFixed(2)} ${(dy * 4).toFixed(2)})`);
  if (body) body.setAttribute('transform', `translate(${(dx * 2).toFixed(2)} ${(dy * 1.4).toFixed(2)})`);
}

// Совместимость со старым названием
const movePupils = moveGaze;

window.addEventListener('pointermove', (e) => {
  lastPointer = { x: e.clientX, y: e.clientY };
  moveGaze(e.clientX, e.clientY);
});

// Мигание
function blink() {
  const eyes = document.getElementById('pet-eyes');
  if (eyes && petMood !== 'happy') {
    eyes.classList.add('blink');
    setTimeout(() => eyes.classList.remove('blink'), 240);
  }
  setTimeout(blink, 2600 + Math.random() * 3800);
}

// Частицы вокруг питомца
function buildParticles() {
  const box = document.getElementById('pet-particles');
  if (!box) return;
  box.innerHTML = '';
  for (let i = 0; i < 12; i++) {
    const s = document.createElement('span');
    s.style.setProperty('--x', `${(Math.random() * 120 - 60).toFixed(0)}px`);
    s.style.setProperty('--dur', `${(4 + Math.random() * 4).toFixed(1)}s`);
    s.style.setProperty('--delay', `${(Math.random() * 5).toFixed(1)}s`);
    s.style.left = `${40 + Math.random() * 20}%`;
    s.style.width = s.style.height = `${4 + Math.random() * 5}px`;
    box.appendChild(s);
  }
}

function reactBounce() {
  const avatar = document.getElementById('pet-avatar');
  if (!avatar) return;
  avatar.classList.remove('pet-bounce');
  void avatar.offsetWidth;
  avatar.classList.add('pet-bounce');
}

// Применяет настроение к внешнему виду: цвет тела, глаза, рот, знак настроения
// и разворот корпуса. Используется и живыми данными, и предпросмотром админа.
function applyPetMood(mood) {
  const avatar = document.getElementById('pet-avatar');
  const moodLabelEl = document.getElementById('pet-mood-label');
  const mouthEl = document.getElementById('pet-mouth');
  const emoteEl = document.getElementById('pet-emote');
  if (!avatar) return;

  petMood = MOOD_LABELS[mood] ? mood : 'neutral';
  avatar.dataset.mood = petMood;
  window.applyPetSkinMood?.(petMood);
  avatar.classList.toggle('pet-turned', TURN_AWAY_MOODS.includes(petMood));
  if (moodLabelEl) moodLabelEl.textContent = MOOD_LABELS[petMood];
  if (mouthEl) mouthEl.setAttribute('d', MOUTH_PATHS[petMood] || MOUTH_PATHS.neutral);
  if (emoteEl) emoteEl.innerHTML = EMOTES[petMood] || '';
  const mawEl = document.getElementById('pet-maw');
  if (mawEl) mawEl.innerHTML = petMood === 'angry' ? ANGRY_MAW : '';
  if (mouthEl) mouthEl.style.opacity = petMood === 'angry' ? '0' : '';
  renderEyes(petMood);
}

// Применяет стадию эволюции («семечко» → «росток» → «деревце» → «дерево» →
// «цветение») — визуально это масштаб/сочность питомца и подпись возле
// уровня. Стадия считается на бэкенде (services/petStateService.js) от
// текущего уровня, здесь только отражаем её.
const STAGE_LABELS = {
  seed: 'семечко',
  sprout: 'росток',
  sapling: 'деревце',
  tree: 'дерево',
  bloom: 'цветение',
};

function applyPetStage(stage) {
  const avatar = document.getElementById('pet-avatar');
  const stageLabelEl = document.getElementById('pet-stage-label');
  if (!avatar) return;
  const safeStage = STAGE_LABELS[stage] ? stage : 'seed';
  avatar.dataset.stage = safeStage;
  if (stageLabelEl) stageLabelEl.textContent = `Стадия: ${STAGE_LABELS[safeStage]}`;
}

function renderPetState(pet) {
  const avatar = document.getElementById('pet-avatar');
  const levelEl = document.getElementById('pet-level');
  const barEl = document.getElementById('pet-bar-fill');
  if (!avatar) return;

  realPetMood = MOOD_LABELS[pet.mood] ? pet.mood : 'neutral';
  if (!window.petPreviewActive) applyPetMood(realPetMood);
  if (pet.stage) applyPetStage(pet.stage);
  if (levelEl) levelEl.textContent = pet.level;
  if (barEl) {
    const xp = typeof pet.xp === 'number'
      ? pet.xp % 100
      : { happy: 90, neutral: 60, surprised: 55, worried: 38, tired: 45, sad: 18, angry: 8, sick: 4 }[petMood];
    barEl.style.width = `${Math.max(8, xp)}%`;
  }

  reactBounce();
}

// Питомца можно потрогать — он отзывается
document.addEventListener('DOMContentLoaded', () => {
  buildParticles();
  renderEyes('neutral');
  blink();
  const avatar = document.getElementById('pet-avatar');
  if (avatar) {
    avatar.addEventListener('click', () => {
      reactBounce();
      const mouth = document.getElementById('pet-mouth');
      if (mouth) {
        mouth.setAttribute('d', MOUTH_PATHS.happy);
        setTimeout(() => mouth.setAttribute('d', MOUTH_PATHS[petMood] || MOUTH_PATHS.neutral), 900);
      }
    });
  }
});

function appendChatMessage(from, text) {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  const div = document.createElement('div');
  div.className = `msg ${from}`;
  div.textContent = text;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// Доступно другим модулям (например, панели администратора)
window.petMoodApi = {
  labels: MOOD_LABELS,
  apply: applyPetMood,
  current: () => petMood,
  real: () => realPetMood,
  restore: () => applyPetMood(realPetMood),
  bounce: reactBounce,
};
