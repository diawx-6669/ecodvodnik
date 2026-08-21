// Персонализированные советы по экономии (детерминированные, на основе
// реальных данных пользователя — см. backend/services/tipsService.js).

async function loadTips() {
  const box = document.getElementById('tips-list');
  if (!box) return;
  try {
    const { tips } = await api.getTips();
    box.innerHTML = tips
      .map((t) => `
        <div class="tip-item">
          <div class="tip-item-head">
            <span class="tip-item-title">${t.title}</span>
            <span class="tip-item-savings">${t.savingsHint}</span>
          </div>
          <div class="tip-item-detail">${t.detail}</div>
          <div class="tip-item-reason">${t.reason}</div>
        </div>`)
      .join('');
  } catch (err) {
    console.error('Не удалось загрузить советы по экономии:', err);
  }
}

window.loadTips = loadTips;
