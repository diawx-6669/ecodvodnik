// Главная логика фронтенда: загрузка данных, обновление дашборда, чат с питомцем.

async function loadDashboard() {
  try {
    const { summary, pet } = await api.getSummary();
    renderSummary(summary);
    renderPetState(pet);

    const { recommendations } = await api.getRecommendations();
    renderRecommendations(recommendations);
  } catch (err) {
    console.error('Не удалось загрузить дашборд:', err);
  }
}

function renderSummary(summary) {
  document.getElementById('water-total').textContent = `${summary.water.total_liters} л`;
  document.getElementById('water-cost').textContent = `${summary.water.cost_kzt} ₸`;

  document.getElementById('electricity-total').textContent = `${summary.electricity.total_kwh} кВт·ч`;
  document.getElementById('electricity-cost').textContent = `${summary.electricity.cost_kzt} ₸`;

  document.getElementById('total-cost').textContent = `${summary.total_cost_kzt} ₸`;

  const waterTrend = formatTrend(summary.water.trend_percent);
  const elecTrend = formatTrend(summary.electricity.trend_percent);
  document.getElementById('water-trend').textContent = waterTrend.text;
  document.getElementById('electricity-trend').textContent = elecTrend.text;

  const anomaliesEl = document.getElementById('anomalies');
  anomaliesEl.innerHTML = '';
  summary.anomalies.forEach((a) => {
    const div = document.createElement('div');
    div.className = 'anomaly-item';
    div.textContent = `⚠️ ${a.message}`;
    anomaliesEl.appendChild(div);
  });
}

function renderRecommendations(recommendations) {
  const container = document.getElementById('recommendations');
  container.innerHTML = '';
  recommendations.forEach((rec) => {
    const div = document.createElement('div');
    div.className = 'recommendation-item';
    div.innerHTML = `
      <div class="rec-title">${rec.title}</div>
      <div class="rec-detail">${rec.detail}</div>
      <div class="rec-savings">Потенциальная экономия: ~${rec.estimated_savings_kzt_per_month} ₸/мес</div>
    `;
    container.appendChild(div);
  });
}

async function loadChatHistory() {
  try {
    const history = await api.getHistory();
    history.slice(-10).forEach((m) => appendChatMessage(m.from, m.text));
  } catch (err) {
    console.error('Не удалось загрузить историю чата:', err);
  }
}

// --- Обработчики форм ---

document.getElementById('chat-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message) return;

  appendChatMessage('user', message);
  input.value = '';

  try {
    const { reply, pet } = await api.sendMessage(message);
    appendChatMessage('pet', reply);
    renderPetState(pet);
  } catch (err) {
    appendChatMessage('pet', 'Ой, у меня что-то со связью... попробуй ещё раз.');
    console.error(err);
  }
});

document.getElementById('reading-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const type = document.getElementById('reading-type').value;
  const value = document.getElementById('reading-value').value;
  if (!value) return;

  try {
    await api.addReading(type, value);
    document.getElementById('reading-value').value = '';
    await loadDashboard();
  } catch (err) {
    console.error('Не удалось добавить показание:', err);
  }
});

// --- Инициализация ---
loadDashboard();
loadChatHistory();

// Автообновление дашборда раз в 30 секунд (например, чтобы видеть данные с Arduino)
setInterval(loadDashboard, 30000);
