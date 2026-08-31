// Дашборд «История и графики» — расход воды/электричества по дням, неделям
// или месяцам. Рисуется вручную на <canvas> (без Chart.js/сторонних либ),
// чтобы не тянуть лишнюю зависимость ради пары линий.

let currentHistoryPeriod = 'day';

function drawHistoryChart(canvas, history) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || 600;
  const cssHeight = canvas.clientHeight || 220;
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const padding = { top: 14, right: 14, bottom: 26, left: 40 };
  const w = cssWidth - padding.left - padding.right;
  const h = cssHeight - padding.top - padding.bottom;

  const allValues = [...history.water, ...history.electricity];
  const maxValue = Math.max(1, ...allValues);
  const n = history.labels.length;
  if (n === 0) return;

  const xStep = n > 1 ? w / (n - 1) : 0;
  const yFor = (v) => padding.top + h - (v / maxValue) * h;
  const xFor = (i) => padding.left + i * xStep;

  // Сетка
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  const gridLines = 4;
  for (let g = 0; g <= gridLines; g++) {
    const y = padding.top + (h / gridLines) * g;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + w, y);
    ctx.stroke();
  }

  const drawSeries = (values, color) => {
    ctx.beginPath();
    values.forEach((v, i) => {
      const x = xFor(i);
      const y = yFor(v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Точки
    ctx.fillStyle = color;
    values.forEach((v, i) => {
      ctx.beginPath();
      ctx.arc(xFor(i), yFor(v), 2.6, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  drawSeries(history.water, '#3fd9d0');
  drawSeries(history.electricity, '#ffcf5c');

  // Подписи по X (не все, чтобы не наслаивались на мобильных)
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '10.5px Manrope, sans-serif';
  ctx.textAlign = 'center';
  const labelEvery = Math.max(1, Math.ceil(n / 6));
  history.labels.forEach((label, i) => {
    if (i % labelEvery !== 0 && i !== n - 1) return;
    ctx.fillText(label, xFor(i), cssHeight - 8);
  });
}

async function loadHistoryChart(period) {
  const box = document.getElementById('history-panel');
  if (!box) return;
  if (period) currentHistoryPeriod = period;

  document.querySelectorAll('.history-tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.period === currentHistoryPeriod);
  });

  try {
    const history = await api.getHistory(currentHistoryPeriod);
    const canvas = document.getElementById('history-canvas');
    if (canvas) {
      canvas.dataset.lastHistory = JSON.stringify(history);
      drawHistoryChart(canvas, history);
    }

    const totalWater = history.water.reduce((s, v) => s + v, 0);
    const totalElectricity = history.electricity.reduce((s, v) => s + v, 0);
    const totalsEl = document.getElementById('history-totals');
    if (totalsEl) {
      totalsEl.innerHTML = `
        <span class="history-legend-item"><i style="background:#3fd9d0"></i>Вода: ${Math.round(totalWater)} л</span>
        <span class="history-legend-item"><i style="background:#ffcf5c"></i>Электричество: ${Math.round(totalElectricity * 10) / 10} кВт·ч</span>
      `;
    }
  } catch (err) {
    console.error('Не удалось загрузить историю расхода:', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.history-tab').forEach((tab) => {
    tab.addEventListener('click', () => loadHistoryChart(tab.dataset.period));
  });
  window.addEventListener('resize', () => {
    const canvas = document.getElementById('history-canvas');
    if (canvas && canvas.dataset.lastHistory) {
      drawHistoryChart(canvas, JSON.parse(canvas.dataset.lastHistory));
    }
  });
});

window.loadHistoryChart = loadHistoryChart;
