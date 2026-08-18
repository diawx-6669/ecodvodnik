// Живой питомец «Эко»: следит за курсором, мигает, дышит, реагирует на
// прикосновения и меняет мимику/цвет/частицы в зависимости от настроения.

const MOOD_LABELS = {
  happy: 'Настроение: отличное 🌟',
  neutral: 'Настроение: спокойное',
  worried: 'Настроение: встревоженное',
  sad: 'Настроение: грустное 😟',
};

const MOUTH_PATHS = {
  happy: 'M 92 140 Q 110 164 128 140',
  neutral: 'M 98 144 Q 110 152 122 144',
  worried: 'M 98 148 Q 110 141 122 148',
  sad: 'M 98 152 Q 110 136 122 152',
};

const EMOTES = {
  happy: '<circle cx="168" cy="60" r="4" fill="var(--pet-light)"/><circle cx="180" cy="48" r="2.6" fill="var(--pet-light)"/><path d="M 156 44 l 3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 z" fill="var(--pet-light)"/>',
  neutral: '',
  worried: '<circle cx="166" cy="58" r="3.2" fill="#ffd98a"/><path d="M 170 40 v 12" stroke="#ffd98a" stroke-width="3.4" stroke-linecap="round"/><circle cx="170" cy="58" r="2" fill="#ffd98a"/>',
  sad: '<path d="M 146 118 q 5 10 0 14 q -5 -4 0 -14 z" fill="#9fd8ff"/>',
};

let petMood = 'neutral';
let pupils = [];
let lastPointer = { x: 0, y: 0 };

function renderEyes(mood) {
  const eyes = document.getElementById('pet-eyes');
  if (!eyes) return;

  if (mood === 'happy') {
    eyes.innerHTML = `
      <path d="M 80 116 Q 90 102 100 116" fill="none" stroke="#22312b" stroke-width="4" stroke-linecap="round" />
      <path d="M 120 116 Q 130 102 140 116" fill="none" stroke="#22312b" stroke-width="4" stroke-linecap="round" />`;
    pupils = [];
  } else if (mood === 'sad') {
    eyes.innerHTML = `
      <g class="eye">
        <ellipse cx="90" cy="118" rx="9" ry="7" fill="#fff" opacity="0.92" />
        <circle class="pupil" cx="90" cy="119" r="4.6" fill="#22312b" />
      </g>
      <g class="eye">
        <ellipse cx="130" cy="118" rx="9" ry="7" fill="#fff" opacity="0.92" />
        <circle class="pupil" cx="130" cy="119" r="4.6" fill="#22312b" />
      </g>
      <path d="M 80 106 Q 90 101 100 105" fill="none" stroke="#22312b" stroke-width="3" stroke-linecap="round" opacity="0.75" />
      <path d="M 120 105 Q 130 101 140 106" fill="none" stroke="#22312b" stroke-width="3" stroke-linecap="round" opacity="0.75" />`;
  } else {
    eyes.innerHTML = `
      <g class="eye">
        <ellipse cx="90" cy="116" rx="11" ry="12" fill="#fff" />
        <circle class="pupil" cx="90" cy="117" r="6" fill="#22312b" />
        <circle class="pupil-shine" cx="87" cy="112" r="2.4" fill="#fff" />
      </g>
      <g class="eye">
        <ellipse cx="130" cy="116" rx="11" ry="12" fill="#fff" />
        <circle class="pupil" cx="130" cy="117" r="6" fill="#22312b" />
        <circle class="pupil-shine" cx="127" cy="112" r="2.4" fill="#fff" />
      </g>
      ${mood === 'worried' ? `
      <path d="M 79 100 Q 90 94 101 100" fill="none" stroke="#22312b" stroke-width="3.2" stroke-linecap="round" />
      <path d="M 119 100 Q 130 94 141 100" fill="none" stroke="#22312b" stroke-width="3.2" stroke-linecap="round" />` : ''}`;
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
  const dx = Math.max(-1, Math.min(1, (clientX - (r.left + r.width / 2)) / (r.width * 0.9)));
  const dy = Math.max(-1, Math.min(1, (clientY - (r.top + r.height / 2)) / (r.height * 0.9)));
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

function renderPetState(pet) {
  const avatar = document.getElementById('pet-avatar');
  const levelEl = document.getElementById('pet-level');
  const moodLabelEl = document.getElementById('pet-mood-label');
  const mouthEl = document.getElementById('pet-mouth');
  const emoteEl = document.getElementById('pet-emote');
  const barEl = document.getElementById('pet-bar-fill');
  if (!avatar) return;

  petMood = pet.mood || 'neutral';
  avatar.dataset.mood = petMood;
  if (levelEl) levelEl.textContent = pet.level;
  if (moodLabelEl) moodLabelEl.textContent = MOOD_LABELS[petMood] || '';
  if (mouthEl) mouthEl.setAttribute('d', MOUTH_PATHS[petMood] || MOUTH_PATHS.neutral);
  if (emoteEl) emoteEl.innerHTML = EMOTES[petMood] || '';
  if (barEl) {
    const xp = typeof pet.xp === 'number' ? pet.xp % 100 : { happy: 90, neutral: 60, worried: 38, sad: 18 }[petMood];
    barEl.style.width = `${Math.max(8, xp)}%`;
  }

  renderEyes(petMood);
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
