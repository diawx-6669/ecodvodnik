// Живой питомец «Эко»: следит за курсором, мигает, дышит, реагирует на
// прикосновения и меняет мимику/цвет/частицы в зависимости от настроения.

const MOOD_LABELS = {
  happy: 'Настроение: отличное',
  neutral: 'Настроение: спокойное',
  worried: 'Настроение: встревоженное',
  sad: 'Настроение: грустное',
};

const MOUTH_PATHS = {
  happy: 'M 92 152 Q 110 176 128 152',
  neutral: 'M 98 156 Q 110 164 122 156',
  worried: 'M 98 160 Q 110 153 122 160',
  sad: 'M 98 164 Q 110 148 122 164',
};

const EMOTES = {
  happy: '<circle cx="168" cy="60" r="4" fill="var(--pet-light)"/><circle cx="180" cy="48" r="2.6" fill="var(--pet-light)"/><path d="M 156 44 l 3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 z" fill="var(--pet-light)"/>',
  neutral: '',
  worried: '<circle cx="166" cy="58" r="3.2" fill="#ffd98a"/><path d="M 170 40 v 12" stroke="#ffd98a" stroke-width="3.4" stroke-linecap="round"/><circle cx="170" cy="58" r="2" fill="#ffd98a"/>',
  sad: '<path d="M 146 130 q 5 10 0 14 q -5 -4 0 -14 z" fill="#9fd8ff"/>',
};

let petMood = 'neutral';
let pupils = [];
let lastPointer = { x: 0, y: 0 };

function renderEyes(mood) {
  const eyes = document.getElementById('pet-eyes');
  if (!eyes) return;

  // Глубокий «живой» глаз: впадина, тень от века, радужка с объёмом, блики
  const eye = (cx, cy, rx = 11.5, ry = 12.5) => `
    <g class="eye">
      <ellipse cx="${cx}" cy="${cy + 1.5}" rx="${rx + 3.5}" ry="${ry + 3}" fill="#0b211f" opacity="0.16" filter="url(#eyeBlur)" />
      <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#eyeSclera)" />
      <circle class="pupil" cx="${cx}" cy="${cy + 1}" r="${rx * 0.62}" fill="url(#eyeIris)" />
      <circle class="pupil" cx="${cx}" cy="${cy + 1}" r="${rx * 0.3}" fill="#05100f" />
      <ellipse class="pupil" cx="${cx}" cy="${cy + 1 + rx * 0.4}" rx="${rx * 0.5}" ry="${rx * 0.22}" fill="#7fe6dd" opacity="0.35" />
      <circle class="pupil-shine" cx="${cx - rx * 0.32}" cy="${cy - ry * 0.36}" r="${rx * 0.25}" fill="#fff" />
      <circle class="pupil-shine" cx="${cx + rx * 0.34}" cy="${cy + ry * 0.34}" r="${rx * 0.12}" fill="#fff" opacity="0.65" />
      <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#eyeDepth)" />
      <path d="M ${cx - rx} ${cy - ry * 0.45} Q ${cx} ${cy - ry * 1.2} ${cx + rx} ${cy - ry * 0.45}"
            fill="none" stroke="#1d3b35" stroke-width="2.4" stroke-linecap="round" opacity="0.5" />
      <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="#1d3b35" stroke-width="1" opacity="0.28" />
    </g>`;

  if (mood === 'happy') {
    eyes.innerHTML = `
      <path d="M 80 128 Q 90 112 100 128" fill="none" stroke="#22312b" stroke-width="4.2" stroke-linecap="round" />
      <path d="M 120 128 Q 130 112 140 128" fill="none" stroke="#22312b" stroke-width="4.2" stroke-linecap="round" />`;
    pupils = [];
  } else if (mood === 'sad') {
    eyes.innerHTML = `
      ${eye(90, 130, 9.5, 8)}
      ${eye(130, 130, 9.5, 8)}
      <path d="M 80 116 Q 90 111 100 115" fill="none" stroke="#22312b" stroke-width="3" stroke-linecap="round" opacity="0.75" />
      <path d="M 120 115 Q 130 111 140 116" fill="none" stroke="#22312b" stroke-width="3" stroke-linecap="round" opacity="0.75" />`;
  } else {
    eyes.innerHTML = `
      ${eye(90, 128)}
      ${eye(130, 128)}
      ${mood === 'worried' ? `
      <path d="M 79 110 Q 90 104 101 110" fill="none" stroke="#22312b" stroke-width="3.2" stroke-linecap="round" />
      <path d="M 119 110 Q 130 104 141 110" fill="none" stroke="#22312b" stroke-width="3.2" stroke-linecap="round" />` : ''}`;
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
