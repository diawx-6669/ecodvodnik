// Коллекция питомцев-симбиотов: несколько видов на выбор.
// Каждый смотрит прямо на хозяина. Выбор сохраняется в localStorage.

const PET_SKINS = [
  { id: 'eco',    name: 'Эко',    desc: 'Симбиот листа — базовый хранитель дома', file: 'assets/pet/pet-eco.png',    tint: '#34e0a1' },
  { id: 'robo',   name: 'Робо',   desc: 'Робот-помощник — следит за электричеством', file: 'assets/pet/pet-robo.png',   tint: '#41c8ff' },
  { id: 'dog',    name: 'Бадди',  desc: 'Собачка — напоминает о привычках', file: 'assets/pet/pet-dog.png',    tint: '#7ee2a8' },
  { id: 'cat',    name: 'Мурка',  desc: 'Кошка — экономит воду', file: 'assets/pet/pet-cat.png',    tint: '#4fd8e8' },
  { id: 'fox',    name: 'Лиска',  desc: 'Лиса — хитрит с тарифами', file: 'assets/pet/pet-fox.png',    tint: '#ff9f43' },
  { id: 'owl',    name: 'Совуня', desc: 'Сова — считает ночной расход', file: 'assets/pet/pet-owl.png',    tint: '#c084fc' },
  { id: 'panda',  name: 'Панда',  desc: 'Панда — отвечает за климат и тепло', file: 'assets/pet/pet-panda.png',  tint: '#9fe4ff' },
  { id: 'turtle', name: 'Тортик', desc: 'Черепаха — долгие цели и углеродный след', file: 'assets/pet/pet-turtle.png', tint: '#3fd18b' },
  { id: 'rabbit', name: 'Зайка',  desc: 'Зайка — быстрые эко-задания', file: 'assets/pet/pet-rabbit.png', tint: '#f7a1d9' },
];

const PET_SKIN_KEY = 'ecotwin_pet_skin';

function getPetSkinId() {
  try {
    const saved = localStorage.getItem(PET_SKIN_KEY);
    if (saved && PET_SKINS.some((s) => s.id === saved)) return saved;
  } catch (_) {}
  return PET_SKINS[0].id;
}

function getPetSkin(id) {
  return PET_SKINS.find((s) => s.id === (id || getPetSkinId())) || PET_SKINS[0];
}

function ensurePetImage() {
  const avatar = document.getElementById('pet-avatar');
  if (!avatar) return null;
  let img = avatar.querySelector('.pet-img');
  if (!img) {
    img = document.createElement('img');
    img.className = 'pet-img';
    img.alt = 'Питомец';
    avatar.insertBefore(img, avatar.firstChild);
  }
  return img;
}

function applyPetSkin(id, { save = true } = {}) {
  const skin = getPetSkin(id);
  const avatar = document.getElementById('pet-avatar');
  const img = ensurePetImage();
  if (img) {
    img.src = skin.file;
    img.alt = `Питомец ${skin.name}`;
  }
  if (avatar) {
    avatar.dataset.skin = skin.id;
    avatar.style.setProperty('--pet-skin-tint', skin.tint);
  }
  if (save) {
    try { localStorage.setItem(PET_SKIN_KEY, skin.id); } catch (_) {}
  }
  document.querySelectorAll('.pet-skin-card').forEach((btn) => {
    const active = btn.dataset.skinId === skin.id;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  const nameEl = document.getElementById('pet-skin-name');
  const descEl = document.getElementById('pet-skin-desc');
  if (nameEl) nameEl.textContent = skin.name;
  if (descEl) descEl.textContent = skin.desc;
  // Небольшая реакция на смену облика
  if (avatar) {
    avatar.classList.remove('pet-bounce');
    void avatar.offsetWidth;
    avatar.classList.add('pet-bounce');
    setTimeout(() => avatar.classList.remove('pet-bounce'), 700);
  }
}

function buildPetSkinPicker() {
  const stage = document.querySelector('.pet-panel .pet-stage') || document.querySelector('.pet-stage');
  if (!stage || document.getElementById('pet-skin-picker')) return;

  const wrap = document.createElement('div');
  wrap.className = 'pet-skin-picker';
  wrap.id = 'pet-skin-picker';
  wrap.innerHTML = `
    <div class="pet-skin-head">
      <span class="pet-skin-title">Выбери питомца</span>
      <span class="pet-skin-current"><b id="pet-skin-name"></b> — <span id="pet-skin-desc"></span></span>
    </div>
    <div class="pet-skin-row">
      ${PET_SKINS.map((s) => `
        <button type="button" class="pet-skin-card" data-skin-id="${s.id}" style="--tint:${s.tint}" aria-pressed="false" title="${s.desc}">
          <img src="${s.file}" alt="${s.name}" loading="lazy" />
          <span>${s.name}</span>
        </button>`).join('')}
    </div>`;

  stage.insertAdjacentElement('afterend', wrap);

  wrap.querySelectorAll('.pet-skin-card').forEach((btn) => {
    btn.addEventListener('click', () => applyPetSkin(btn.dataset.skinId));
  });
}

function initPetSkins() {
  buildPetSkinPicker();
  applyPetSkin(getPetSkinId(), { save: false });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPetSkins);
} else {
  initPetSkins();
}
