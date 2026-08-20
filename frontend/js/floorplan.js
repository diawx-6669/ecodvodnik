// ===================== План помещения: загрузка и распознавание =====================
// MVP: полностью на клиенте, через OpenCV.js (WASM), без нового бэкенда.
//
// Пайплайн: grayscale -> размытие -> Canny -> дилатация ->
// findContours (RETR_TREE, с иерархией) -> approxPolyDP (упрощение до
// многоугольника) -> самый крупный контур = внешний периметр помещения,
// следующие по площади контуры = внутренние области (отдельные комнаты).
//
// Масштаб "пиксели -> метры" задаётся пользователем вручную: он отмечает
// 2 точки на плане (например, концы стены) и вводит её реальную длину.
// Без этого шага перевести контур в метры невозможно — на фото плана нет
// метаданных о масштабе.
//
// Результат кладётся в window.EcotchiFloorplan = { outer, rooms, area }
// (координаты в метрах, {x, z}), откуда twin.js забирает его при
// генерации 3D-модели.

const fpState = {
  img: null,
  srcCanvas: null,   // офф-скрин канвас с чистым изображением (для OpenCV)
  canvas: null,      // видимый канвас (изображение + оверлей)
  ctx: null,
  calibPoints: [],
  scale: null,       // метров на пиксель
  outer: null,       // [{x,y}] в пикселях
  rooms: [],         // [[{x,y}...], ...] в пикселях
};

function fpInit() {
  const fileInput = document.getElementById('fp-file');
  if (!fileInput) return; // блока плана нет в DOM

  fpState.canvas = document.getElementById('fp-canvas');
  fpState.ctx = fpState.canvas.getContext('2d');
  fpState.srcCanvas = document.createElement('canvas');

  fileInput.addEventListener('change', fpOnFile);
  fpState.canvas.addEventListener('click', fpOnCanvasClick);
  document.getElementById('fp-set-scale-btn').addEventListener('click', fpSetScale);
  document.getElementById('fp-detect-btn').addEventListener('click', () => fpWaitForCv(fpDetect));
  document.getElementById('fp-apply-btn').addEventListener('click', fpApplyToTwin);
  document.getElementById('fp-clear-btn').addEventListener('click', fpClear);
}

function fpOnFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const img = new Image();
  img.onload = () => {
    fpState.img = img;

    const maxW = 640;
    const fit = Math.min(1, maxW / img.width);
    const w = Math.round(img.width * fit);
    const h = Math.round(img.height * fit);

    fpState.canvas.width = w;
    fpState.canvas.height = h;
    fpState.srcCanvas.width = w;
    fpState.srcCanvas.height = h;
    fpState.srcCanvas.getContext('2d').drawImage(img, 0, 0, w, h);

    fpState.calibPoints = [];
    fpState.scale = null;
    fpState.outer = null;
    fpState.rooms = [];
    document.getElementById('fp-apply-btn').disabled = true;

    fpRedraw();
    fpSetStatus('Изображение загружено. Отметьте 2 точки на отрезке с известной длиной (например, стена).');
  };
  img.src = URL.createObjectURL(file);
}

function fpOnCanvasClick(e) {
  if (!fpState.img) return;
  if (fpState.calibPoints.length >= 2) fpState.calibPoints = [];

  const rect = fpState.canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (fpState.canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (fpState.canvas.height / rect.height);
  fpState.calibPoints.push({ x, y });

  fpRedraw();
  fpSetStatus(fpState.calibPoints.length === 2
    ? 'Точки отмечены. Введите реальную длину отрезка в метрах и нажмите «Задать масштаб».'
    : 'Отмечена 1 точка — кликните вторую на том же отрезке.');
}

function fpSetScale() {
  if (fpState.calibPoints.length < 2) {
    fpSetStatus('Сначала отметьте 2 точки на плане (клик по изображению).');
    return;
  }
  const distM = Number(document.getElementById('fp-calib-dist').value);
  if (!distM || distM <= 0) {
    fpSetStatus('Укажите реальную длину отмеченного отрезка в метрах.');
    return;
  }
  const [a, b] = fpState.calibPoints;
  const pxDist = Math.hypot(b.x - a.x, b.y - a.y);
  if (pxDist < 3) {
    fpSetStatus('Точки слишком близко — отметьте их заново.');
    return;
  }
  fpState.scale = distM / pxDist;
  fpSetStatus(`Масштаб задан: 1 px ≈ ${fpState.scale.toFixed(4)} м. Теперь нажмите «Распознать план».`);
}

function fpWaitForCv(cb, triesLeft = 30) {
  if (typeof cv !== 'undefined' && cv.Mat) { cb(); return; }
  if (triesLeft <= 0) {
    fpSetStatus('Модуль распознавания (OpenCV.js) не загрузился — проверьте подключение к интернету и повторите.');
    return;
  }
  fpSetStatus('Загружается модуль распознавания…');
  setTimeout(() => fpWaitForCv(cb, triesLeft - 1), 300);
}

function fpDetect() {
  if (!fpState.img) { fpSetStatus('Сначала загрузите изображение плана.'); return; }
  if (!fpState.scale) { fpSetStatus('Сначала задайте масштаб (2 точки + длина в метрах).'); return; }

  const src = cv.imread(fpState.srcCanvas);
  const gray = new cv.Mat();
  const edges = new cv.Mat();
  const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
    cv.Canny(gray, edges, 50, 150);
    cv.dilate(edges, edges, kernel);
    cv.findContours(edges, contours, hierarchy, cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE);

    const minArea = fpState.srcCanvas.width * fpState.srcCanvas.height * 0.01;
    const candidates = [];
    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i);
      const area = cv.contourArea(cnt);
      if (area >= minArea) {
        const peri = cv.arcLength(cnt, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(cnt, approx, 0.01 * peri, true);
        const pts = [];
        for (let j = 0; j < approx.rows; j++) {
          pts.push({ x: approx.data32S[j * 2], y: approx.data32S[j * 2 + 1] });
        }
        if (pts.length >= 3) candidates.push({ area, pts });
        approx.delete();
      }
      cnt.delete();
    }

    candidates.sort((a, b) => b.area - a.area);
    fpState.outer = candidates.length ? candidates[0].pts : null;
    fpState.rooms = candidates.slice(1, 6).map((c) => c.pts);
  } finally {
    src.delete(); gray.delete(); edges.delete(); kernel.delete(); contours.delete(); hierarchy.delete();
  }

  fpRedraw();

  if (!fpState.outer) {
    fpSetStatus('Не удалось найти чёткий контур помещения. Попробуйте более контрастное фото/скан плана (тёмные линии на светлом фоне).');
    document.getElementById('fp-apply-btn').disabled = true;
  } else {
    const roomsMsg = fpState.rooms.length
      ? `и ${fpState.rooms.length} внутренних область(ей), похожих на отдельные комнаты`
      : 'внутренние комнаты выделить не удалось — будет использован только внешний контур';
    fpSetStatus(`Найден внешний контур помещения ${roomsMsg}. Проверьте контуры на превью (синий/зелёный) и нажмите «Построить 3D по плану».`);
    document.getElementById('fp-apply-btn').disabled = false;
  }
}

function fpRedraw() {
  const { ctx, canvas, img } = fpState;
  if (!img) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  fpState.rooms.forEach((r) => fpDrawPolygon(r, '#35e08f', 1.6));
  if (fpState.outer) fpDrawPolygon(fpState.outer, '#45d9ff', 2.5);

  ctx.fillStyle = '#ffb23f';
  fpState.calibPoints.forEach((p) => {
    ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
  });
  if (fpState.calibPoints.length === 2) {
    ctx.strokeStyle = '#ffb23f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(fpState.calibPoints[0].x, fpState.calibPoints[0].y);
    ctx.lineTo(fpState.calibPoints[1].x, fpState.calibPoints[1].y);
    ctx.stroke();
  }
}

function fpDrawPolygon(points, color, width) {
  const { ctx } = fpState;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  ctx.stroke();
}

// ---------- перевод в метры и передача в twin.js ----------
function fpToMeters(points, cx, cy) {
  return points.map((p) => ({
    x: (p.x - cx) * fpState.scale,
    z: (p.y - cy) * fpState.scale,
  }));
}

function fpPolygonArea(points) {
  // формула шнурков
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.z - b.x * a.z;
  }
  return Math.abs(area / 2);
}

function fpApplyToTwin() {
  if (!fpState.outer) return;

  const cx = fpState.outer.reduce((s, p) => s + p.x, 0) / fpState.outer.length;
  const cy = fpState.outer.reduce((s, p) => s + p.y, 0) / fpState.outer.length;

  const outerM = fpToMeters(fpState.outer, cx, cy);
  const roomsM = fpState.rooms.map((r) => fpToMeters(r, cx, cy));
  const area = fpPolygonArea(outerM);

  window.EcotchiFloorplan = { outer: outerM, rooms: roomsM, area };

  const areaInput = document.getElementById('twin-area');
  if (areaInput) areaInput.value = Math.max(6, Math.round(area));

  fpSetStatus(`Применено: площадь по плану ≈ ${area.toFixed(1)} м². Строю 3D-модель по реальной форме…`);

  const genBtn = document.getElementById('twin-generate-btn');
  if (genBtn) genBtn.click();
}

function fpClear() {
  window.EcotchiFloorplan = null;
  fpState.outer = null;
  fpState.rooms = [];
  fpState.calibPoints = [];
  document.getElementById('fp-apply-btn').disabled = true;
  fpRedraw();
  fpSetStatus('План сброшен — модель снова строится по площади/типу объекта.');

  const genBtn = document.getElementById('twin-generate-btn');
  if (genBtn) genBtn.click();
}

function fpSetStatus(text) {
  const el = document.getElementById('fp-status');
  if (el) el.textContent = text;
}

document.addEventListener('DOMContentLoaded', fpInit);
