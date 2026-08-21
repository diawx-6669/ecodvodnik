// Достижения и геймификация: показывает каталог квестов/достижений,
// прогресс по XP и открывает новые ачивки, когда условия выполнены.

let achievementToastQueue = [];
let achievementToastShowing = false;

function showAchievementToast(ach) {
  achievementToastQueue.push(ach);
  if (achievementToastShowing) return;
  processAchievementToastQueue();
}

function processAchievementToastQueue() {
  const ach = achievementToastQueue.shift();
  if (!ach) {
    achievementToastShowing = false;
    return;
  }
  achievementToastShowing = true;

  let toast = document.getElementById('achievement-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'achievement-toast';
    toast.className = 'achievement-toast';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `
    <span class="achievement-toast-icon">${ach.icon}</span>
    <span class="achievement-toast-body">
      <span class="achievement-toast-title">Новое достижение!</span>
      <span class="achievement-toast-name">${ach.title}</span>
    </span>
  `;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(processAchievementToastQueue, 350);
  }, 3200);
}

function renderAchievements(view) {
  const grid = document.getElementById('achievements-grid');
  const progressEl = document.getElementById('achievements-progress');
  if (progressEl) {
    progressEl.textContent = `${view.unlockedCount} из ${view.totalCount} · ${view.totalXp} XP`;
  }
  if (!grid) return;

  grid.innerHTML = view.achievements
    .map((a) => `
      <div class="achievement-card ${a.unlocked ? 'unlocked' : 'locked'}" title="${a.description}">
        <div class="achievement-card-icon">${a.icon}</div>
        <div class="achievement-card-title">${a.title}</div>
        <div class="achievement-card-desc">${a.description}</div>
        ${a.unlocked ? `<div class="achievement-card-xp">+${a.xpReward} XP</div>` : '<div class="achievement-card-lock">🔒</div>'}
      </div>`)
    .join('');
}

async function loadAchievements() {
  if (!window.appAuth || !window.appAuth.user) {
    // Достижения доступны только зарегистрированным пользователям — гостю
    // некуда сохранять прогресс между сессиями.
    const box = document.getElementById('achievements-panel');
    if (box) box.classList.add('hidden');
    return;
  }
  const box = document.getElementById('achievements-panel');
  if (box) box.classList.remove('hidden');

  try {
    const view = await api.getAchievements();
    renderAchievements(view);
  } catch (err) {
    console.error('Не удалось загрузить достижения:', err);
  }
}

// Пересчитывает условия на сервере и, если появились новые достижения,
// показывает всплывающее уведомление + обновляет сетку.
async function checkAndRenderAchievements() {
  if (!window.appAuth || !window.appAuth.user) return;
  try {
    const view = await api.checkAchievements();
    renderAchievements(view);
    (view.newlyUnlocked || []).forEach(showAchievementToast);
  } catch (err) {
    console.error('Не удалось проверить достижения:', err);
  }
}

window.loadAchievements = loadAchievements;
window.checkAndRenderAchievements = checkAndRenderAchievements;
