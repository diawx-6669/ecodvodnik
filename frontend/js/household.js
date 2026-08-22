// Семейный аккаунт: создание/присоединение по коду, список участников,
// выход из домохозяйства. Рендерится внутри модалки профиля.

function householdEl(id) {
  return document.getElementById(id);
}

// Текст блока зависит от типа аккаунта: семья — только для типа household,
// школы и предприятия видят нейтральные формулировки про организацию/группу.
const HOUSEHOLD_LABELS = {
  household: {
    title: 'Семейный аккаунт',
    hint: 'Объедините показания нескольких людей в одном домохозяйстве — сводка и питомец станут общими.',
    namePlaceholder: 'Название (например, «Наша семья»)',
    createBtn: 'Создать домохозяйство',
    leaveBtn: 'Покинуть домохозяйство',
  },
  school: {
    title: 'Аккаунт школы',
    hint: 'Объедините показания нескольких сотрудников школы в одном аккаунте — сводка и питомец станут общими.',
    namePlaceholder: 'Название (например, «Школа №5»)',
    createBtn: 'Создать аккаунт школы',
    leaveBtn: 'Покинуть аккаунт школы',
  },
  business: {
    title: 'Аккаунт предприятия',
    hint: 'Объедините показания нескольких сотрудников в одном аккаунте — сводка и питомец станут общими.',
    namePlaceholder: 'Название (например, «Наша компания»)',
    createBtn: 'Создать аккаунт предприятия',
    leaveBtn: 'Покинуть аккаунт предприятия',
  },
};

function applyHouseholdLabels() {
  const type = (window.appAuth && window.appAuth.user && window.appAuth.user.type) || 'household';
  const labels = HOUSEHOLD_LABELS[type] || HOUSEHOLD_LABELS.household;

  const title = householdEl('household-title');
  const hint = householdEl('household-hint');
  const nameInput = householdEl('household-name-input');
  const createBtn = householdEl('household-create-btn');
  const leaveBtn = householdEl('household-leave-btn');

  if (title) title.textContent = labels.title;
  if (hint) hint.textContent = labels.hint;
  if (nameInput) nameInput.placeholder = labels.namePlaceholder;
  if (createBtn) createBtn.textContent = labels.createBtn;
  if (leaveBtn) leaveBtn.textContent = labels.leaveBtn;
}

function setHouseholdMessage(text, kind) {
  const el = householdEl('household-msg');
  if (!el) return;
  el.textContent = text || '';
  el.className = `profile-msg${text ? ` show ${kind || 'ok'}` : ''}`;
}

async function loadHousehold() {
  const section = householdEl('household-section');
  if (!section || !window.appAuth || !window.appAuth.user) {
    if (section) section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');
  applyHouseholdLabels();

  try {
    const { household, members } = await api.getHousehold();
    renderHousehold(household, members);
  } catch (err) {
    console.error('Не удалось загрузить домохозяйство:', err);
  }
}

function renderHousehold(household, members) {
  const noHousehold = householdEl('household-none');
  const hasHousehold = householdEl('household-active');
  if (!noHousehold || !hasHousehold) return;

  if (!household) {
    noHousehold.classList.remove('hidden');
    hasHousehold.classList.add('hidden');
    return;
  }

  noHousehold.classList.add('hidden');
  hasHousehold.classList.remove('hidden');

  householdEl('household-name').textContent = household.name;
  householdEl('household-code').textContent = household.inviteCode;
  householdEl('household-members').innerHTML = members
    .map((m) => `
      <div class="profile-row">
        <span class="profile-row-label">${m.name}${m.id === household.ownerId ? ' (владелец)' : ''}</span>
        <span class="profile-row-value">${m.email}</span>
      </div>`)
    .join('');
}

document.addEventListener('DOMContentLoaded', () => {
  const createForm = householdEl('household-create-form');
  if (createForm) {
    createForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      setHouseholdMessage('');
      const name = householdEl('household-name-input').value.trim();
      const btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        await api.createHousehold(name);
        e.target.reset();
        setHouseholdMessage('Домохозяйство создано', 'ok');
        await loadHousehold();
        if (typeof window.checkAndRenderAchievements === 'function') window.checkAndRenderAchievements();
      } catch (err) {
        setHouseholdMessage(err.message || 'Не удалось создать домохозяйство', 'err');
      } finally {
        btn.disabled = false;
      }
    });
  }

  const joinForm = householdEl('household-join-form');
  if (joinForm) {
    joinForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      setHouseholdMessage('');
      const code = householdEl('household-code-input').value.trim();
      const btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        await api.joinHousehold(code);
        e.target.reset();
        setHouseholdMessage('Вы присоединились к домохозяйству', 'ok');
        await loadHousehold();
        if (typeof window.checkAndRenderAchievements === 'function') window.checkAndRenderAchievements();
      } catch (err) {
        setHouseholdMessage(err.message || 'Не удалось присоединиться', 'err');
      } finally {
        btn.disabled = false;
      }
    });
  }

  const leaveBtn = householdEl('household-leave-btn');
  if (leaveBtn) {
    leaveBtn.addEventListener('click', async () => {
      if (!confirm('Покинуть домохозяйство?')) return;
      try {
        await api.leaveHousehold();
        setHouseholdMessage('Вы вышли из домохозяйства', 'ok');
        await loadHousehold();
      } catch (err) {
        setHouseholdMessage(err.message || 'Не удалось выйти', 'err');
      }
    });
  }
});

window.loadHousehold = loadHousehold;
