// Профиль пользователя: информация об аккаунте, смена пароля, ввод секретного
// кода администратора и (только для админов) просмотр эмоций питомца.

const MOOD_PREVIEW = [
  { mood: 'happy', title: 'Радость', when: 'Расход падает на 10% и больше — питомец светится зелёным.' },
  { mood: 'neutral', title: 'Спокойствие', when: 'Показатели держатся в норме, без резких скачков.' },
  { mood: 'worried', title: 'Тревога', when: 'Расход вырос на 10–25% — питомец желтеет и хмурится.' },
  { mood: 'sad', title: 'Грусть', when: 'Появилась аномалия расхода — питомец бледнеет и отворачивается.' },
  { mood: 'angry', title: 'Злость', when: 'Две аномалии сразу или рост больше 40% — питомец краснеет, дрожит и отводит взгляд.' },
];

const TYPE_TITLES = {
  household: 'Дом',
  school: 'Школа',
  business: 'Бизнес',
};

const UNITS_TITLES = {
  household: 'Человек в семье',
  school: 'Учеников в школе',
  business: 'Сотрудников',
};

function profileEl(id) {
  return document.getElementById(id);
}

function setProfileMessage(id, text, kind) {
  const el = profileEl(id);
  if (!el) return;
  el.textContent = text || '';
  el.className = `profile-msg${text ? ` show ${kind || 'ok'}` : ''}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch (err) {
    return '—';
  }
}

function isAdmin() {
  return !!(window.appAuth && window.appAuth.user && window.appAuth.user.role === 'admin');
}

function renderProfile() {
  const user = window.appAuth ? window.appAuth.user : null;
  const guest = !user;

  profileEl('profile-avatar').textContent = guest
    ? 'Г'
    : (user.name || 'U').trim().charAt(0).toUpperCase();
  profileEl('profile-name').textContent = guest ? 'Гость' : user.name || 'Пользователь';
  profileEl('profile-role').textContent = guest
    ? 'демо-режим без аккаунта'
    : isAdmin()
      ? 'администратор'
      : 'обычный аккаунт';
  profileEl('profile-role').classList.toggle('is-admin', isAdmin());

  const rows = [
    ['Email', guest ? '—' : user.email],
    ['Тип аккаунта', guest ? 'Демо' : TYPE_TITLES[user.type] || 'Дом'],
    [guest ? 'Размер' : UNITS_TITLES[user.type] || 'Размер', guest ? '—' : String(user.unitsCount)],
    ['Организация', guest ? '—' : user.organizationName || 'не указана'],
    ['Аккаунт создан', guest ? '—' : formatDate(user.createdAt)],
    ['Питомец', localStorage.getItem(guest
      ? 'ecodvoinik_pet_name_guest'
      : `ecodvoinik_pet_name_${user.id}`) || 'Эко'],
  ];

  profileEl('profile-rows').innerHTML = rows
    .map(([label, value]) => `
      <div class="profile-row">
        <span class="profile-row-label">${label}</span>
        <span class="profile-row-value">${value}</span>
      </div>`)
    .join('');

  // Гость не может менять пароль и получать админку — у него нет аккаунта
  profileEl('profile-guest-note').classList.toggle('hidden', !guest);
  profileEl('password-section').classList.toggle('hidden', guest);
  profileEl('admin-code-section').classList.toggle('hidden', guest || isAdmin());
  profileEl('admin-section').classList.toggle('hidden', !isAdmin());
  profileEl('admin-extras-section').classList.toggle('hidden', !isAdmin());
  profileEl('admin-locked-note').classList.toggle('hidden', guest || isAdmin());

  if (isAdmin()) renderMoodPreview();
  if (typeof window.loadHousehold === 'function') window.loadHousehold();
  if (typeof window.loadIntegrationStatus === 'function') window.loadIntegrationStatus();
  if (typeof window.loadAdminExtras === 'function') window.loadAdminExtras();
}

function renderMoodPreview() {
  const box = profileEl('admin-mood-list');
  if (!box || box.dataset.ready === '1') return;
  box.dataset.ready = '1';
  box.innerHTML = MOOD_PREVIEW.map((m) => `
    <button type="button" class="mood-card" data-mood="${m.mood}">
      <span class="mood-card-dot" data-mood-dot="${m.mood}"></span>
      <span class="mood-card-body">
        <span class="mood-card-title">${m.title}</span>
        <span class="mood-card-when">${m.when}</span>
      </span>
    </button>`).join('');

  box.querySelectorAll('.mood-card').forEach((card) => {
    card.addEventListener('click', () => {
      if (!isAdmin() || !window.petMoodApi) return;
      box.querySelectorAll('.mood-card').forEach((c) => c.classList.remove('active'));
      card.classList.add('active');
      window.petPreviewActive = true;
      window.petMoodApi.apply(card.dataset.mood);
      window.petMoodApi.bounce();
      profileEl('admin-preview-state').textContent =
        `Показан облик: ${window.petMoodApi.labels[card.dataset.mood].replace('Настроение: ', '')}`;
    });
  });
}

function openProfile() {
  renderProfile();
  profileEl('profile-modal').classList.add('open');
  document.body.classList.add('modal-open');
}

function closeProfile() {
  profileEl('profile-modal').classList.remove('open');
  document.body.classList.remove('modal-open');
}

// Живые искры фона (плотность задаётся здесь, анимация — в CSS)
function buildBackgroundSparks() {
  const box = profileEl('bg-sparks');
  if (!box) return;
  for (let i = 0; i < 26; i++) {
    const s = document.createElement('i');
    s.style.setProperty('--left', `${(Math.random() * 100).toFixed(1)}%`);
    s.style.setProperty('--dur', `${(16 + Math.random() * 18).toFixed(1)}s`);
    s.style.setProperty('--delay', `${(Math.random() * 20).toFixed(1)}s`);
    s.style.setProperty('--drift', `${(Math.random() * 10 - 5).toFixed(1)}vw`);
    box.appendChild(s);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  buildBackgroundSparks();
  const chip = profileEl('account-chip');
  if (chip) {
    chip.addEventListener('click', (e) => {
      if (e.target.closest('#logout-btn')) return;
      openProfile();
    });
    chip.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openProfile();
      }
    });
  }

  profileEl('profile-close').addEventListener('click', closeProfile);
  profileEl('profile-backdrop').addEventListener('click', closeProfile);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeProfile();
  });

  // --- Смена пароля ---
  profileEl('password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    setProfileMessage('password-msg', '');
    const current = profileEl('current-password').value;
    const next = profileEl('new-password').value;
    const repeat = profileEl('repeat-password').value;

    if (next !== repeat) {
      setProfileMessage('password-msg', 'Новые пароли не совпадают', 'err');
      return;
    }
    if (next.length < 6) {
      setProfileMessage('password-msg', 'Новый пароль должен быть не короче 6 символов', 'err');
      return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await api.changePassword(current, next);
      e.target.reset();
      setProfileMessage('password-msg', 'Пароль обновлён', 'ok');
    } catch (err) {
      setProfileMessage('password-msg', err.message || 'Не удалось сменить пароль', 'err');
    } finally {
      btn.disabled = false;
    }
  });

  // --- Секретный код администратора ---
  profileEl('admin-code-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    setProfileMessage('admin-code-msg', '');
    const code = profileEl('admin-code-input').value.trim();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const { user } = await api.claimAdmin(code);
      window.appAuth.user = user;
      e.target.reset();
      setProfileMessage('admin-code-msg', 'Права администратора активированы', 'ok');
      renderProfile();
      if (typeof window.renderAccountChip === 'function') window.renderAccountChip();
    } catch (err) {
      setProfileMessage('admin-code-msg', err.message || 'Неверный секретный код', 'err');
    } finally {
      btn.disabled = false;
    }
  });

  // --- Возврат к настоящему настроению ---
  profileEl('admin-preview-reset').addEventListener('click', () => {
    if (!window.petMoodApi) return;
    window.petPreviewActive = false;
    window.petMoodApi.restore();
    document.querySelectorAll('#admin-mood-list .mood-card').forEach((c) => c.classList.remove('active'));
    profileEl('admin-preview-state').textContent = 'Показано настоящее настроение по данным';
  });
});

window.openProfile = openProfile;
window.renderProfileModal = renderProfile;
