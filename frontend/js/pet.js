// Отображение состояния питомца — живое SVG-существо, которое меняет
// цвет, выражение мордочки и лёгкую анимацию в зависимости от настроения.

const MOOD_LABELS = {
  happy: 'Настроение: отличное 🌟',
  neutral: 'Настроение: нейтральное',
  worried: 'Настроение: обеспокоенное',
  sad: 'Настроение: грустное 😟',
};

// Рты для разных настроений (SVG path)
const MOUTH_PATHS = {
  happy: 'M 84 128 Q 100 148 116 128',   // широкая улыбка
  neutral: 'M 88 132 Q 100 138 112 132', // лёгкая улыбка
  worried: 'M 88 134 Q 100 128 112 134', // прямая/чуть обеспокоенная
  sad: 'M 88 136 Q 100 124 112 136',     // грустный уголками вниз
};

// Форма глаз: обычные круглые, либо "прижмуренные" для грустного/уставшего
function applyEyes(mood) {
  const eyesGroup = document.getElementById('pet-eyes');
  if (!eyesGroup) return;

  if (mood === 'sad') {
    // прикрытые/уставшие глаза — тонкие дуги вместо кругов
    eyesGroup.innerHTML = `
      <path d="M 73 108 Q 80 102 87 108" fill="none" stroke="#2b2b2b" stroke-width="3.5" stroke-linecap="round" />
      <path d="M 113 108 Q 120 102 127 108" fill="none" stroke="#2b2b2b" stroke-width="3.5" stroke-linecap="round" />
    `;
  } else if (mood === 'happy') {
    // счастливые глаза-дуги (^_^)
    eyesGroup.innerHTML = `
      <path d="M 73 110 Q 80 100 87 110" fill="none" stroke="#2b2b2b" stroke-width="3.5" stroke-linecap="round" />
      <path d="M 113 110 Q 120 100 127 110" fill="none" stroke="#2b2b2b" stroke-width="3.5" stroke-linecap="round" />
    `;
  } else {
    // обычные круглые глаза с бликом
    eyesGroup.innerHTML = `
      <circle cx="80" cy="108" r="7" fill="#2b2b2b" />
      <circle cx="120" cy="108" r="7" fill="#2b2b2b" />
      <circle cx="82.5" cy="105.5" r="2" fill="#fff" />
      <circle cx="122.5" cy="105.5" r="2" fill="#fff" />
    `;
  }
}

function renderPetState(pet) {
  const avatar = document.getElementById('pet-avatar');
  const levelEl = document.getElementById('pet-level');
  const moodLabelEl = document.getElementById('pet-mood-label');
  const mouthEl = document.getElementById('pet-mouth');

  avatar.dataset.mood = pet.mood;
  levelEl.textContent = pet.level;
  moodLabelEl.textContent = MOOD_LABELS[pet.mood] || '';

  if (mouthEl) mouthEl.setAttribute('d', MOUTH_PATHS[pet.mood] || MOUTH_PATHS.neutral);
  applyEyes(pet.mood);

  // Небольшой "прыжок" при обновлении состояния — оживляет реакцию
  avatar.classList.remove('pet-bounce');
  // force reflow, чтобы анимация перезапустилась при повторном том же mood
  void avatar.offsetWidth;
  avatar.classList.add('pet-bounce');
}

function appendChatMessage(from, text) {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = `msg ${from}`;
  div.textContent = text;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}
