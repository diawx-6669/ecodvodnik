// ===================== План помещения: загрузка и распознавание =====================
// MVP: полностью на клиенте, через OpenCV.js (WASM), без нового бэкенда.

const fpState = {
  img: null,
  srcCanvas: null,
  canvas: null,
  ctx: null,
  calibPoints: [],
  scale: null,
  outer: null,
  rooms: [],
  objectUrl: null,
};

const FP_SUPPORTED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

function fpInit() {
  const fileInput = document.getElementById('fp-file');
  if (!fileInput) return;

  fpState.canvas = document.getElementById('fp-canvas');
  if (!fpState.canvas) return;

  fpState.ctx = fpState.canvas.getContext('2d');
  fpState.srcCanvas = document.createElement('canvas');

  fileInput.addEventListener('change', fpOnFile);
  fpState.canvas.addEventListener('click', fpOnCanvasClick);
  document.getElementById('fp-set-scale-btn').addEventListener('click', fpSetScale);
  document.getElementById('fp-detect-btn').addEventListener('click', () => fpWaitForCv(fpDetect));
  document.getElementById('fp-apply-btn').addEventListener('click', fpApplyToTwin);
  document.getElementById('fp-clear-btn').addEventListener('click', fpClear);

  const dropZone = document.getElementById('fp-drop-zone');
  if (dropZone) {
    ['dragenter', 'dragover'].forEach((evt) => {
      dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropZone.classList.add('fp-drop-active');
      });
    });
    ['dragleave', 'drop'].forEach((evt) => {
      dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropZone.classList.remove('fp-drop-active');
      });
    });
    dropZone.addEventListener('drop', (e) => {
      const file = e.dataTransfer?.files?.[0];
      if (file) fpLoadFile(file);
    });
  }

  fpDrawPlaceholder();
  fpSetStatus('Загрузите изображение плана (JPG/PNG/WEBP), затем отметьте масштаб и распознайте контур.');
}

function fpIsSupportedFile(file) {
  if (!file) return false;
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.heic') || name.endsWith('.heif') || file.type === 'image/heic' || file.type === 'image/heif') {
    return false;
  }
  if (file.type && FP_SUPPORTED_TYPES.has(file.type)) return true;
  return /\.(jpe?g|png|webp|gif)$/i.test(name);
}

function fpOnFile(e) {
  const file = e.target.files?.[0];
  if (file) fpLoadFile(file);
  e.target.value = '';
}

function fpLoadFile(file) {
  if (!fpIsSupportedFile(file)) {
    fpSetStatus('Этот формат не поддерживается. Сохраните план как JPG или PNG (на iPhone: «Наиболее совместимый» в настройках камеры).');
    return;
  }

  fpSetStatus(`Загружаю «${file.name}»…`);

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => fpApplyLoadedImage(img, file.name);
    img.onerror = () => {
      fpSetStatus('Браузер не смог открыть файл. Попробуйте JPG/PNG или другое фото.');
      fpDrawPlaceholder();
    };
    img.src = reader.result;
  };
  reader.onerror = () => fpSetStatus('Не удалось прочитать файл. Попробуйте выбрать его ещё раз.');
  reader.readAsDataURL(file);
}

function fpApplyLoadedImage(img, fileName) {
  if (!img.width || !img.height) {
    fpSetStatus('Изображение пустое или повреждено — выберите другой файл.');
    fpDrawPlaceholder();
    return;
  }

  if (fpState.objectUrl) {
    URL.revokeObjectURL(fpState.objectUrl);
    fpState.objectUrl = null;
  }

  fpState.img = img;

  const maxW = 720;
  const fit = Math.min(1, maxW / img.width);
  const w = Math.max(1, Math.round(img.width * fit));
  const h = Math.max(1, Math.round(img.height * fit));

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

  fpToggleEmptyOverlay(false);
  fpRedraw();
  fpSetStatus(`План «${fileName}» загружен (${w}×${h} px). Отметьте 2 точки на стене с известной длиной и задайте масштаб.`);
}

function fpToggleEmptyOverlay(show) {
  const empty = document.getElementById('fp-canvas-empty');
  if (empty) empty.classList.toggle('hidden', !show);
}

function fpDrawPlaceholder() {
  if (!fpState.ctx || !fpState.canvas) return;
  const w = fpState.canvas.width || 720;
  const h = fpState.canvas.height || 360;
  if (!fpState.canvas.width) {
    fpState.canvas.width = w;
    fpState.canvas.height = h;
  }
  fpState.ctx.fillStyle = '#0c1614';
  fpState.ctx.fillRect(0, 0, w, h);
  fpState.ctx.fillStyle = 'rgba(143, 166, 160, 0.85)';
  fpState.ctx.font = '14px Manrope, sans-serif';
  fpState.ctx.textAlign = 'center';
  fpState.ctx.fillText('Здесь появится загруженный план', w / 2, h / 2);
  fpToggleEmptyOverlay(true);
}

function fpOnCanvasClick(e) {
  if (!fpState.img) {
    fpSetStatus('Сначала загрузите изображение плана.');
    return;
  }
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
  if (!fpState.img) {
    fpSetStatus('Сначала загрузите изображение плана.');
    return;
  }
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
  fpSetStatus(`Масштаб задан: 1 px ≈ ${fpState.scale.toFixed(4)} м. Нажмите «Распознать план».`);
}

function fpEnsureAutoScale() {
  if (fpState.scale) return true;
  if (!fpState.srcCanvas?.width) return false;
  fpState.scale = 10 / fpState.srcCanvas.width;
  fpSetStatus('Масштаб оценён автоматически (ширина плана ≈ 10 м). Для точности отметьте 2 точки и задайте масштаб вручную.');
  return true;
}

function fpWaitForCv(cb, triesLeft = 80) {
  if (typeof cv !== 'undefined' && cv.Mat) {
    cb();
    return;
  }
  if (triesLeft <= 0) {
    fpSetStatus('Модуль распознавания (OpenCV) не загрузился. Проверьте интернет и обновите страницу.');
    return;
  }
  if (triesLeft === 80 || triesLeft % 10 === 0) {
    fpSetStatus('Загружается модуль распознавания…');
  }
  setTimeout(() => fpWaitForCv(cb, triesLeft - 1), 400);
}

function fpDetect() {
  if (!fpState.img) {
    fpSetStatus('Сначала загрузите изображение плана.');
    return;
  }
  if (!fpEnsureAutoScale()) {
    fpSetStatus('Не удалось определить масштаб — загрузите план заново.');
    return;
  }

  const src = cv.imread(fpState.srcCanvas);
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const edges = new cv.Mat();
  const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    cv.Canny(blurred, edges, 40, 140);
    cv.dilate(edges, edges, kernel, new cv.Point(-1, -1), 2);
    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    const minArea = fpState.srcCanvas.width * fpState.srcCanvas.height * 0.008;
    const candidates = [];

    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i);
      const area = cv.contourArea(cnt);
      if (area >= minArea) {
        const peri = cv.arcLength(cnt, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(cnt, approx, 0.015 * peri, true);
        const pts = [];
        for (let j = 0; j < approx.rows; j++) {
          pts.push({ x: approx.data32S[j * 2], y: approx.data32S[j * 2 + 1] });
        }

        let keep = pts.length >= 4 && pts.length <= 24;
        if (keep) {
          const hull = new cv.Mat();
          cv.convexHull(cnt, hull, false, true);
          const hullArea = cv.contourArea(hull);
          const solidity = hullArea > 0 ? area / hullArea : 0;
          hull.delete();

          const rect = cv.boundingRect(cnt);
          const rectArea = rect.width * rect.height;
          const extent = rectArea > 0 ? area / rectArea : 0;

          keep = solidity >= 0.5 && extent >= 0.22;
        }

        if (keep) candidates.push({ area, pts });
        approx.delete();
      }
      cnt.delete();
    }

    candidates.sort((a, b) => b.area - a.area);
    fpState.outer = candidates.length ? candidates[0].pts : null;
    fpState.rooms = candidates.slice(1, 6).map((c) => c.pts);
  } finally {
    src.delete();
    gray.delete();
    blurred.delete();
    edges.delete();
    kernel.delete();
    contours.delete();
    hierarchy.delete();
  }

  fpRedraw();

  if (!fpState.outer) {
    fpSetStatus('Контур не найден автоматически. Попробуйте более чёткий план (контрастные стены на светлом фоне) или задайте масштаб точнее.');
    document.getElementById('fp-apply-btn').disabled = true;
  } else {
    const roomsMsg = fpState.rooms.length
      ? `и ${fpState.rooms.length} внутренних областей`
      : 'только внешний контур';
    fpSetStatus(`Найден контур помещения ${roomsMsg}. Проверьте синий/зелёный контур и нажмите «Построить 3D по плану».`);
    document.getElementById('fp-apply-btn').disabled = false;
  }
}

function fpRedraw() {
  const { ctx, canvas, img } = fpState;
  if (!img || !ctx || !canvas) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(fpState.srcCanvas, 0, 0);

  fpState.rooms.forEach((r) => fpDrawPolygon(r, '#35e08f', 1.6));
  if (fpState.outer) fpDrawPolygon(fpState.outer, '#45d9ff', 2.5);

  ctx.fillStyle = '#ffb23f';
  fpState.calibPoints.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fill();
  });

  if (fpState.calibPoints.length === 2) {
    ctx.strokeStyle = '#ffb23f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(fpState.calibPoints[0].x, fpState.calibPoints[0].y);
    ctx.lineTo(fpState.calibPoints[1].x, fpState.calibPoints[1].y);
    ctx.stroke();
  }

  fpToggleEmptyOverlay(false);
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

function fpToMeters(points, cx, cy) {
  return points.map((p) => ({
    x: (p.x - cx) * fpState.scale,
    z: (p.y - cy) * fpState.scale,
  }));
}

function fpPolygonArea(points) {
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

  fpSetStatus(`Применено: площадь по плану ≈ ${area.toFixed(1)} м². Строю 3D-модель…`);

  const genBtn = document.getElementById('twin-generate-btn');
  if (genBtn) genBtn.click();
}

function fpClear() {
  window.EcotchiFloorplan = null;
  fpState.img = null;
  fpState.outer = null;
  fpState.rooms = [];
  fpState.calibPoints = [];
  fpState.scale = null;

  if (fpState.objectUrl) {
    URL.revokeObjectURL(fpState.objectUrl);
    fpState.objectUrl = null;
  }

  document.getElementById('fp-apply-btn').disabled = true;
  fpDrawPlaceholder();
  fpSetStatus('План сброшен — модель снова строится по площади и типу объекта.');

  const genBtn = document.getElementById('twin-generate-btn');
  if (genBtn) genBtn.click();
}

function fpSetStatus(text) {
  const el = document.getElementById('fp-status');
  if (el) el.textContent = text;
}

document.addEventListener('DOMContentLoaded', fpInit);
