// ===================== 3D-двойник помещения =====================
// Строит упрощённую 3D-модель дома/школы/малого бизнеса, расставляет
// в неё типовые энергопотребители, даёт "AI"-рекомендации по замене
// на энергоэффективные аналоги и сравнивает модель с реальными
// показаниями пользователя (через /api/analytics/summary).
//
// Это MVP: расстановка приборов и нормативы — эвристика на основе
// площади/количества людей, а не распознавание чертежа. Оставлено
// специально простым и читаемым, чтобы было легко расширять
// (например, подключить загрузку плана и компьютерное зрение).

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

// ---------- состояние модуля ----------
const twinState = {
  type: 'household',
  area: 60,
  units: 4,
  groups: [],
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

  twinState.type = type;
  twinState.area = area;
  twinState.units = units;
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

  const side = Math.max(6, Math.sqrt(twinState.area));
  const height = 3.2;

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

  // пол
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(side, side),
    new THREE.MeshStandardMaterial({ color: 0x123027, metalness: 0.1, roughness: 0.9 })
  );
  floor.rotation.x = -Math.PI / 2;
  rig.add(floor);

  // сетка на полу
  const grid = new THREE.GridHelper(side, Math.max(4, Math.round(side / 2)), 0x3fd9a4, 0x1b3a32);
  grid.position.y = 0.01;
  rig.add(grid);

  // прозрачные стены (ориентир объёма помещения)
  const wallMat = new THREE.MeshBasicMaterial({ color: 0x45d9ff, transparent: true, opacity: 0.06, side: THREE.DoubleSide });
  const wallBack = new THREE.Mesh(new THREE.PlaneGeometry(side, height), wallMat);
  wallBack.position.set(0, height / 2, -side / 2);
  rig.add(wallBack);
  const wallLeft = new THREE.Mesh(new THREE.PlaneGeometry(side, height), wallMat);
  wallLeft.rotation.y = Math.PI / 2;
  wallLeft.position.set(-side / 2, height / 2, 0);
  rig.add(wallLeft);

  // расстановка приборов по сетке
  const flatDevices = [];
  twinState.groups.forEach((g) => {
    for (let i = 0; i < g.count; i++) flatDevices.push(g.key);
  });

  const cols = Math.max(1, Math.ceil(Math.sqrt(flatDevices.length)));
  const cellSize = side / (cols + 1);

  flatDevices.forEach((key, i) => {
    const cat = TWIN_CATALOG[key];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = -side / 2 + cellSize * (col + 1);
    const z = -side / 2 + cellSize * (row + 1);

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
