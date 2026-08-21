// Семейный аккаунт: создание/присоединение по коду, список участников,
// выход из домохозяйства. Рендерится внутри модалки профиля.

function householdEl(id) {
  return document.getElementById(id);
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
        <span class="profile-row-label">${m.name}${m.id === household.ownerId ? ' 👑' : ''}</span>
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
