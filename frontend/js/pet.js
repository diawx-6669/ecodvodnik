// Питомец: аватар — картинка из набора скинов (см. pet-skins.js), этот файл
// отвечает за настроение/уровень/стадию/чат и лёгкую реакцию на клик (bounce).
// Раньше тут же жила анимация одного хардкод-питомца «симбиота» (SVG-глаза,
// щупальца, оскал) — она привязывалась к элементам #pet-eyes/#pet-mouth/
// #pet-maw/#pet-emote, которых больше нет в разметке (см. index.html), и была
// удалена вместе с самим симбиотом, а не оставлена мёртвым кодом.

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

// Питомцу плохо — лёгкое затемнение/наклон картинки (см. .pet-turned в CSS)
const TURN_AWAY_MOODS = ['sad', 'sick'];

let petMood = 'neutral';
// Настоящее настроение по данным потребления (предпросмотр админа его не меняет)
let realPetMood = 'neutral';

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

// Применяет настроение к внешнему виду: подпись настроения и лёгкий
// наклон/разворот аватара (цвет самой картинки уже задан в PNG питомца).
// Используется и живыми данными, и предпросмотром админа.
function applyPetMood(mood) {
  const avatar = document.getElementById('pet-avatar');
  const moodLabelEl = document.getElementById('pet-mood-label');
  if (!avatar) return;

  petMood = MOOD_LABELS[mood] ? mood : 'neutral';
  avatar.dataset.mood = petMood;
  avatar.classList.toggle('pet-turned', TURN_AWAY_MOODS.includes(petMood));
  if (moodLabelEl) moodLabelEl.textContent = MOOD_LABELS[petMood];
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

// Питомца можно потрогать — он отзывается лёгким подскоком (см. .pet-bounce в CSS)
document.addEventListener('DOMContentLoaded', () => {
  buildParticles();
  const avatar = document.getElementById('pet-avatar');
  if (avatar) {
    avatar.addEventListener('click', reactBounce);
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
