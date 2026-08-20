// ===================== 3D-двойник помещения =====================
// Строит 3D-модель дома/школы/малого бизнеса, расставляет в неё типовые
// энергопотребители, даёт "AI"-рекомендации по замене на энергоэффективные
// аналоги и сравнивает модель с реальными показаниями пользователя
// (через /api/analytics/summary).
//
// Количество приборов по-прежнему считается эвристикой на основе
// площади/количества людей (buildTwinGroups) — это отдельная задача от
// формы помещения и требует данных, которых на чертеже обычно нет
// (сколько людей, какой тип объекта).
//
// А вот ФОРМА помещения и расстановка приборов внутри него больше не
// хардкодят квадрат: если пользователь загрузил план (см. floorplan.js,
// window.EcotchiFloorplan), используется настоящий контур помещения и,
// если распознаны, настоящие границы комнат — приборы распределяются по
// комнатам пропорционально их площади и расставляются только внутри
// полигона (point-in-polygon), а не по абстрактной сетке. Без загруженного
// плана поведение прежнее — квадрат по площади (fallback).

const TWIN_TARIFF_ELECTRICITY = 15; // ₸ за кВт·ч (совпадает с backend/config)

const TWIN_CATALOG = {
  lamp: { label: 'Лампы освещения', color: 0xffb23f, effColor: 0x8ce7ff, power: 60, effPower: 9, hours: 5, effLabel: 'LED-лампы', shape: 'lamp' },
  fridge: { label: 'Холодильник', color: 0x6fb1ff, effColor: 0x8ce7ff, power: 150, effPower: 95, hours: 24, effLabel: 'Класс A+++', shape: 'box' },
  washing_machine: { label: 'Стиральная машина', color: 0x9b8bff, effColor: 0x8ce7ff, power: 500, effPower: 350, hours: 1, effLabel: 'Класс A+ / эко-режим', shape: 'box' },
  water_heater: { label: 'Водонагреватель', color: 0xff8a8a, effColor: 0x8ce7ff, power: 1500, effPower: 1100, hours: 2, effLabel: 'Проточный эффективный', shape: 'box' },
  tv: { label: 'Телевизор', color: 0x8bffb0, effColor: 0x8ce7ff, power: 120, effPower: 60, hours: 4, effLabel: 'LED, класс A', shape: 'box' },
  ac: { label: 'Кондиционер', color: 0x8bd8ff, effColor: 0x8ce7ff, power: 1000, effPower: 650, hours: 3, effLabel: 'Инверторный', shape: 'box' },
  computer: { label: 'Компьютеры', color: 0xffd98a, effColor: 0x8ce7ff, power: 120, effPower: 65, hours: 8, effLabel: 'Энергосберегающий режим', shape: 'box' },
  projector: { label: 'Проекторы', color: 0xd0a8ff, effColor: 0x8ce7ff, power: 250, effPower: 150, hours: 3, effLabel: 'LED-проектор', shape: 'box' },
  server: { label: 'Серверное оборудование', color: 0xff9dc0, effColor: 0x8ce7ff, power: 400, effPower: 280, hours: 24, effLabel: 'Энергоэффективный сервер', shape: 'box' },
};

function buildTwinGroups(type, area, units) {
  const groups = [];
  const add = (key, count) => {
    if (count > 0) groups.push({ key, count: Math.round(count), swapped: 0 });
  };

  if (type === 'household') {
    const rooms = Math.max(1, Math.round(area / 18));
    add('lamp', rooms * 2);
    add('fridge', 1);
    add('washing_machine', 1);
    add('water_heater', 1);
    add('tv', Math.min(rooms, 3));
    add('ac', Math.ceil(area / 60));
  } else if (type === 'school') {
    const rooms = Math.max(1, Math.round(units / 25));
    add('lamp', rooms * 4);
    add('computer', Math.round(units / 15) + 2);
    add('projector', rooms);
    add('water_heater', 1);
    add('ac', Math.ceil(rooms / 3));
  } else {
    // business
    add('lamp', Math.max(4, Math.round(area / 12)));
    add('computer', units);
    add('server', Math.max(1, Math.ceil(units / 20)));
    add('ac', Math.max(1, Math.ceil(area / 50)));
    add('water_heater', 1);
  }

  return groups;
}

function twinGroupPower(group) {
  const cat = TWIN_CATALOG[group.key];
  const swapped = Math.min(group.swapped, group.count);
  const normalCount = group.count - swapped;
  return normalCount * cat.power + swapped * cat.effPower;
}

function twinWeeklyKwh(groups) {
  let total = 0;
  groups.forEach((g) => {
    const cat = TWIN_CATALOG[g.key];
    total += (twinGroupPower(g) * cat.hours * 7) / 1000;
  });
  return total;
}

// ---------- геометрия плана: полигоны, точки внутри, расстановка по комнатам ----------
// Все точки здесь — {x, z} (горизонтальная плоскость сцены Three.js).

function twinPolyArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.z - b.x * a.z;
  }
  return Math.abs(area / 2);
}

function twinPolyBounds(points) {
  const xs = points.map((p) => p.x);
  const zs = points.map((p) => p.z);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
}

function twinPointInPolygon(point, poly) {
  // алгоритм трассировки луча (ray casting)
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, zi = poly[i].z, xj = poly[j].x, zj = poly[j].z;
    const intersects = ((zi > point.z) !== (zj > point.z)) &&
      (point.x < ((xj - xi) * (point.z - zi)) / (zj - zi) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

// Расставляет `count` точек внутри контура помещения. Если известны
// границы отдельных комнат (footprint.rooms) — делит приборы между
// комнатами пропорционально их площади и раскладывает каждую группу
// только внутри своей комнаты; иначе раскладывает по всему периметру.
function twinPlaceInFootprint(count, footprint) {
  if (count <= 0) return [];
  const zones = (footprint.rooms && footprint.rooms.length >= 1) ? footprint.rooms : [footprint.outer];

  const areas = zones.map((z) => Math.max(twinPolyArea(z), 0.5));
  const totalArea = areas.reduce((a, b) => a + b, 0);
  const counts = areas.map((a) => Math.max(1, Math.round((count * a) / totalArea)));

  // подгоняем сумму счётчиков под точное количество приборов
  let diff = count - counts.reduce((a, b) => a + b, 0);
  let guard = 0;
  while (diff !== 0 && guard < 1000) {
    const idx = guard % counts.length;
    if (diff > 0) { counts[idx]++; diff--; }
    else if (counts[idx] > 0) { counts[idx]--; diff++; }
    guard++;
  }

  const placements = [];
  zones.forEach((zone, zi) => {
    const need = counts[zi];
    if (need <= 0) return;
    const b = twinPolyBounds(zone);
    const w = Math.max(b.maxX - b.minX, 0.5);
    const h = Math.max(b.maxZ - b.minZ, 0.5);
    const step = Math.max(0.35, Math.sqrt((w * h) / need) * 0.75);

    const found = [];
    for (let z = b.minZ + step / 2; z <= b.maxZ && found.length < need; z += step) {
      for (let x = b.minX + step / 2; x <= b.maxX && found.length < need; x += step) {
        if (twinPointInPolygon({ x, z }, zone)) found.push({ x, z });
      }
    }
    // узкая/неправильная форма — сетка не набрала нужное число точек:
    // добираем возле центроида комнаты, чтобы приборы не пропадали
    if (found.length < need) {
      const cx = zone.reduce((s, p) => s + p.x, 0) / zone.length;
      const cz = zone.reduce((s, p) => s + p.z, 0) / zone.length;
      while (found.length < need) {
        found.push({ x: cx + (Math.random() - 0.5) * step, z: cz + (Math.random() - 0.5) * step });
      }
    }
    placements.push(...found.slice(0, need));
  });

  while (placements.length < count) placements.push(placements[placements.length % Math.max(placements.length, 1)] || { x: 0, z: 0 });
  return placements.slice(0, count);
}

// строит "занавес" стен вдоль произвольного многоугольника (замена
// плоским wallBack/wallLeft, которые работали только для квадрата)
function twinBuildWallStrip(pts, height, material) {
  const group = new THREE.Group();
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const geo = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      a.x, 0, a.z, b.x, 0, b.z, b.x, height, b.z,
      a.x, 0, a.z, b.x, height, b.z, a.x, height, a.z,
    ]);
    geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geo.computeVertexNormals();
    group.add(new THREE.Mesh(geo, material));
  }
  return group;
}

// ---------- состояние модуля ----------
const twinState = {
  type: 'household',
  area: 60,
  units: 4,
  groups: [],
  footprint: null, // {outer:[{x,z}], rooms:[[{x,z}]...], area} из floorplan.js, либо null
  scene: null,
  renderer: null,
  camera: null,
  rig: null,
  animId: null,
};

function twinInit() {
  const genBtn = document.getElementById('twin-generate-btn');
  if (!genBtn) return; // секции нет в DOM (например, старая версия index.html)

  genBtn.addEventListener('click', twinGenerate);
  document.getElementById('twin-type').addEventListener('change', twinSyncFieldLabels);
  document.getElementById('twin-slider').addEventListener('input', twinUpdateForecast);

  twinSyncFieldLabels();
  twinGenerate(); // сразу показать демо-модель для дома
}

function twinSyncFieldLabels() {
  const type = document.getElementById('twin-type').value;
  const unitsLabel = document.getElementById('twin-units-label');
  const labels = { household: 'Жильцов', school: 'Учеников', business: 'Сотрудников' };
  unitsLabel.textContent = labels[type] || 'Людей';
}

function twinGenerate() {
  const type = document.getElementById('twin-type').value;
  const area = Math.max(6, Number(document.getElementById('twin-area').value) || 60);
  const units = Math.max(1, Number(document.getElementById('twin-units').value) || 1);

  const uploaded = window.EcotchiFloorplan;
  const hasFootprint = uploaded && Array.isArray(uploaded.outer) && uploaded.outer.length >= 3;

  twinState.type = type;
  twinState.area = area;
  twinState.units = units;
  twinState.footprint = hasFootprint ? uploaded : null;
  twinState.groups = buildTwinGroups(type, area, units);

  twinRenderScene();
  twinRenderDeviceList();
  twinUpdateForecast();
  twinUpdateComparison();
}

// ---------- 3D-сцена ----------
function twinRenderScene() {
  const wrap = document.getElementById('twin-scene-wrap');
  if (typeof THREE === 'undefined') {
    wrap.innerHTML = '<div class="twin-scene-empty">3D-движок не загрузился (проверьте подключение к интернету) — приборы всё равно посчитаны ниже.</div>';
    return;
  }

  if (twinState.animId) cancelAnimationFrame(twinState.animId);
  wrap.innerHTML = '';

  const footprint = twinState.footprint;
  const height = 3.2;

  // контур пола: реальная форма из плана, либо квадрат по площади (fallback)
  let outerPts;
  let side; // приблизительный "размер" помещения — для камеры и сетки
  if (footprint) {
    const b = twinPolyBounds(footprint.outer);
    outerPts = footprint.outer;
    side = Math.max(b.maxX - b.minX, b.maxZ - b.minZ, 4);
  } else {
    side = Math.max(6, Math.sqrt(twinState.area));
    const h = side / 2;
    outerPts = [{ x: -h, z: -h }, { x: h, z: -h }, { x: h, z: h }, { x: -h, z: h }];
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, wrap.clientWidth / wrap.clientHeight, 0.1, 100);
  camera.position.set(side * 0.9, side * 0.85, side * 0.9);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(wrap.clientWidth, wrap.clientHeight || 320);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  wrap.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(side, side * 1.4, side * 0.6);
  scene.add(dir);

  const rig = new THREE.Group();
  scene.add(rig);

  // пол — по настоящему контуру плана (или квадрат, если плана нет)
  const shape = new THREE.Shape();
  outerPts.forEach((p, i) => (i === 0 ? shape.moveTo(p.x, p.z) : shape.lineTo(p.x, p.z)));
  shape.closePath();
  const floor = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshStandardMaterial({ color: 0x123027, metalness: 0.1, roughness: 0.9, side: THREE.DoubleSide })
  );
  floor.rotation.x = -Math.PI / 2;
  rig.add(floor);

  // сетка на полу (ориентир масштаба)
  const grid = new THREE.GridHelper(side, Math.max(4, Math.round(side / 2)), 0x3fd9a4, 0x1b3a32);
  grid.position.y = 0.01;
  rig.add(grid);

  // прозрачные стены по реальному периметру
  const wallMat = new THREE.MeshBasicMaterial({ color: 0x45d9ff, transparent: true, opacity: 0.08, side: THREE.DoubleSide });
  rig.add(twinBuildWallStrip(outerPts, height, wallMat));

  // если распознаны отдельные комнаты — отмечаем их границы на полу
  if (footprint && footprint.rooms && footprint.rooms.length) {
    footprint.rooms.forEach((room) => {
      const linePts = room.map((p) => new THREE.Vector3(p.x, 0.015, p.z));
      linePts.push(linePts[0]);
      const geo = new THREE.BufferGeometry().setFromPoints(linePts);
      rig.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x35e08f })));
    });
  }

  // расстановка приборов: внутри реального контура (по комнатам, если
  // они распознаны) или по сетке в квадрате, если плана нет
  const flatDevices = [];
  twinState.groups.forEach((g) => {
    for (let i = 0; i < g.count; i++) flatDevices.push(g.key);
  });

  let placements;
  if (footprint) {
    placements = twinPlaceInFootprint(flatDevices.length, footprint);
  } else {
    const cols = Math.max(1, Math.ceil(Math.sqrt(flatDevices.length)));
    const cellSize = side / (cols + 1);
    placements = flatDevices.map((_, i) => ({
      x: -side / 2 + cellSize * ((i % cols) + 1),
      z: -side / 2 + cellSize * (Math.floor(i / cols) + 1),
    }));
  }

  flatDevices.forEach((key, i) => {
    const cat = TWIN_CATALOG[key];
    const { x, z } = placements[i] || { x: 0, z: 0 };

    let mesh;
    if (cat.shape === 'lamp') {
      mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 12, 12),
        new THREE.MeshStandardMaterial({ color: cat.color, emissive: cat.color, emissiveIntensity: 0.5 })
      );
      mesh.position.set(x, height - 0.25, z);
    } else {
      mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.5, 0.5),
        new THREE.MeshStandardMaterial({ color: cat.color })
      );
      mesh.position.set(x, 0.28, z);
    }
    mesh.userData.key = key;
    rig.add(mesh);
  });

  twinState.scene = scene;
  twinState.camera = camera;
  twinState.renderer = renderer;
  twinState.rig = rig;

  // вращение мышью/пальцем
  let dragging = false;
  let lastX = 0;
  renderer.domElement.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; });
  window.addEventListener('pointerup', () => { dragging = false; });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    rig.rotation.y += (e.clientX - lastX) * 0.008;
    lastX = e.clientX;
  });

  function animate() {
    twinState.animId = requestAnimationFrame(animate);
    rig.rotation.y += 0.0015; // лёгкое авто-вращение, когда не тянут
    renderer.render(scene, camera);
  }
  animate();
}

// ---------- список приборов ----------
function twinRenderDeviceList() {
  const list = document.getElementById('twin-device-list');
  list.innerHTML = '';

  twinState.groups.forEach((g, idx) => {
    const cat = TWIN_CATALOG[g.key];
    const row = document.createElement('div');
    row.className = 'twin-device-row';

    const fullySwapped = g.swapped >= g.count;
    const powerNow = twinGroupPower(g);

    row.innerHTML = `
      <span class="dev-name">
        <span class="twin-device-dot" style="background:#${cat.color.toString(16).padStart(6, '0')}"></span>
        ${cat.label} × ${g.count}
        <span class="dev-power">· ${powerNow} Вт суммарно</span>
      </span>
      <button type="button" class="twin-swap-btn ${fullySwapped ? 'done' : ''}" data-idx="${idx}">
        ${fullySwapped ? '✓ ' + cat.effLabel : 'Заменить на: ' + cat.effLabel}
      </button>
    `;
    list.appendChild(row);
  });

  list.querySelectorAll('.twin-swap-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.idx);
      const g = twinState.groups[idx];
      if (g.swapped >= g.count) return;
      g.swapped = g.count; // заменяем всю группу разом (упрощение для MVP)
      twinRenderDeviceList();
      twinRenderScene();
      twinUpdateForecast();
      twinUpdateComparison();
    });
  });
}

// ---------- сравнение модели с реальностью ----------
async function twinUpdateComparison() {
  const modelKwh = twinWeeklyKwh(twinState.groups);
  const modelBar = document.getElementById('twin-bar-model');
  const modelValue = document.getElementById('twin-value-model');
  const realBar = document.getElementById('twin-bar-real');
  const realValue = document.getElementById('twin-value-real');
  const note = document.getElementById('twin-compare-note');

  let realKwh = null;
  try {
    const { summary } = await api.getSummary();
    realKwh = summary && summary.electricity ? summary.electricity.total_kwh : null;
  } catch (e) {
    realKwh = null;
  }

  const max = Math.max(modelKwh, realKwh || 0, 1);
  modelBar.style.width = `${Math.min(100, (modelKwh / max) * 100)}%`;
  modelValue.textContent = `${modelKwh.toFixed(1)} кВт·ч/нед`;

  if (realKwh === null) {
    realBar.style.width = '0%';
    realValue.textContent = '—';
    note.textContent = 'Реальные показания появятся здесь, как только начнут поступать данные с датчиков или из ручного ввода.';
  } else {
    realBar.style.width = `${Math.min(100, (realKwh / max) * 100)}%`;
    realValue.textContent = `${realKwh.toFixed(1)} кВт·ч/нед`;
    const diff = modelKwh - realKwh;
    const pct = realKwh > 0 ? Math.round((diff / realKwh) * 100) : 0;
    note.textContent = diff >= 0
      ? `Модель предполагает на ${Math.abs(pct)}% больше расхода, чем показывают реальные данные — возможно, часть приборов используется реже, чем в среднем по норме.`
      : `Реальный расход выше модели на ${Math.abs(pct)}% — стоит проверить приборы, которых нет в модели, либо их время работы.`;
  }
}

// ---------- прогноз при частичной замене ----------
function twinUpdateForecast() {
  const slider = document.getElementById('twin-slider');
  const pct = Number(slider.value);
  document.getElementById('twin-slider-value').textContent = `${pct}%`;

  const currentKwh = twinWeeklyKwh(twinState.groups);

  // считаем гипотетическую замену pct% ещё не заменённых приборов во всех группах
  const projectedGroups = twinState.groups.map((g) => {
    const remaining = g.count - g.swapped;
    const extraSwap = Math.round(remaining * (pct / 100));
    return { ...g, swapped: g.swapped + extraSwap };
  });
  const projectedKwh = twinWeeklyKwh(projectedGroups);

  const currentCost = currentKwh * TWIN_TARIFF_ELECTRICITY;
  const projectedCost = projectedKwh * TWIN_TARIFF_ELECTRICITY;

  twinDrawChart(currentKwh, projectedKwh);

  const savingKwh = currentKwh - projectedKwh;
  const savingCost = currentCost - projectedCost;
  const aiNote = document.getElementById('twin-ai-note');
  if (savingKwh <= 0.05) {
    aiNote.textContent = 'Все приборы в модели уже энергоэффективны — двигайте ползунок, чтобы увидеть эффект замены оставшихся, если появятся новые.';
  } else {
    aiNote.textContent = `AI-прогноз: при замене ${pct}% оставшихся приборов на энергоэффективные — экономия ≈ ${savingKwh.toFixed(1)} кВт·ч/нед (≈ ${Math.round(savingCost)} ₸/нед, или ≈ ${Math.round(savingCost * 4.3)} ₸/мес).`;
  }
}

function twinDrawChart(currentKwh, projectedKwh) {
  const svg = document.getElementById('twin-chart');
  const w = 320, h = 130, pad = 24;
  const max = Math.max(currentKwh, projectedKwh, 1) * 1.15;
  const barW = 70;

  const barH1 = ((h - pad) * currentKwh) / max;
  const barH2 = ((h - pad) * projectedKwh) / max;

  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.innerHTML = `
    <line x1="0" y1="${h - pad}" x2="${w}" y2="${h - pad}" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
    <rect x="60" y="${h - pad - barH1}" width="${barW}" height="${barH1}" rx="8" fill="var(--aqua)" opacity="0.85"/>
    <rect x="190" y="${h - pad - barH2}" width="${barW}" height="${barH2}" rx="8" fill="var(--green)" opacity="0.9"/>
    <text x="95" y="${h - pad + 16}" fill="var(--muted)" font-size="11" text-anchor="middle">сейчас</text>
    <text x="225" y="${h - pad + 16}" fill="var(--muted)" font-size="11" text-anchor="middle">после замены</text>
    <text x="95" y="${h - pad - barH1 - 6}" fill="var(--text)" font-size="12" text-anchor="middle">${currentKwh.toFixed(1)}</text>
    <text x="225" y="${h - pad - barH2 - 6}" fill="var(--text)" font-size="12" text-anchor="middle">${projectedKwh.toFixed(1)}</text>
  `;
}

document.addEventListener('DOMContentLoaded', twinInit);
