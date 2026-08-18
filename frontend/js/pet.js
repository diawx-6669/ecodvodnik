// Отображение состояния питомца (эмодзи-аватар, уровень, настроение)

const PET_EMOJIS = {
  happy: '🌳',
  neutral: '🌱',
  worried: '🥀',
  sad: '🍂',
};

const MOOD_LABELS = {
  happy: 'Настроение: отличное 🌟',
  neutral: 'Настроение: нейтральное',
  worried: 'Настроение: обеспокоенное',
  sad: 'Настроение: грустное 😟',
};

function renderPetState(pet) {
  const avatar = document.getElementById('pet-avatar');
  const levelEl = document.getElementById('pet-level');
  const moodLabelEl = document.getElementById('pet-mood-label');

  avatar.textContent = PET_EMOJIS[pet.mood] || '🌱';
  avatar.dataset.mood = pet.mood;
  levelEl.textContent = pet.level;
  moodLabelEl.textContent = MOOD_LABELS[pet.mood] || '';
}

function appendChatMessage(from, text) {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = `msg ${from}`;
  div.textContent = text;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}
