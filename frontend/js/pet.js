// Живой питомец «Эко»: следит за курсором, мигает, дышит, реагирует на
// прикосновения и меняет мимику/цвет/частицы в зависимости от настроения.

const MOOD_LABELS = {
  happy: 'Настроение: отличное',
  neutral: 'Настроение: спокойное',
  worried: 'Настроение: встревоженное',
  sad: 'Настроение: грустное',
  angry: 'Настроение: злое',
};

// Питомец, которому плохо, отворачивается от хозяина
const TURN_AWAY_MOODS = ['sad', 'angry'];

const MOUTH_PATHS = {
  happy: 'M 96 156 Q 110 174 124 156 Q 110 162 96 156',
  neutral: 'M 100 157 Q 110 165 120 157',
  worried: 'M 100 162 Q 110 155 120 162',
  sad: 'M 100 166 Q 110 152 120 166',
  angry: 'M 98 165 Q 110 150 122 165 Q 110 158 98 165',
};

const EMOTES = {
  happy: '<circle cx="168" cy="60" r="4" fill="var(--pet-light)"/><circle cx="180" cy="48" r="2.6" fill="var(--pet-light)"/><path d="M 156 44 l 3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 z" fill="var(--pet-light)"/>',
  neutral: '',
  worried: '<circle cx="166" cy="58" r="3.2" fill="#ffd98a"/><path d="M 170 40 v 12" stroke="#ffd98a" stroke-width="3.4" stroke-linecap="round"/><circle cx="170" cy="58" r="2" fill="#ffd98a"/>',
  sad: '<path d="M 141 142 q 5 10 0 14 q -5 -4 0 -14 z" fill="#9fd8ff"/>',
  angry: '<path d="M 160 46 q 12 -6 20 2 q -12 0 -20 -2 z" fill="#ff8f8f"/><path d="M 164 62 q 12 -6 20 2 q -12 0 -20 -2 z" fill="#ff8f8f" opacity="0.8"/><path d="M 176 26 v 12" stroke="#ff8f8f" stroke-width="3.6" stroke-linecap="round"/><circle cx="176" cy="45" r="2.2" fill="#ff8f8f"/>',
};


let petMood = 'neutral';
// Настоящее настроение по данным потребления (предпросмотр админа его не меняет)
let realPetMood = 'neutral';
let pupils = [];
let lastPointer = { x: 0, y: 0 };

function renderEyes(mood) {
  const eyes = document.getElementById('pet-eyes');
  if (!eyes) return;

  // Большие «живые» глаза: впадина, объёмная радужка, отражённый свет и блики
  const eye = (cx, cy, rx = 13, ry = 14.5) => `
    <g class="eye">
      <ellipse cx="${cx}" cy="${cy + 2}" rx="${rx + 4}" ry="${ry + 3.5}" fill="#0b211f" opacity="0.18" filter="url(#eyeBlur)" />
      <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#eyeSclera)" />
      <circle class="pupil" cx="${cx}" cy="${cy + 1}" r="${rx * 0.72}" fill="url(#eyeIris)" />
      <circle class="pupil" cx="${cx}" cy="${cy + 1.5}" r="${rx * 0.34}" fill="#04100f" />
      <ellipse class="pupil" cx="${cx}" cy="${cy + 1 + rx * 0.45}" rx="${rx * 0.52}" ry="${rx * 0.24}" fill="#8ff0e6" opacity="0.4" />
      <circle class="pupil-shine" cx="${cx - rx * 0.3}" cy="${cy - ry * 0.34}" r="${rx * 0.28}" fill="#fff" />
      <circle class="pupil-shine" cx="${cx + rx * 0.36}" cy="${cy + ry * 0.3}" r="${rx * 0.13}" fill="#fff" opacity="0.7" />
      <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#eyeDepth)" />
      <path d="M ${cx - rx} ${cy - ry * 0.5} Q ${cx} ${cy - ry * 1.25} ${cx + rx} ${cy - ry * 0.5}"
            fill="none" stroke="#1d3b35" stroke-width="2.6" stroke-linecap="round" opacity="0.45" />
      <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="#1d3b35" stroke-width="1" opacity="0.22" />
    </g>`;

  if (mood === 'happy') {
    eyes.innerHTML = `
      ${eye(88, 132, 13, 12)}
      ${eye(132, 132, 13, 12)}
      <path d="M 76 116 Q 88 109 100 115" fill="none" stroke="#1d3b35" stroke-width="3" stroke-linecap="round" opacity="0.6" />
      <path d="M 120 115 Q 132 109 144 116" fill="none" stroke="#1d3b35" stroke-width="3" stroke-linecap="round" opacity="0.6" />`;
  } else if (mood === 'sad') {
    eyes.innerHTML = `
      ${eye(88, 134, 11, 9.5)}
      ${eye(132, 134, 11, 9.5)}
      <path d="M 77 120 Q 88 115 99 119" fill="none" stroke="#1d3b35" stroke-width="3" stroke-linecap="round" opacity="0.75" />
      <path d="M 121 119 Q 132 115 143 120" fill="none" stroke="#1d3b35" stroke-width="3" stroke-linecap="round" opacity="0.75" />`;
  } else if (mood === 'angry') {
    eyes.innerHTML = `
      ${eye(88, 133, 12, 10)}
      ${eye(132, 133, 12, 10)}
      <path d="M 74 116 L 100 124" stroke="#4a1717" stroke-width="4.4" stroke-linecap="round" />
      <path d="M 146 116 L 120 124" stroke="#4a1717" stroke-width="4.4" stroke-linecap="round" />`;
  } else {
    eyes.innerHTML = `
      ${eye(88, 132)}
      ${eye(132, 132)}
      ${mood === 'worried' ? `
      <path d="M 76 114 Q 88 108 100 114" fill="none" stroke="#1d3b35" stroke-width="3.2" stroke-linecap="round" opacity="0.7" />
      <path d="M 120 114 Q 132 108 144 114" fill="none" stroke="#1d3b35" stroke-width="3.2" stroke-linecap="round" opacity="0.7" />` : ''}`;
  }


  pupils = Array.from(eyes.querySelectorAll('.pupil, .pupil-shine')).map((el) => ({
    el,
    cx: parseFloat(el.getAttribute('cx')),
    cy: parseFloat(el.getAttribute('cy')),
  }));
  movePupils(lastPointer.x, lastPointer.y);
}

// Взгляд следует за курсором
function movePupils(clientX, clientY) {
  const avatar = document.getElementById('pet-avatar');
  if (!avatar || !pupils.length) return;
  const r = avatar.getBoundingClientRect();
  if (!r.width) return;
  let dx = Math.max(-1, Math.min(1, (clientX - (r.left + r.width / 2)) / (r.width * 0.9)));
  let dy = Math.max(-1, Math.min(1, (clientY - (r.top + r.height / 2)) / (r.height * 0.9)));
  // Обиженный/злой питомец демонстративно отводит взгляд
  if (petMood === 'angry') { dx = -1; dy = -0.35; }
  else if (petMood === 'sad') { dx = Math.min(dx, -0.2); dy = 0.6; }
  pupils.forEach(({ el, cx, cy }) => {
    el.setAttribute('cx', (cx + dx * 3.4).toFixed(2));
    el.setAttribute('cy', (cy + dy * 3).toFixed(2));
  });
}

window.addEventListener('pointermove', (e) => {
  lastPointer = { x: e.clientX, y: e.clientY };
  movePupils(e.clientX, e.clientY);
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
  avatar.classList.toggle('pet-turned', TURN_AWAY_MOODS.includes(petMood));
  if (moodLabelEl) moodLabelEl.textContent = MOOD_LABELS[petMood];
  if (mouthEl) mouthEl.setAttribute('d', MOUTH_PATHS[petMood] || MOUTH_PATHS.neutral);
  if (emoteEl) emoteEl.innerHTML = EMOTES[petMood] || '';
  renderEyes(petMood);
}

function renderPetState(pet) {
  const avatar = document.getElementById('pet-avatar');
  const levelEl = document.getElementById('pet-level');
  const barEl = document.getElementById('pet-bar-fill');
  if (!avatar) return;

  realPetMood = MOOD_LABELS[pet.mood] ? pet.mood : 'neutral';
  if (!window.petPreviewActive) applyPetMood(realPetMood);
  if (levelEl) levelEl.textContent = pet.level;
  if (barEl) {
    const xp = typeof pet.xp === 'number'
      ? pet.xp % 100
      : { happy: 90, neutral: 60, worried: 38, sad: 18, angry: 8 }[petMood];
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
