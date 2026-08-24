// ===================== План помещения: загрузка и распознавание =====================
// MVP: полностью на клиенте, через OpenCV.js (WASM), без нового бэкенда.

const fpState = {
  img: null,
  srcCanvas: null,
  canvas: null,
  ctx: null,
  calibDraft: [],
  calibRefs: [],
  scale: null,
  scaleManual: false,
  outer: null,
  outerIsManual: false,
  rooms: [],
  windows: [],
  windowDraft: [],
  mode: 'calib',
  wallSegments: [],
  currentWallSegment: [],
  objectUrl: null,
};

const FP_SUPPORTED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const FP_MAX_FILE_MB = 80;
const FP_LARGE_FILE_MB = 8;
const FP_MAX_SOURCE_PX = 4096;
const FP_PREVIEW_MAX_W = 720;
const FP_SNAP_PX = 14;

let fpLoadToken = 0;

function fpInit() {
  const fileInput = document.getElementById('fp-file');
  if (!fileInput) return;

  fpState.canvas = document.getElementById('fp-canvas');
  if (!fpState.canvas) return;

  fpState.ctx = fpState.canvas.getContext('2d');
  fpState.srcCanvas = document.createElement('canvas');

  fileInput.addEventListener('change', fpOnFile);

  const canvasWrap = document.querySelector('.fp-canvas-wrap');
  if (canvasWrap) {
    canvasWrap.addEventListener('click', (e) => {
      if (e.target === fileInput) return;
      fpOnCanvasClick(e);
    });
  } else {
    fpState.canvas.addEventListener('click', fpOnCanvasClick);
  }
  document.getElementById('fp-set-scale-btn').addEventListener('click', fpAddCalibRef);
  document.getElementById('fp-apply-scale-btn')?.addEventListener('click', fpApplyScaleFromRefs);
  document.getElementById('fp-detect-btn').addEventListener('click', () => fpWaitForCv(fpDetect));
  document.getElementById('fp-apply-btn').addEventListener('click', fpApplyToTwin);
  document.getElementById('fp-clear-btn').addEventListener('click', fpClear);

  document.querySelectorAll('.fp-mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => fpSetMode(btn.dataset.mode));
  });
  document.getElementById('fp-undo-point-btn').addEventListener('click', fpUndoPoint);
  document.getElementById('fp-new-wall-seg-btn').addEventListener('click', fpNewWallSegment);
  document.getElementById('fp-connect-btn').addEventListener('click', fpConnectNeighbors);
  document.getElementById('fp-finish-wall-btn').addEventListener('click', fpFinishWall);

  document.getElementById('fp-add-dim-btn')?.addEventListener('click', () => fpAddDimRow());
  document.getElementById('fp-manual-area')?.addEventListener('input', fpUpdateAreaPreview);
  document.getElementById('fp-calib-unit')?.addEventListener('change', fpRenderCalibList);

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

function fpReleaseImage() {
  if (fpState.img?.close) {
    try { fpState.img.close(); } catch (_) { /* ignore */ }
  }
  fpState.img = null;
  if (fpState.objectUrl) {
    URL.revokeObjectURL(fpState.objectUrl);
    fpState.objectUrl = null;
  }
}

function fpSetLoading(on) {
  const wrap = document.querySelector('.fp-canvas-wrap');
  if (wrap) wrap.classList.toggle('fp-loading', on);
  const fileBtn = document.querySelector('.fp-file-btn');
  if (fileBtn) fileBtn.classList.toggle('fp-loading', on);
  const fileInput = document.getElementById('fp-file');
  if (fileInput) fileInput.disabled = on;
}

function fpFormatSizeMb(bytes) {
  return (bytes / (1024 * 1024)).toFixed(1);
}

async function fpDecodeImageFile(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      const maxDim = Math.max(bitmap.width, bitmap.height);
      if (maxDim > FP_MAX_SOURCE_PX) {
        const scale = FP_MAX_SOURCE_PX / maxDim;
        const rw = Math.max(1, Math.round(bitmap.width * scale));
        const rh = Math.max(1, Math.round(bitmap.height * scale));
        const resized = await createImageBitmap(bitmap, {
          resizeWidth: rw,
          resizeHeight: rh,
          resizeQuality: 'high',
        });
        bitmap.close();
        return resized;
      }
      return bitmap;
    } catch (_) {
      // Safari/старые браузеры — fallback через object URL ниже
    }
  }

  const objectUrl = URL.createObjectURL(file);
  fpState.objectUrl = objectUrl;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => reject(new Error('timeout')), 90000);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error('decode'));
    };
    img.src = objectUrl;
  });
}

async function fpLoadFile(file) {
  if (!fpIsSupportedFile(file)) {
    fpSetStatus('Этот формат не поддерживается. Сохраните план как JPG или PNG (на iPhone: «Наиболее совместимый» в настройках камеры).');
    return;
  }

  const sizeMb = file.size / (1024 * 1024);
  if (sizeMb > FP_MAX_FILE_MB) {
    fpSetStatus(`Файл слишком большой (${fpFormatSizeMb(file.size)} МБ). Экспортируйте рендер как JPG/PNG до ${FP_MAX_SOURCE_PX} px — обычно хватает 2–8 МБ.`);
    return;
  }

  const token = ++fpLoadToken;
  fpReleaseImage();
  fpSetLoading(true);
  fpSetStatus(
    sizeMb >= FP_LARGE_FILE_MB
      ? `Обрабатываю «${file.name}» (${fpFormatSizeMb(file.size)} МБ). Большие рендеры могут грузиться до минуты…`
      : `Загружаю «${file.name}»…`,
  );

  try {
    const source = await fpDecodeImageFile(file);
    if (token !== fpLoadToken) {
      source?.close?.();
      return;
    }
    fpApplyLoadedImage(source, file.name, sizeMb);
  } catch (err) {
    if (token !== fpLoadToken) return;
    console.error('floorplan load:', err);
    fpSetStatus(
      sizeMb >= FP_LARGE_FILE_MB
        ? 'Не удалось обработать большой рендер. Сохраните как JPG (качество 85%, ширина до 4096 px) и попробуйте снова.'
        : 'Браузер не смог открыть файл. Сохраните как JPG или PNG (не EXR/TIFF).',
    );
    fpDrawPlaceholder();
  } finally {
    if (token === fpLoadToken) fpSetLoading(false);
  }
}

function fpApplyLoadedImage(source, fileName, sizeMb = 0) {
  if (!source?.width || !source?.height) {
    fpSetStatus('Изображение пустое или повреждено — выберите другой файл.');
    fpDrawPlaceholder();
    return;
  }

  const srcW = source.width;
  const srcH = source.height;
  const fit = Math.min(1, FP_PREVIEW_MAX_W / srcW);
  const w = Math.max(1, Math.round(srcW * fit));
  const h = Math.max(1, Math.round(srcH * fit));

  fpState.canvas.width = w;
  fpState.canvas.height = h;
  fpState.srcCanvas.width = w;
  fpState.srcCanvas.height = h;
  fpState.srcCanvas.getContext('2d').drawImage(source, 0, 0, w, h);

  if (source.close) source.close();
  if (fpState.objectUrl) {
    URL.revokeObjectURL(fpState.objectUrl);
    fpState.objectUrl = null;
  }

  fpState.img = { width: srcW, height: srcH };
  fpState.calibDraft = [];
  fpState.calibRefs = [];
  fpState.scale = null;
  fpState.scaleManual = false;
  fpState.outer = null;
  fpState.outerIsManual = false;
  fpState.rooms = [];
  fpState.windows = [];
  fpState.windowDraft = [];
  fpState.wallSegments = [];
  fpState.currentWallSegment = [];
  fpSetMode('calib');
  document.getElementById('fp-apply-btn').disabled = true;
  document.getElementById('fp-finish-wall-btn').disabled = true;
  fpClearDimRows();
  fpUpdateAreaPreview();
  fpUpdateCalibDraftHint();

  fpToggleEmptyOverlay(false);
  fpRedraw();

  const resizedNote = srcW > FP_MAX_SOURCE_PX || srcH > FP_MAX_SOURCE_PX
    ? ` (исходник ${srcW}×${srcH} px уменьшен для обработки)`
    : '';
  fpSetStatus(`План «${fileName}» загружен (${w}×${h} px)${resizedNote}. Режим «Масштаб»: отметьте 2 точки на стене с цифрой с чертежа (например 400 см) и добавьте отрезок.`);
  fpRenderCalibList();
}

function fpToggleEmptyOverlay(show) {
  const empty = document.getElementById('fp-canvas-empty');
  if (empty) empty.classList.toggle('hidden', !show);
  const wrap = document.querySelector('.fp-canvas-wrap');
  if (wrap) wrap.classList.toggle('fp-has-image', !show);
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
  fpToggleEmptyOverlay(true);
}

function fpWallPointCount() {
  const segPts = fpState.wallSegments.reduce((n, s) => n + s.length, 0);
  return segPts + fpState.currentWallSegment.length;
}

function fpUpdateWallButtons() {
  const finishBtn = document.getElementById('fp-finish-wall-btn');
  const canCloseSingle = fpState.wallSegments.length === 0
    && fpState.currentWallSegment.length >= 3;
  const canConnect = fpState.wallSegments.length > 0 || (
    fpState.wallSegments.length === 0 && fpState.currentWallSegment.length >= 2
  );
  if (finishBtn) finishBtn.disabled = !canCloseSingle;
  const connectBtn = document.getElementById('fp-connect-btn');
  if (connectBtn) connectBtn.disabled = !canConnect && fpState.wallSegments.length === 0;
}

function fpOnCanvasClick(e) {
  if (!fpState.img) {
    const fileInput = document.getElementById('fp-file');
    if (fileInput) fileInput.click();
    else fpSetStatus('Сначала загрузите изображение плана.');
    return;
  }

  const rect = fpState.canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (fpState.canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (fpState.canvas.height / rect.height);

  if (fpState.mode === 'wall') {
    fpState.currentWallSegment.push({ x, y });
    fpRedraw();
    fpUpdateWallButtons();
    const segN = fpState.wallSegments.length + 1;
    fpSetStatus(
      `Точка №${fpState.currentWallSegment.length} в отрезке ${segN}. `
      + 'Кликайте дальше по стене; перед окном нажмите «Новый отрезок стены», затем отметьте окно и продолжите.',
    );
    return;
  }

  if (fpState.mode === 'window') {
    fpState.windowDraft.push({ x, y });
    if (fpState.windowDraft.length === 2) {
      fpState.windows.push(fpState.windowDraft.slice());
      fpState.windowDraft = [];
      fpRedraw();
      fpSetStatus(`Окно отмечено (всего ${fpState.windows.length}). Отметьте ещё окно или нажмите «Соединить соседние точки».`);
    } else {
      fpRedraw();
      fpSetStatus('Отмечена 1 точка окна — кликните вторую на том же проёме.');
    }
    return;
  }

  if (fpState.calibDraft.length >= 2) fpState.calibDraft = [];
  fpState.calibDraft.push({ x, y });

  fpRedraw();
  fpUpdateCalibDraftHint();
  fpSetStatus(fpState.calibDraft.length === 2
    ? 'Отрезок отмечен на плане. Введите длину (400 → «см») и нажмите «Добавить отрезок».'
    : 'Отмечена 1 точка — кликните вторую на том же отрезке стены.');
}

function fpSetMode(mode) {
  fpState.mode = mode;
  document.querySelectorAll('.fp-mode-btn').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.mode === mode);
  });
  fpUpdateWallButtons();
  fpRedraw();

  if (!fpState.img) return;
  if (mode === 'wall') {
    fpSetStatus('Режим «Стены»: отметьте точки одного отрезка стены. Перед проёмом окна — «Новый отрезок стены»; окна — режим «Окна».');
  } else if (mode === 'window') {
    fpSetStatus('Режим «Окна»: 2 точки на проёме (голубой отрезок). Окна соединяют соседние отрезки стен при сборке контура.');
  } else {
    fpSetStatus('Режим «Масштаб»: кликните 2 точки на стене с размером на чертеже → введите длину → «Добавить отрезок». Лучше 2–4 стены, затем «Рассчитать масштаб».');
  }
}

function fpUndoPoint() {
  if (fpState.mode === 'wall') {
    if (fpState.currentWallSegment.length) {
      fpState.currentWallSegment.pop();
    } else if (fpState.wallSegments.length) {
      fpState.currentWallSegment = fpState.wallSegments.pop();
      fpState.currentWallSegment.pop();
    }
  } else if (fpState.mode === 'window') {
    if (fpState.windowDraft.length) fpState.windowDraft.pop();
    else if (fpState.windows.length) fpState.windows.pop();
  } else if (fpState.mode === 'calib') {
    if (fpState.calibDraft.length) fpState.calibDraft.pop();
    else if (fpState.calibRefs.length) {
      fpState.calibRefs.pop();
      fpRenderCalibList();
      if (fpState.calibRefs.length) fpApplyScaleFromRefs(true);
      else {
        fpState.scale = null;
        fpState.scaleManual = false;
      }
    }
  }
  fpUpdateWallButtons();
  fpRedraw();
}

function fpNewWallSegment() {
  if (fpState.currentWallSegment.length < 2) {
    fpSetStatus('Отметьте минимум 2 точки в текущем отрезке, прежде чем начинать новый.');
    return;
  }
  fpState.wallSegments.push(fpState.currentWallSegment.slice());
  fpState.currentWallSegment = [];
  fpUpdateWallButtons();
  fpRedraw();
  fpSetStatus(`Отрезок стены №${fpState.wallSegments.length} сохранён. Начните новый отрезок с другой стороны окна или угла.`);
}

function fpSnapIndex(p, nodes) {
  for (let i = 0; i < nodes.length; i++) {
    if (Math.hypot(nodes[i].x - p.x, nodes[i].y - p.y) < FP_SNAP_PX) return i;
  }
  nodes.push({ x: p.x, y: p.y });
  return nodes.length - 1;
}

function fpCollectWallSegments() {
  const segs = fpState.wallSegments.map((s) => s.slice());
  if (fpState.currentWallSegment.length >= 2) {
    segs.push(fpState.currentWallSegment.slice());
  }
  return segs;
}

function fpOrderPointsByAngle(points) {
  if (points.length < 3) return null;
  const unique = [];
  points.forEach((p) => {
    if (!unique.some((u) => Math.hypot(u.x - p.x, u.y - p.y) < FP_SNAP_PX)) {
      unique.push({ x: p.x, y: p.y });
    }
  });
  if (unique.length < 3) return null;
  const cx = unique.reduce((s, p) => s + p.x, 0) / unique.length;
  const cy = unique.reduce((s, p) => s + p.y, 0) / unique.length;
  unique.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  return unique;
}

function fpAssembleContour() {
  const segments = fpCollectWallSegments();
  if (!segments.length) return null;

  if (segments.length === 1 && segments[0].length >= 3) {
    return segments[0].map((p) => ({ x: p.x, y: p.y }));
  }

  const nodes = [];
  const wallEdges = [];
  segments.forEach((seg) => {
    for (let i = 0; i < seg.length - 1; i++) {
      const a = fpSnapIndex(seg[i], nodes);
      const b = fpSnapIndex(seg[i + 1], nodes);
      if (a !== b) wallEdges.push({ a, b });
    }
  });

  const bridgeEdges = [];
  fpState.windows.forEach(([p1, p2]) => {
    const a = fpSnapIndex(p1, nodes);
    const b = fpSnapIndex(p2, nodes);
    if (a !== b) bridgeEdges.push({ a, b });
  });

  if (!wallEdges.length) return null;

  const adj = new Map();
  function addAdj(from, to, id, kind) {
    if (!adj.has(from)) adj.set(from, []);
    adj.get(from).push({ to, id, kind });
  }

  wallEdges.forEach((e, id) => {
    addAdj(e.a, e.b, id, 'wall');
    addAdj(e.b, e.a, id, 'wall');
  });
  bridgeEdges.forEach((e, id) => {
    addAdj(e.a, e.b, `w${id}`, 'window');
    addAdj(e.b, e.a, `w${id}`, 'window');
  });

  const usedWall = new Set();
  const usedBridge = new Set();
  const start = wallEdges[0].a;
  let current = start;
  let prev = null;
  const path = [current];
  const maxSteps = wallEdges.length * 4 + bridgeEdges.length * 2 + 12;

  for (let step = 0; step < maxSteps; step++) {
    const options = (adj.get(current) || []).filter(({ to, id, kind }) => {
      if (to === prev) return false;
      if (kind === 'wall' && usedWall.has(id)) return false;
      if (kind === 'window' && usedBridge.has(id)) return false;
      return true;
    });

    options.sort((x, y) => (x.kind === y.kind ? 0 : x.kind === 'wall' ? -1 : 1));
    if (!options.length) break;

    const pick = options[0];
    if (pick.kind === 'wall') usedWall.add(pick.id);
    else usedBridge.add(pick.id);

    prev = current;
    current = pick.to;
    if (current === start && path.length >= 3) break;
    path.push(current);
  }

  if (path.length >= 3 && current === start) {
    path.pop();
    return path.map((i) => ({ x: nodes[i].x, y: nodes[i].y }));
  }

  const flat = [];
  segments.forEach((seg) => seg.forEach((p) => flat.push(p)));
  return fpOrderPointsByAngle(flat);
}

function fpCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const den = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (Math.abs(den) < 1e-9) return false;
  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / den;
  const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / den;
  return t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999;
}

function fpHasSelfIntersection(points) {
  const n = points.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    const a1 = points[i];
    const a2 = points[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      if (j === i || j === (i + 1) % n || (i + 1) % n === j || i === (j + 1) % n) continue;
      const b1 = points[j];
      const b2 = points[(j + 1) % n];
      if (fpCross(a1.x, a1.y, a2.x, a2.y, b1.x, b1.y, b2.x, b2.y)) return true;
    }
  }
  return false;
}

function fpApplyAssembledContour(contour, msg) {
  if (!contour || contour.length < 3) {
    fpSetStatus('Не удалось собрать контур — проверьте, что отрезки стен и окна стыкуются в общие точки.');
    return false;
  }

  fpState.outer = contour;
  fpState.outerIsManual = true;
  fpState.wallSegments = [];
  fpState.currentWallSegment = [];
  fpRedraw();
  document.getElementById('fp-apply-btn').disabled = false;
  document.getElementById('fp-finish-wall-btn').disabled = true;
  fpUpdateAreaPreview();

  let status = msg || 'Контур стен собран.';
  if (fpHasSelfIntersection(contour)) {
    status += ' Внимание: контур пересекает сам себя — площадь может быть неверной. Используйте ручной ввод секций ниже.';
  }
  fpSetStatus(status);
  return true;
}

function fpConnectNeighbors() {
  if (fpState.currentWallSegment.length >= 2 && fpState.wallSegments.length >= 1) {
    fpState.wallSegments.push(fpState.currentWallSegment.slice());
    fpState.currentWallSegment = [];
  }

  const contour = fpAssembleContour();
  fpApplyAssembledContour(
    contour,
    'Соседние точки соединены (стены + окна). Проверьте жёлтый контур и периметр в строке площади.',
  );
}

function fpFinishWall() {
  if (fpState.wallSegments.length === 0 && fpState.currentWallSegment.length >= 3) {
    fpApplyAssembledContour(
      fpState.currentWallSegment.map((p) => ({ x: p.x, y: p.y })),
      'Контур стен замкнут вручную — он подходит для комнат любой формы. Можно отметить окна или сразу «Построить 3D».',
    );
    return;
  }

  fpConnectNeighbors();
}

function fpSetCalibFeedback(text, tone = 'info') {
  const summary = document.getElementById('fp-calib-summary');
  const panel = document.querySelector('.fp-calib-panel');
  if (summary) {
    summary.textContent = text;
    summary.dataset.tone = tone;
  }
  if (panel && tone === 'error') {
    panel.classList.add('fp-calib-panel-flash');
    setTimeout(() => panel.classList.remove('fp-calib-panel-flash'), 1200);
  }
  if (panel && tone === 'ok') {
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function fpUpdateCalibDraftHint() {
  const n = fpState.calibDraft.length;
  if (n === 0) {
    fpSetCalibFeedback('Шаг 1: режим «Масштаб» → кликните 2 точки по стене с цифрой на чертеже.', 'info');
  } else if (n === 1) {
    fpSetCalibFeedback('Шаг 1: отмечена 1 точка — кликните вторую на том же отрезке стены.', 'info');
  } else {
    fpSetCalibFeedback('Шаг 2: введите длину с чертежа (400 при «см») → нажмите «Добавить отрезок».', 'info');
  }
}

function fpCalibInputToMeters() {
  const raw = Number(document.getElementById('fp-calib-dist')?.value);
  if (!raw || raw <= 0) return null;
  const unit = document.getElementById('fp-calib-unit')?.value || 'm';
  return unit === 'cm' ? raw / 100 : raw;
}

function fpFormatLengthM(m) {
  if (m >= 10) return `${m.toFixed(1)} м`;
  return `${m.toFixed(2)} м`;
}

function fpAddCalibRef() {
  if (fpState.mode !== 'calib') {
    fpSetMode('calib');
  }

  if (!fpState.img) {
    fpSetCalibFeedback('Сначала загрузите изображение плана.', 'error');
    fpSetStatus('Сначала загрузите изображение плана.');
    return;
  }
  if (fpState.calibDraft.length < 2) {
    fpSetCalibFeedback(
      `Нужно 2 точки на плане (сейчас ${fpState.calibDraft.length}). Включите режим «Масштаб» и кликните по стене с цифрой.`,
      'error',
    );
    fpSetStatus('Сначала отметьте 2 точки на одной стене (режим «Масштаб»).');
    return;
  }
  const lengthM = fpCalibInputToMeters();
  if (!lengthM) {
    fpSetCalibFeedback('Введите длину в поле выше (например 400, если единица «см»).', 'error');
    fpSetStatus('Укажите длину отрезка — как на чертеже (400 при единице «см» = 4 м).');
    return;
  }
  const [a, b] = fpState.calibDraft;
  const pxDist = Math.hypot(b.x - a.x, b.y - a.y);
  if (pxDist < 3) {
    fpSetCalibFeedback('Точки слишком близко — отметьте их заново на плане.', 'error');
    fpSetStatus('Точки слишком близко — отметьте их заново.');
    return;
  }

  fpState.calibRefs.push({
    id: Date.now(),
    a: { x: a.x, y: a.y },
    b: { x: b.x, y: b.y },
    lengthM,
  });
  fpState.calibDraft = [];
  document.getElementById('fp-calib-dist').value = '';
  fpRenderCalibList();
  fpApplyScaleFromRefs(true);
  fpRedraw();
  fpSetCalibFeedback(
    `Добавлен отрезок ${fpState.calibRefs.length}: ${fpFormatLengthM(lengthM)}. `
    + 'Можно добавить ещё стены или нажать «Рассчитать масштаб».',
    'ok',
  );
  fpSetStatus(
    `Отрезок ${fpState.calibRefs.length} добавлен (${fpFormatLengthM(lengthM)}). `
    + 'Отметьте ещё 1–2 стены или нажмите «Рассчитать масштаб».',
  );
}

function fpApplyScaleFromRefs(silent = false) {
  if (!fpState.calibRefs.length) {
    if (!silent) fpSetStatus('Добавьте хотя бы один отрезок: 2 точки на стене + длина с чертежа.');
    return false;
  }

  let totalM = 0;
  let totalPx = 0;
  fpState.calibRefs.forEach((ref) => {
    const px = Math.hypot(ref.b.x - ref.a.x, ref.b.y - ref.a.y);
    if (px >= 3 && ref.lengthM > 0) {
      totalM += ref.lengthM;
      totalPx += px;
    }
  });

  if (totalPx < 3) {
    if (!silent) fpSetStatus('Нет валидных отрезков для расчёта масштаба.');
    return false;
  }

  fpState.scale = totalM / totalPx;
  fpState.scaleManual = true;
  fpUpdateAreaPreview();
  fpRenderCalibList();

  if (!silent) {
    fpSetStatus(
      `Масштаб по ${fpState.calibRefs.length} отрезкам (сумма ${fpFormatLengthM(totalM)}): `
      + `1 px ≈ ${fpState.scale.toFixed(4)} м. Теперь обведите стены или нажмите «Соединить соседние точки».`,
    );
  }
  return true;
}

function fpRenderCalibList() {
  const list = document.getElementById('fp-calib-list');
  const summary = document.getElementById('fp-calib-summary');
  if (!list) return;

  list.innerHTML = '';
  let sumM = 0;
  fpState.calibRefs.forEach((ref, i) => {
    sumM += ref.lengthM;
    const row = document.createElement('div');
    row.className = 'fp-calib-row';
    const unit = document.getElementById('fp-calib-unit')?.value || 'm';
    const displayVal = unit === 'cm' ? (ref.lengthM * 100).toFixed(0) : ref.lengthM.toFixed(2);
    row.innerHTML = `
      <span>Стена ${i + 1}:</span>
      <input type="number" min="0.1" step="any" value="${displayVal}" data-calib-idx="${i}" />
      <span class="fp-calib-row-unit">${unit === 'cm' ? 'см' : 'м'}</span>
      <button type="button" title="Удалить">×</button>
    `;
    row.querySelector('input').addEventListener('change', (e) => {
      const val = Number(e.target.value);
      const u = document.getElementById('fp-calib-unit')?.value || 'm';
      ref.lengthM = u === 'cm' ? val / 100 : val;
      fpApplyScaleFromRefs(true);
      fpRenderCalibList();
    });
    row.querySelector('button').addEventListener('click', () => {
      fpState.calibRefs.splice(i, 1);
      fpRenderCalibList();
      if (fpState.calibRefs.length) fpApplyScaleFromRefs(true);
      else {
        fpState.scale = null;
        fpState.scaleManual = false;
        fpUpdateAreaPreview();
      }
    });
    list.appendChild(row);
  });

  if (summary) {
    if (!fpState.calibRefs.length) {
      fpUpdateCalibDraftHint();
    } else {
      summary.dataset.tone = 'ok';
      summary.textContent = `Отрезков: ${fpState.calibRefs.length}, сумма длин: ${fpFormatLengthM(sumM)}`
        + (fpState.scaleManual ? ' · масштаб задан' : ' · нажмите «Рассчитать масштаб»');
    }
  }
}

function fpSetScale() {
  fpAddCalibRef();
}

function fpWaitForCv(cb, triesLeft = 12) {
  if (typeof cv !== 'undefined' && cv.Mat) {
    cb();
    return;
  }
  if (triesLeft <= 0) {
    fpDetectWithoutCv();
    return;
  }
  if (triesLeft === 12 || triesLeft === 6) {
    fpSetStatus('Загружается модуль распознавания…');
  }
  setTimeout(() => fpWaitForCv(cb, triesLeft - 1), 250);
}

function fpDetectWithoutCv() {
  if (!fpState.img) {
    fpSetStatus('Сначала загрузите план, чтобы построить контур.');
    return;
  }
  if (!fpState.scaleManual) {
    fpSetStatus('Сначала задайте масштаб по 1–3 стенам с цифрами на чертеже (режим «Масштаб»).');
    return;
  }

  const { width, height } = fpState.srcCanvas;
  const data = fpState.srcCanvas.getContext('2d').getImageData(0, 0, width, height).data;
  const marginX = Math.max(8, Math.round(width * 0.025));
  const marginY = Math.max(8, Math.round(height * 0.025));
  let left = width - marginX;
  let right = marginX;
  let top = height - marginY;
  let bottom = marginY;
  let found = 0;

  for (let y = marginY; y < height - marginY; y += 2) {
    for (let x = marginX; x < width - marginX; x += 2) {
      const i = (y * width + x) * 4;
      const r = data[i]; const g = data[i + 1]; const b = data[i + 2];
      const lightness = (r + g + b) / 3;
      const contrast = Math.max(r, g, b) - Math.min(r, g, b);
      if (lightness < 185 || contrast > 55) {
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
        found += 1;
      }
    }
  }

  if (found < 40 || right - left < width * 0.18 || bottom - top < height * 0.18) {
    left = marginX; right = width - marginX; top = marginY; bottom = height - marginY;
  }

  const pad = Math.max(5, Math.round(Math.min(width, height) * 0.018));
  left = Math.max(0, left - pad); right = Math.min(width, right + pad);
  top = Math.max(0, top - pad); bottom = Math.min(height, bottom + pad);
  fpState.outer = [
    { x: left, y: top }, { x: right, y: top },
    { x: right, y: bottom }, { x: left, y: bottom },
  ];
  fpState.outerIsManual = false;
  fpState.rooms = [];
  fpRedraw();
  fpUpdateAreaPreview();
  document.getElementById('fp-apply-btn').disabled = false;
  fpSetStatus('Контур построен в локальном режиме (прямоугольник по границам плана). Для точной формы обведите стены вручную.');
}

function fpDetect() {
  if (!fpState.img) {
    fpSetStatus('Сначала загрузите изображение плана.');
    return;
  }
  if (!fpState.scaleManual) {
    fpSetStatus('Сначала задайте масштаб: отметьте стены с цифрами на плане (400 см, 127 см…) и нажмите «Рассчитать масштаб».');
    return;
  }
  if (!fpState.scale) {
    fpSetStatus('Нажмите «Рассчитать масштаб» после добавления отрезков.');
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
    fpState.outerIsManual = false;
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
  fpUpdateAreaPreview();

  if (!fpState.outer) {
    fpSetStatus('Контур не найден автоматически — обведите стены вручную (режим «Стены»).');
    document.getElementById('fp-apply-btn').disabled = true;
  } else {
    const roomsMsg = fpState.rooms.length
      ? `и ${fpState.rooms.length} внутренних областей`
      : 'только внешний контур';
    fpSetStatus(`Найден контур помещения ${roomsMsg}. Если синий контур не совпадает — обведите стены вручную.`);
    document.getElementById('fp-apply-btn').disabled = false;
  }
}

function fpDrawOpenPolyline(points, color, width) {
  const { ctx } = fpState;
  if (points.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
}

function fpRedraw() {
  const { ctx, canvas, img } = fpState;
  if (!img || !ctx || !canvas) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(fpState.srcCanvas, 0, 0);

  fpState.rooms.forEach((r) => fpDrawPolygon(r, '#35e08f', 1.6));
  if (fpState.outer) {
    fpDrawPolygon(fpState.outer, fpState.outerIsManual ? '#ffd23f' : '#45d9ff', 2.5);
  }

  fpState.wallSegments.forEach((seg) => fpDrawOpenPolyline(seg, '#ffd23f', 2.2));

  ctx.strokeStyle = '#45d9ff';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  fpState.windows.forEach(([a, b]) => {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  });
  ctx.lineCap = 'butt';

  if (fpState.mode === 'wall' && fpState.currentWallSegment.length) {
    fpDrawOpenPolyline(fpState.currentWallSegment, '#ffd23f', 2.2);
    ctx.fillStyle = '#ffd23f';
    fpState.currentWallSegment.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  fpState.windowDraft.forEach((p) => {
    ctx.fillStyle = '#45d9ff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = '#ffb23f';
  fpState.calibRefs.forEach((ref) => {
    ctx.beginPath();
    ctx.moveTo(ref.a.x, ref.a.y);
    ctx.lineTo(ref.b.x, ref.b.y);
    ctx.strokeStyle = '#ffb23f';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    [ref.a, ref.b].forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  });

  fpState.calibDraft.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fill();
  });

  if (fpState.calibDraft.length === 2) {
    ctx.strokeStyle = '#ff6b2f';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(fpState.calibDraft[0].x, fpState.calibDraft[0].y);
    ctx.lineTo(fpState.calibDraft[1].x, fpState.calibDraft[1].y);
    ctx.stroke();
    ctx.setLineDash([]);
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

function fpPolygonPerimeter(points) {
  let peri = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    peri += Math.hypot(b.x - a.x, b.z - a.z);
  }
  return peri;
}

function fpManualSectionsArea() {
  const rows = document.querySelectorAll('#fp-dim-list .fp-dim-row');
  let sum = 0;
  let any = false;
  rows.forEach((row) => {
    const w = Number(row.querySelector('[data-dim="w"]')?.value);
    const h = Number(row.querySelector('[data-dim="h"]')?.value);
    if (w > 0 && h > 0) {
      sum += w * h;
      any = true;
    }
  });
  return any ? sum : null;
}

function fpResolveAreaM2(outerM) {
  const manualTotal = Number(document.getElementById('fp-manual-area')?.value);
  if (manualTotal > 0) return manualTotal;

  const sections = fpManualSectionsArea();
  if (sections != null) return sections;

  return fpPolygonArea(outerM);
}

function fpAddDimRow(w = '', h = '') {
  const list = document.getElementById('fp-dim-list');
  if (!list) return;
  const row = document.createElement('div');
  row.className = 'fp-dim-row';
  row.innerHTML = `
    <span>Секция:</span>
    <input type="number" data-dim="w" min="0.1" step="0.1" placeholder="длина, м" value="${w}" />
    <span>×</span>
    <input type="number" data-dim="h" min="0.1" step="0.1" placeholder="ширина, м" value="${h}" />
    <span>м²</span>
    <button type="button" title="Удалить">×</button>
  `;
  row.querySelector('button').addEventListener('click', () => {
    row.remove();
    fpUpdateAreaPreview();
  });
  row.querySelectorAll('input').forEach((inp) => {
    inp.addEventListener('input', fpUpdateAreaPreview);
  });
  list.appendChild(row);
  fpUpdateAreaPreview();
}

function fpClearDimRows() {
  const list = document.getElementById('fp-dim-list');
  if (list) list.innerHTML = '';
  const manual = document.getElementById('fp-manual-area');
  if (manual) manual.value = '';
}

function fpUpdateAreaPreview() {
  const el = document.getElementById('fp-area-preview');
  if (!el) return;

  if (!fpState.outer) {
    el.textContent = 'Площадь по контуру: — (сначала замкните контур стен)';
    return;
  }

  if (!fpState.scaleManual || !fpState.scale) {
    el.textContent = 'Площадь по контуру: — сначала задайте масштаб по цифрам на чертеже (режим «Масштаб»)';
    return;
  }

  const cx = fpState.outer.reduce((s, p) => s + p.x, 0) / fpState.outer.length;
  const cy = fpState.outer.reduce((s, p) => s + p.y, 0) / fpState.outer.length;
  const outerM = fpToMeters(fpState.outer, cx, cy);
  const autoArea = fpPolygonArea(outerM);
  const peri = fpPolygonPerimeter(outerM);
  const resolved = fpResolveAreaM2(outerM);

  const refSum = fpState.calibRefs.reduce((s, r) => s + r.lengthM, 0);

  let text = `Площадь по контуру: ≈ ${autoArea.toFixed(1)} м², периметр ≈ ${peri.toFixed(1)} м`;
  if (refSum > 0) {
    text += ` · эталон стен: ${refSum.toFixed(1)} м`;
  }
  if (fpHasSelfIntersection(fpState.outer)) {
    text += ' · контур пересекается — площадь может быть неверной';
  }
  if (Math.abs(resolved - autoArea) > 0.5) {
    text += ` · будет использовано: ${resolved.toFixed(1)} м²`;
  }
  el.textContent = text;
}

function fpApplyToTwin() {
  if (!fpState.outer) return;

  if (!fpState.scaleManual || !fpState.scale) {
    fpSetStatus('Сначала задайте масштаб по цифрам на чертеже (2–4 стены) и нажмите «Рассчитать масштаб».');
    return;
  }

  const cx = fpState.outer.reduce((s, p) => s + p.x, 0) / fpState.outer.length;
  const cy = fpState.outer.reduce((s, p) => s + p.y, 0) / fpState.outer.length;

  const outerM = fpToMeters(fpState.outer, cx, cy);
  const roomsM = fpState.rooms.map((r) => fpToMeters(r, cx, cy));
  const windowsM = fpState.windows.map(([a, b]) => fpToMeters([a, b], cx, cy));
  const area = fpResolveAreaM2(outerM);
  const peri = fpPolygonPerimeter(outerM);

  window.EcotchiFloorplan = { outer: outerM, rooms: roomsM, windows: windowsM, area };

  const areaInput = document.getElementById('twin-area');
  if (areaInput) areaInput.value = Math.max(6, Math.round(area));

  fpSetStatus(`Применено: площадь ≈ ${area.toFixed(1)} м², периметр ≈ ${peri.toFixed(1)} м. Строю 3D-модель…`);

  const genBtn = document.getElementById('twin-generate-btn');
  if (genBtn) genBtn.click();
}

function fpClear() {
  window.EcotchiFloorplan = null;
  fpLoadToken += 1;
  fpReleaseImage();
  fpState.outer = null;
  fpState.outerIsManual = false;
  fpState.rooms = [];
  fpState.windows = [];
  fpState.windowDraft = [];
  fpState.wallSegments = [];
  fpState.currentWallSegment = [];
  fpState.calibDraft = [];
  fpState.calibRefs = [];
  fpState.scale = null;
  fpState.scaleManual = false;
  fpSetLoading(false);
  fpSetMode('calib');
  fpClearDimRows();
  fpRenderCalibList();

  document.getElementById('fp-finish-wall-btn').disabled = true;
  document.getElementById('fp-apply-btn').disabled = true;
  fpDrawPlaceholder();
  fpUpdateAreaPreview();
  fpSetStatus('План сброшен — модель снова строится по площади и типу объекта.');

  const genBtn = document.getElementById('twin-generate-btn');
  if (genBtn) genBtn.click();
}

function fpSetStatus(text) {
  const el = document.getElementById('fp-status');
  if (el) el.textContent = text;
}

document.addEventListener('DOMContentLoaded', fpInit);
