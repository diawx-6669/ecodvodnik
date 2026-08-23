// ===================== 3D-двойник помещения =====================
// Строит 3D-сцену (Three.js r128) по площади/типу объекта, либо по
// реальной форме помещения из floorplan.js (window.EcotchiFloorplan).
// Расставляет "приборы" (демо-набор, зависящий от типа объекта и площади),
// считает условное потребление модели и сравнивает с рекомендуемым
// (через window.getRecommendedUsage из consumption-utils.js), рисует
// прогноз экономии при замене части приборов на энергоэффективные.

const twinState = {
  renderer: null,
  scene: null,
  camera: null,
  raf: null,
  rotY: 0.6,
  rotX: 0.5,
  dragging: false,
  lastX: 0,
  lastY: 0,
  devices: [],       // [{ id, name, watts, hoursPerDay, efficient, color }]
  dailyModelKwh: 0,
  dailyRealKwh: 0,
};

const TWIN_DEVICE_CATALOG = {
  household: [
    { name: 'Холодильник', watts: 150, hours: 24, essential: true },
    { name: 'Стиральная машина', watts: 700, hours: 1 },
    { name: 'Бойлер', watts: 1500, hours: 2 },
    { name: 'Освещение', watts: 60, hours: 6, essential: true },
    { name: 'Телевизор', watts: 100, hours: 4 },
    { name: 'Кондиционер', watts: 1200, hours: 3 },
    { name: 'Микроволновка', watts: 900, hours: 0.3 },
    { name: 'Ноутбук/ПК', watts: 120, hours: 5 },
  ],
  school: [
    { name: 'Освещение классов', watts: 80, hours: 8, essential: true },
    { name: 'Проекторы', watts: 250, hours: 5 },
    { name: 'Компьютерный класс', watts: 1800, hours: 6 },
    { name: 'Отопление/вентиляция', watts: 3000, hours: 8 },
    { name: 'Столовая (оборуд.)', watts: 2200, hours: 4 },
    { name: 'Сервер/сеть', watts: 300, hours: 24, essential: true },
  ],
  business: [
    { name: 'Освещение офиса', watts: 200, hours: 10, essential: true },
    { name: 'Кондиционирование', watts: 2500, hours: 9 },
    { name: 'Оргтехника', watts: 600, hours: 9 },
    { name: 'Холодильное оборуд.', watts: 800, hours: 24, essential: true },
    { name: 'Витрины/вывеска', watts: 300, hours: 12 },
    { name: 'Серверная', watts: 900, hours: 24 },
  ],
};

const TWIN_UNITS_LABEL = {
  household: 'Жильцов',
  school: 'Учеников',
  business: 'Сотрудников',
};

function twinInit() {
  const genBtn = document.getElementById('twin-generate-btn');
  if (!genBtn) return; // блока двойника нет в DOM

  document.getElementById('twin-type').addEventListener('change', twinOnTypeChange);
  genBtn.addEventListener('click', twinGenerate);

  const slider = document.getElementById('twin-slider');
  slider.addEventListener('input', twinOnSlider);

  window.addEventListener('resize', twinOnResize);
}

function twinOnTypeChange(e) {
  const label = document.getElementById('twin-units-label');
  label.textContent = TWIN_UNITS_LABEL[e.target.value] || 'Жильцов';
}

// ---------- генерация приборов и расчёт потребления ----------
function twinBuildDevices(type, areaM2, units) {
  const catalog = TWIN_DEVICE_CATALOG[type] || TWIN_DEVICE_CATALOG.household;
  const scale = Math.max(1, areaM2 / 60) * Math.max(1, units / 4);
  const palette = ['#45d9ff', '#35e08f', '#a78bfa', '#ffb23f', '#ff6b81', '#4ade80', '#38bdf8', '#f472b6'];

  return catalog.map((d, i) => {
    const countMultiplier = d.essential ? 1 : Math.max(1, Math.round(scale));
    return {
      id: `dev-${i}`,
      name: countMultiplier > 1 ? `${d.name} ×${countMultiplier}` : d.name,
      watts: d.watts * countMultiplier,
      hoursPerDay: d.hours,
      essential: !!d.essential,
      efficient: false,
      color: palette[i % palette.length],
    };
  });
}

function twinDeviceDailyKwh(dev, efficientOverride) {
  const efficient = efficientOverride !== undefined ? efficientOverride : dev.efficient;
  const watts = efficient ? dev.watts * 0.6 : dev.watts; // энергоэффективная замена экономит ~40%
  return (watts * dev.hoursPerDay) / 1000;
}

function twinRecalcTotals() {
  twinState.dailyModelKwh = twinState.devices.reduce((s, d) => s + twinDeviceDailyKwh(d), 0);

  const units = Number(document.getElementById('twin-units').value) || 1;
  const twinType = document.getElementById('twin-type').value;
  const recommended = typeof window.getRecommendedUsage === 'function'
    ? window.getRecommendedUsage(twinType, units).electricity
    : twinState.dailyModelKwh * 30 * 0.9;
  // getRecommendedUsage обычно возвращает месячную норму — переводим в среднесуточную
  twinState.dailyRealKwh = recommended / 30;

  twinRenderCompare();
  twinRenderForecast();
}

function twinRenderCompare() {
  const maxKwh = Math.max(twinState.dailyModelKwh, twinState.dailyRealKwh, 0.1) * 1.15;
  const modelPct = Math.min(100, (twinState.dailyModelKwh / maxKwh) * 100);
  const realPct = Math.min(100, (twinState.dailyRealKwh / maxKwh) * 100);

  document.getElementById('twin-bar-model').style.width = `${modelPct}%`;
  document.getElementById('twin-bar-real').style.width = `${realPct}%`;
  document.getElementById('twin-value-model').textContent = `${twinState.dailyModelKwh.toFixed(1)} кВт·ч/сут`;
  document.getElementById('twin-value-real').textContent = `${twinState.dailyRealKwh.toFixed(1)} кВт·ч/сут`;

  const diff = twinState.dailyModelKwh - twinState.dailyRealKwh;
  const note = document.getElementById('twin-compare-note');
  if (Math.abs(diff) < 0.2) {
    note.textContent = 'Модель по приборам близка к рекомендуемой норме — расхождение минимально.';
  } else if (diff > 0) {
    note.textContent = `Модель показывает на ${diff.toFixed(1)} кВт·ч/сут больше нормы — вероятно, часть приборов работает дольше необходимого.`;
  } else {
    note.textContent = `Модель ниже нормы на ${Math.abs(diff).toFixed(1)} кВт·ч/сут — хороший результат для такой площади.`;
  }
}

// ---------- список приборов в панели ----------
function twinRenderDeviceList() {
  const list = document.getElementById('twin-device-list');
  list.innerHTML = '';

  twinState.devices.forEach((dev) => {
    const row = document.createElement('div');
    row.className = 'twin-device-row';

    const nameWrap = document.createElement('span');
    nameWrap.className = 'dev-name';
    const dot = document.createElement('span');
    dot.className = 'twin-device-dot';
    dot.style.background = dev.color;
    nameWrap.appendChild(dot);
    nameWrap.appendChild(document.createTextNode(dev.name));

    const power = document.createElement('span');
    power.className = 'dev-power';
    power.textContent = `${dev.watts} Вт · ${dev.hoursPerDay} ч/день`;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'twin-swap-btn' + (dev.efficient ? ' done' : '');
    btn.textContent = dev.efficient ? 'Заменено' : 'Заменить на эко';
    btn.disabled = dev.efficient;
    btn.addEventListener('click', () => {
      dev.efficient = true;
      twinRenderDeviceList();
      twinRecalcTotals();
    });

    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.alignItems = 'center';
    right.style.gap = '10px';
    right.appendChild(power);
    right.appendChild(btn);

    row.appendChild(nameWrap);
    row.appendChild(right);
    list.appendChild(row);
  });
}

// ---------- прогноз экономии (SVG-график) ----------
function twinOnSlider(e) {
  document.getElementById('twin-slider-value').textContent = `${e.target.value}%`;
  twinRenderForecast();
}

function twinRenderForecast() {
  const pct = Number(document.getElementById('twin-slider').value) / 100;
  const swappable = twinState.devices.filter((d) => !d.essential);
  const countToSwap = Math.round(swappable.length * pct);

  let projectedKwh = 0;
  twinState.devices.forEach((dev) => {
    const idxInSwappable = swappable.indexOf(dev);
    const willBeEfficient = dev.efficient || (idxInSwappable !== -1 && idxInSwappable < countToSwap);
    projectedKwh += twinDeviceDailyKwh(dev, willBeEfficient);
  });

  const labels = ['Сейчас', '1 мес', '2 мес', '3 мес', '6 мес', '12 мес'];
  const start = twinState.dailyModelKwh * 30;
  const end = projectedKwh * 30;
  const values = labels.map((_, i) => {
    const t = i / (labels.length - 1);
    return start + (end - start) * t;
  });

  twinDrawChart(labels, values);

  const savingsKwhYear = Math.max(0, (start - end) * 12);
  const note = document.getElementById('twin-ai-note');
  const alreadySwapped = twinState.devices.filter((d) => d.efficient).length;
  if (countToSwap === 0 && alreadySwapped === 0) {
    note.textContent = 'Передвиньте ползунок, чтобы увидеть, сколько можно сэкономить, заменив часть приборов на энергоэффективные.';
  } else {
    const swappedTotal = Math.max(countToSwap, alreadySwapped);
    note.textContent = `При замене ${swappedTotal} из ${swappable.length} необязательных приборов расход снизится с ${start.toFixed(0)} до ${end.toFixed(0)} кВт·ч/мес — экономия ≈ ${savingsKwhYear.toFixed(0)} кВт·ч в год.`;
  }
}

function twinDrawChart(labels, values) {
  const svg = document.getElementById('twin-chart');
  const w = svg.clientWidth || 400;
  const h = 130;
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.innerHTML = '';

  const pad = { l: 6, r: 6, t: 14, b: 20 };
  const maxV = Math.max(...values, 1) * 1.1;
  const minV = 0;
  const stepX = (w - pad.l - pad.r) / (labels.length - 1);
  const yFor = (v) => h - pad.b - ((v - minV) / (maxV - minV || 1)) * (h - pad.t - pad.b);
  const xFor = (i) => pad.l + i * stepX;

  const ns = 'http://www.w3.org/2000/svg';

  // область под линией
  let areaPath = `M ${xFor(0)} ${yFor(values[0])}`;
  values.forEach((v, i) => { if (i > 0) areaPath += ` L ${xFor(i)} ${yFor(v)}`; });
  areaPath += ` L ${xFor(values.length - 1)} ${h - pad.b} L ${xFor(0)} ${h - pad.b} Z`;
  const area = document.createElementNS(ns, 'path');
  area.setAttribute('d', areaPath);
  area.setAttribute('fill', 'rgba(69, 217, 255, 0.12)');
  svg.appendChild(area);

  // линия
  let linePath = `M ${xFor(0)} ${yFor(values[0])}`;
  values.forEach((v, i) => { if (i > 0) linePath += ` L ${xFor(i)} ${yFor(v)}`; });
  const line = document.createElementNS(ns, 'path');
  line.setAttribute('d', linePath);
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', '#45d9ff');
  line.setAttribute('stroke-width', '2.4');
  line.setAttribute('stroke-linejoin', 'round');
  line.setAttribute('stroke-linecap', 'round');
  svg.appendChild(line);

  values.forEach((v, i) => {
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', xFor(i));
    c.setAttribute('cy', yFor(v));
    c.setAttribute('r', 3);
    c.setAttribute('fill', '#04120c');
    c.setAttribute('stroke', '#45d9ff');
    c.setAttribute('stroke-width', '1.6');
    svg.appendChild(c);

    const t = document.createElementNS(ns, 'text');
    t.setAttribute('x', xFor(i));
    t.setAttribute('y', h - 4);
    t.setAttribute('text-anchor', i === 0 ? 'start' : (i === values.length - 1 ? 'end' : 'middle'));
    t.setAttribute('font-size', '9.5');
    t.setAttribute('fill', 'var(--muted)');
    t.textContent = labels[i];
    svg.appendChild(t);
  });
}

// ---------- 3D-сцена (Three.js) ----------
function twinDisposeScene() {
  if (twinState.raf) cancelAnimationFrame(twinState.raf);
  twinState.raf = null;
  if (twinState.renderer) {
    twinState.renderer.dispose();
    if (twinState.renderer.domElement && twinState.renderer.domElement.parentNode) {
      twinState.renderer.domElement.parentNode.removeChild(twinState.renderer.domElement);
    }
  }
  twinState.renderer = null;
  twinState.scene = null;
  twinState.camera = null;
}

function twinBuildScene(areaM2) {
  const wrap = document.getElementById('twin-scene-wrap');
  wrap.innerHTML = '';

  const width = wrap.clientWidth || 600;
  const height = Math.max(320, wrap.clientHeight || 320);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1512);

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 200);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  wrap.appendChild(renderer.domElement);

  // свет
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const sun = new THREE.DirectionalLight(0xbfe9ff, 0.9);
  sun.position.set(6, 10, 4);
  scene.add(sun);

  // пол/контур помещения
  const floorplan = window.EcotchiFloorplan;
  let footprintSize = Math.sqrt(Math.max(6, areaM2));
  let floorMesh;

  if (floorplan && floorplan.outer && floorplan.outer.length >= 3) {
    const shape = new THREE.Shape();
    floorplan.outer.forEach((p, i) => (i === 0 ? shape.moveTo(p.x, p.z) : shape.lineTo(p.x, p.z)));
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false });
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0x123024, roughness: 0.9 });
    floorMesh = new THREE.Mesh(geo, mat);
    scene.add(floorMesh);

    // внутренние комнаты — тонкие контуры-линии
    floorplan.rooms.forEach((room) => {
      const pts = room.map((p) => new THREE.Vector3(p.x, 0.02, p.z));
      pts.push(pts[0]);
      const geoLine = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(geoLine, new THREE.LineBasicMaterial({ color: 0x35e08f }));
      scene.add(line);
    });

    const box = new THREE.Box3().setFromObject(floorMesh);
    footprintSize = Math.max(box.max.x - box.min.x, box.max.z - box.min.z, 4);
  } else {
    const geo = new THREE.BoxGeometry(footprintSize, 0.12, footprintSize);
    const mat = new THREE.MeshStandardMaterial({ color: 0x123024, roughness: 0.9 });
    floorMesh = new THREE.Mesh(geo, mat);
    scene.add(floorMesh);

    // простые внешние стены-контур
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(footprintSize, 1.6, footprintSize));
    const wallLines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x2a5c47 }));
    wallLines.position.y = 0.8;
    scene.add(wallLines);
  }

  // приборы — цветные кубики, расставленные по кругу в пределах контура
  const deviceGroup = new THREE.Group();
  const n = twinState.devices.length || 1;
  twinState.devices.forEach((dev, i) => {
    const angle = (i / n) * Math.PI * 2;
    const r = footprintSize * 0.32;
    const size = 0.22 + Math.min(0.28, dev.watts / 6000);
    const geo = new THREE.BoxGeometry(size, size, size);
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(dev.color),
      emissive: new THREE.Color(dev.color),
      emissiveIntensity: dev.efficient ? 0.15 : 0.4,
    });
    const cube = new THREE.Mesh(geo, mat);
    cube.position.set(Math.cos(angle) * r, size / 2 + 0.06, Math.sin(angle) * r);
    deviceGroup.add(cube);
  });
  scene.add(deviceGroup);

  const camDist = footprintSize * 1.35 + 2;

  twinState.renderer = renderer;
  twinState.scene = scene;
  twinState.camera = camera;
  twinState.footprintSize = footprintSize;

  twinAttachDragControls(wrap);

  const animate = () => {
    twinState.raf = requestAnimationFrame(animate);
    twinState.camera.position.x = Math.cos(twinState.rotY) * camDist * Math.cos(twinState.rotX);
    twinState.camera.position.z = Math.sin(twinState.rotY) * camDist * Math.cos(twinState.rotX);
    twinState.camera.position.y = Math.max(1.5, camDist * Math.sin(twinState.rotX) + camDist * 0.5);
    twinState.camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  };
  animate();
}

function twinAttachDragControls(wrap) {
  const canvas = wrap.querySelector('canvas');
  if (!canvas) return;

  const onDown = (x, y) => { twinState.dragging = true; twinState.lastX = x; twinState.lastY = y; };
  const onMove = (x, y) => {
    if (!twinState.dragging) return;
    twinState.rotY += (x - twinState.lastX) * 0.008;
    twinState.rotX = Math.max(0.15, Math.min(1.3, twinState.rotX + (y - twinState.lastY) * -0.006));
    twinState.lastX = x; twinState.lastY = y;
  };
  const onUp = () => { twinState.dragging = false; };

  canvas.addEventListener('mousedown', (e) => onDown(e.clientX, e.clientY));
  window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
  window.addEventListener('mouseup', onUp);

  canvas.addEventListener('touchstart', (e) => { const t = e.touches[0]; onDown(t.clientX, t.clientY); }, { passive: true });
  canvas.addEventListener('touchmove', (e) => { const t = e.touches[0]; onMove(t.clientX, t.clientY); }, { passive: true });
  canvas.addEventListener('touchend', onUp);
}

function twinOnResize() {
  if (!twinState.renderer || !twinState.camera) return;
  const wrap = document.getElementById('twin-scene-wrap');
  const width = wrap.clientWidth || 600;
  const height = Math.max(320, wrap.clientHeight || 320);
  twinState.camera.aspect = width / height;
  twinState.camera.updateProjectionMatrix();
  twinState.renderer.setSize(width, height);
}

// ---------- главная точка входа ----------
function twinGenerate() {
  const wrap = document.getElementById('twin-scene-wrap');
  if (!wrap) return;

  if (typeof THREE === 'undefined') {
    wrap.innerHTML =
      '<div class="twin-scene-empty">Не удалось загрузить 3D-движок (Three.js). Проверьте интернет и обновите страницу.</div>';
    return;
  }

  const type = document.getElementById('twin-type').value;
  const areaM2 = Math.max(6, Number(document.getElementById('twin-area').value) || 60);
  const units = Math.max(1, Number(document.getElementById('twin-units').value) || 1);

  twinState.devices = twinBuildDevices(type, areaM2, units);

  twinDisposeScene();
  wrap.innerHTML = '';
  twinBuildScene(areaM2);

  twinRenderDeviceList();
  twinRecalcTotals();
}

document.addEventListener('DOMContentLoaded', twinInit);
