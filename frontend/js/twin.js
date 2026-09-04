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
  // Целевые (куда крутит/тянет пользователь) и текущие (что реально
  // рисуется) значения — камера плавно "догоняет" цель с затуханием
  // (как орбитальная камера в Blender/three.js OrbitControls), а не
  // прыгает мгновенно вслед за мышью.
  rotY: 0.6,
  rotX: 0.5,
  targetRotY: 0.6,
  targetRotX: 0.5,
  zoom: 1,
  targetZoom: 1,
  dragging: false,
  lastX: 0,
  lastY: 0,
  autoSpin: false,
  introT: 0, // 0..1 прогресс "кинематографичного" залёта камеры при генерации
  camDist: 8,
  devices: [],       // [{ id, name, watts, hoursPerDay, efficient, color, roomIndex, roomName }]
  dailyModelKwh: 0,
  dailyRealKwh: 0,
};

// Комнаты, которые пользователь заполняет вручную (название + свои приборы).
// Если хотя бы в одной комнате есть прибор — модель строит приборы по этим
// комнатам вместо типового набора, и расставляет их по отдельным кластерам,
// а не одной общей кучей/кругом на всё помещение (раньше, например, холодильник
// и стиральная машина одной "квартиры" оказывались рядом по кругу без привязки
// к тому, в какой они на самом деле комнате).
const twinRoomsState = { rooms: [], nextRoomId: 1, nextDeviceId: 1 };
const TWIN_ROOM_PALETTE = ['#45d9ff', '#35e08f', '#a78bfa', '#ffb23f', '#ff6b81', '#4ade80', '#38bdf8', '#f472b6'];

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

  // Когда план применён (появились/изменились точки приборов) — перерисовываем
  // панель комнат, чтобы в выпадающем списке появились новые точки на плане.
  window.addEventListener('ecotchi:floorplan-applied', () => twinRenderRoomsUI());

  const addRoomBtn = document.getElementById('twin-add-room-btn');
  if (addRoomBtn) {
    addRoomBtn.addEventListener('click', () => {
      twinAddRoom();
      twinRenderRoomsUI();
    });
    // сразу предлагаем одну пустую комнату, чтобы было понятно, что делать
    twinAddRoom();
    twinRenderRoomsUI();
  }
}

// ---------- комнаты и приборы, которые задаёт пользователь ----------
function twinAddRoom() {
  twinRoomsState.rooms.push({ id: twinRoomsState.nextRoomId++, name: '', devices: [] });
}

function twinRemoveRoom(roomId) {
  twinRoomsState.rooms = twinRoomsState.rooms.filter((r) => r.id !== roomId);
  twinRenderRoomsUI();
}

function twinAddDeviceToRoom(roomId, device) {
  const room = twinRoomsState.rooms.find((r) => r.id === roomId);
  if (!room) return;
  room.devices.push({ id: twinRoomsState.nextDeviceId++, ...device });
  twinRenderRoomsUI();
}

function twinRemoveDeviceFromRoom(roomId, deviceId) {
  const room = twinRoomsState.rooms.find((r) => r.id === roomId);
  if (!room) return;
  room.devices = room.devices.filter((d) => d.id !== deviceId);
  twinRenderRoomsUI();
}

function twinRenderRoomsUI() {
  const list = document.getElementById('twin-rooms-list');
  if (!list) return;
  list.innerHTML = '';

  twinRoomsState.rooms.forEach((room, roomIdx) => {
    const color = TWIN_ROOM_PALETTE[roomIdx % TWIN_ROOM_PALETTE.length];

    const card = document.createElement('div');
    card.className = 'twin-room-card';
    card.dataset.roomId = String(room.id);

    const head = document.createElement('div');
    head.className = 'twin-room-head';
    const dot = document.createElement('span');
    dot.className = 'twin-room-dot';
    dot.style.background = color;
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'twin-room-name-input';
    nameInput.placeholder = `Комната ${roomIdx + 1} (напр. Кухня)`;
    nameInput.value = room.name;
    nameInput.addEventListener('input', (e) => { room.name = e.target.value; });
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'twin-room-remove-btn';
    removeBtn.textContent = '×';
    removeBtn.title = 'Удалить комнату';
    removeBtn.addEventListener('click', () => twinRemoveRoom(room.id));
    head.append(dot, nameInput, removeBtn);

    const devList = document.createElement('div');
    devList.className = 'twin-room-device-list';
    if (!room.devices.length) {
      const empty = document.createElement('div');
      empty.className = 'twin-room-empty';
      empty.textContent = 'Пока нет приборов — добавьте ниже.';
      devList.appendChild(empty);
    }
    room.devices.forEach((dev) => {
      const row = document.createElement('div');
      row.className = 'twin-room-device-row';
      const nameSpan = document.createElement('span');
      nameSpan.className = 'rd-name';
      nameSpan.textContent = dev.model ? `${dev.name} — ${dev.model}` : dev.name;
      const powerSpan = document.createElement('span');
      powerSpan.className = 'rd-power';
      powerSpan.textContent = `${dev.watts} Вт · ${dev.hours} ч/день`;
      const rmBtn = document.createElement('button');
      rmBtn.type = 'button';
      rmBtn.className = 'twin-room-device-remove';
      rmBtn.textContent = '×';
      rmBtn.addEventListener('click', () => twinRemoveDeviceFromRoom(room.id, dev.id));
      const right = document.createElement('span');
      right.style.display = 'flex';
      right.style.alignItems = 'center';
      right.style.gap = '8px';
      right.append(powerSpan, rmBtn);
      row.append(nameSpan, right);
      devList.appendChild(row);

      // Если указана паспортная/квитанционная мощность — сразу под строкой
      // прибора показываем сравнение с тем, что введено в модель.
      if (dev.ratedWatts) {
        const cmp = twinCompareRatedWatts(dev.watts, dev.ratedWatts);
        const cmpRow = document.createElement('div');
        cmpRow.className = `twin-room-device-compare twin-room-device-compare-${cmp.level}`;
        cmpRow.textContent = cmp.text;
        devList.appendChild(cmpRow);
      }
      if (dev.lookupSummary) {
        const lookupRow = document.createElement('div');
        lookupRow.className = 'twin-room-device-lookup';
        lookupRow.textContent = dev.lookupSummary;
        devList.appendChild(lookupRow);
      }

      // Если в редакторе плана отмечены точки приборов — даём привязать
      // конкретный прибор к конкретной точке на плане, чтобы в 3D он встал
      // именно там (а не в центре комнаты/ячейки автоматически).
      const planPoints = window.EcotchiFloorplan && window.EcotchiFloorplan.devicePoints;
      if (planPoints && planPoints.length) {
        const planRow = document.createElement('div');
        planRow.className = 'twin-room-device-planpoint';
        const planLabel = document.createElement('span');
        planLabel.textContent = 'Место на плане:';
        const planSelect = document.createElement('select');
        planSelect.className = 'twin-room-device-planpoint-select';
        const noneOpt = document.createElement('option');
        noneOpt.value = '';
        noneOpt.textContent = '— авто-расстановка —';
        planSelect.appendChild(noneOpt);
        planPoints.forEach((pt, idx) => {
          const opt = document.createElement('option');
          opt.value = String(idx);
          opt.textContent = `${idx + 1}. ${pt.label}`;
          if (dev.planPointIndex === idx) opt.selected = true;
          planSelect.appendChild(opt);
        });
        planSelect.addEventListener('change', () => {
          const val = planSelect.value;
          dev.planPointIndex = val === '' ? null : Number(val);
        });
        planRow.append(planLabel, planSelect);
        devList.appendChild(planRow);
      }
    });

    const form = document.createElement('div');
    form.className = 'twin-room-add-form';
    const nameField = document.createElement('input');
    nameField.type = 'text';
    nameField.className = 'twin-room-dev-name';
    nameField.placeholder = 'Прибор, напр. Холодильник';
    const modelField = document.createElement('input');
    modelField.type = 'text';
    modelField.placeholder = 'Модель (необязательно), напр. Samsung RB33';
    modelField.className = 'twin-room-model-field twin-room-dev-model';
    const lookupBtn = document.createElement('button');
    lookupBtn.type = 'button';
    lookupBtn.className = 'twin-room-lookup-btn';
    lookupBtn.textContent = 'Найти модель';
    lookupBtn.title = 'Найти характеристики модели в интернете и сравнить с вашими данными';
    const lookupPanel = document.createElement('div');
    lookupPanel.className = 'twin-lookup-panel hidden';
    const wattsField = document.createElement('input');
    wattsField.type = 'number';
    wattsField.min = '1';
    wattsField.className = 'twin-room-dev-watts';
    wattsField.placeholder = 'Вт';
    wattsField.value = '100';
    const hoursField = document.createElement('input');
    hoursField.type = 'number';
    hoursField.min = '0.1';
    hoursField.step = '0.1';
    hoursField.className = 'twin-room-dev-hours';
    hoursField.placeholder = 'ч/день';
    hoursField.value = '1';
    const ratedField = document.createElement('input');
    ratedField.type = 'number';
    ratedField.min = '0';
    ratedField.placeholder = 'Вт по паспорту/квитанции';
    ratedField.title = 'Необязательно: максимальная мощность, указанная на шильдике прибора или в квитанции/у счётчика — для сверки с тем, что введено выше.';
    ratedField.className = 'twin-room-rated-field twin-room-dev-rated';
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'twin-room-add-btn';
    addBtn.textContent = '+ Добавить прибор';
    const errorMsg = document.createElement('div');
    errorMsg.className = 'twin-room-add-error hidden';
    const submit = () => {
      const name = nameField.value.trim();
      const model = modelField.value.trim();
      // не у всех раскладок/локалей number-инпут понимает запятую как разделитель
      const watts = Number(String(wattsField.value).replace(',', '.'));
      const hours = Number(String(hoursField.value).replace(',', '.'));
      const ratedRaw = String(ratedField.value).replace(',', '.').trim();
      const ratedWatts = ratedRaw === '' ? null : Number(ratedRaw);
      if (!name) {
        errorMsg.textContent = 'Впишите название прибора.';
        errorMsg.classList.remove('hidden');
        nameField.focus();
        return;
      }
      if (!watts || watts <= 0) {
        errorMsg.textContent = 'Укажите мощность в ваттах (больше 0).';
        errorMsg.classList.remove('hidden');
        wattsField.focus();
        return;
      }
      if (!hours || hours <= 0) {
        errorMsg.textContent = 'Укажите, сколько часов в день работает прибор (больше 0).';
        errorMsg.classList.remove('hidden');
        hoursField.focus();
        return;
      }
      if (ratedWatts != null && (Number.isNaN(ratedWatts) || ratedWatts < 0)) {
        errorMsg.textContent = 'Мощность по паспорту/квитанции должна быть числом от 0 или пустой.';
        errorMsg.classList.remove('hidden');
        ratedField.focus();
        return;
      }
      errorMsg.classList.add('hidden');
      twinAddDeviceToRoom(room.id, {
        name,
        model: model || null,
        watts,
        hours,
        ratedWatts,
        lookupSummary: lookupPanel.dataset.summary || null,
        lookupData: lookupPanel.dataset.lookup ? JSON.parse(lookupPanel.dataset.lookup) : null,
      });
      nameField.value = '';
      modelField.value = '';
      wattsField.value = '100';
      hoursField.value = '1';
      ratedField.value = '';
      lookupPanel.classList.add('hidden');
      lookupPanel.innerHTML = '';
      lookupPanel.dataset.summary = '';
      lookupPanel.dataset.lookup = '';
    };
    addBtn.addEventListener('click', submit);
    lookupBtn.addEventListener('click', () => {
      twinLookupAppliance({
        nameField,
        modelField,
        wattsField,
        hoursField,
        ratedField,
        lookupBtn,
        lookupPanel,
      });
    });
    [nameField, modelField, wattsField, hoursField, ratedField].forEach((el) => {
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    });
    form.append(nameField, modelField, lookupBtn, wattsField, hoursField, ratedField, addBtn);

    card.append(head, devList, form, lookupPanel, errorMsg);
    list.appendChild(card);
  });
}

function twinBuildDevicesFromRooms() {
  const devices = [];
  twinRoomsState.rooms.forEach((room, roomIdx) => {
    if (!room.devices.length) return;
    const roomName = room.name.trim() || `Комната ${roomIdx + 1}`;
    room.devices.forEach((dev) => {
      devices.push({
        id: `room-${room.id}-dev-${dev.id}`,
        name: `${dev.name} (${roomName})`,
        model: dev.model || null,
        ratedWatts: dev.ratedWatts != null ? dev.ratedWatts : null,
        watts: dev.watts,
        hoursPerDay: dev.hours,
        essential: false,
        efficient: false,
        color: TWIN_ROOM_PALETTE[roomIdx % TWIN_ROOM_PALETTE.length],
        roomIndex: roomIdx,
        roomName,
        planPointIndex: dev.planPointIndex != null ? dev.planPointIndex : null,
      });
    });
  });
  return devices;
}

/** Перед генерацией подхватывает прибор из незавершённой формы (если имя заполнено). */
function twinFlushPendingDevices() {
  const pending = [];
  twinRoomsState.rooms.forEach((room) => {
    const card = document.querySelector(`.twin-room-card[data-room-id="${room.id}"]`);
    if (!card) return;
    const name = card.querySelector('.twin-room-dev-name')?.value.trim();
    if (!name) return;
    const model = card.querySelector('.twin-room-dev-model')?.value.trim() || null;
    const watts = Number(String(card.querySelector('.twin-room-dev-watts')?.value || '').replace(',', '.'));
    const hours = Number(String(card.querySelector('.twin-room-dev-hours')?.value || '').replace(',', '.'));
    const ratedRaw = String(card.querySelector('.twin-room-dev-rated')?.value || '').replace(',', '.').trim();
    const ratedWatts = ratedRaw === '' ? null : Number(ratedRaw);
    if (!watts || watts <= 0 || !hours || hours <= 0) return;
    if (ratedWatts != null && (Number.isNaN(ratedWatts) || ratedWatts < 0)) return;

    const lookupPanel = card.querySelector('.twin-lookup-panel');
    pending.push({
      roomId: room.id,
      device: {
        name,
        model,
        watts,
        hours,
        ratedWatts,
        lookupSummary: lookupPanel?.dataset.summary || null,
        lookupData: lookupPanel?.dataset.lookup ? JSON.parse(lookupPanel.dataset.lookup) : null,
      },
    });
  });

  pending.forEach(({ roomId, device }) => {
    const room = twinRoomsState.rooms.find((r) => r.id === roomId);
    if (!room) return;
    room.devices.push({ id: twinRoomsState.nextDeviceId++, ...device });
  });
  if (pending.length) twinRenderRoomsUI();
  return pending.length;
}

function twinSetGenerateStatus(text, level = 'info') {
  const el = document.getElementById('twin-generate-status');
  if (!el) return;
  el.textContent = text || '';
  el.className = `twin-generate-status${text ? ` twin-generate-status-${level}` : ''}`;
}

function twinHasRoomSetup() {
  return twinRoomsState.rooms.some((r) => r.name.trim() || r.devices.length);
}

// ---------- поиск характеристик прибора по модели (AI + сравнение) ----------

async function twinLookupAppliance({ nameField, modelField, wattsField, hoursField, ratedField, lookupBtn, lookupPanel }) {
  const name = nameField.value.trim();
  const model = modelField.value.trim();
  if (!name && !model) {
    twinRenderLookupPanel(lookupPanel, { error: 'Введите название прибора или модель.' });
    return;
  }

  lookupBtn.disabled = true;
  lookupBtn.textContent = '…';
  twinRenderLookupPanel(lookupPanel, { loading: true });

  const watts = Number(String(wattsField.value).replace(',', '.')) || null;
  const hours = Number(String(hoursField.value).replace(',', '.')) || null;
  const ratedRaw = String(ratedField.value).replace(',', '.').trim();
  const ratedWatts = ratedRaw === '' ? null : Number(ratedRaw);

  try {
    const data = await api.lookupAppliance({
      name,
      model,
      userWatts: watts,
      userHoursPerDay: hours,
      ratedWatts,
    });

    twinRenderLookupPanel(lookupPanel, { data, wattsField, hoursField, ratedField });
    lookupPanel.dataset.summary = data.summary || '';
    lookupPanel.dataset.lookup = JSON.stringify(data);
  } catch (err) {
    twinRenderLookupPanel(lookupPanel, { error: err.message || 'Ошибка сети. Проверьте подключение и попробуйте снова.' });
  } finally {
    lookupBtn.disabled = false;
    lookupBtn.textContent = 'Найти модель';
  }
}

function twinRenderLookupPanel(panel, { loading, error, data, wattsField, hoursField, ratedField }) {
  panel.classList.remove('hidden');
  panel.innerHTML = '';

  if (loading) {
    panel.className = 'twin-lookup-panel twin-lookup-loading';
    panel.textContent = 'Ищем характеристики модели и сравниваем с вашими данными…';
    return;
  }

  if (error) {
    panel.className = 'twin-lookup-panel twin-lookup-error';
    panel.textContent = error;
    return;
  }

  panel.className = 'twin-lookup-panel';

  const { specs, comparison, source, confidence, aiEnabled, summary } = data;
  const sourceLabel = source === 'llm'
    ? 'AI (интернет-знания)'
    : source === 'catalog'
    ? 'Справочник'
    : 'Типовые значения';

  const head = document.createElement('div');
  head.className = 'twin-lookup-head';
  head.innerHTML = `<strong>${specs.brand || ''} ${specs.model || ''}</strong>`
    + `<span class="twin-lookup-source">${sourceLabel}${confidence ? ` · ${confidence}` : ''}</span>`;

  const specsGrid = document.createElement('div');
  specsGrid.className = 'twin-lookup-specs';
  const specItems = [];
  if (specs.energyClass && specs.energyClass !== '—') {
    specItems.push(`<span>Класс: <b>${specs.energyClass}</b></span>`);
  }
  if (specs.ratedWatts) specItems.push(`<span>Мощность: <b>${specs.ratedWatts} Вт</b></span>`);
  if (specs.annualKwh) specItems.push(`<span>~${specs.annualKwh} кВт·ч/год</span>`);
  if (specs.typicalHoursPerDay) specItems.push(`<span>~${specs.typicalHoursPerDay} ч/сут</span>`);
  specsGrid.innerHTML = specItems.join('');

  panel.appendChild(head);
  if (specItems.length) panel.appendChild(specsGrid);

  if (specs.description) {
    const desc = document.createElement('p');
    desc.className = 'twin-lookup-desc';
    desc.textContent = specs.description;
    panel.appendChild(desc);
  }

  if (specs.workloadFactors && specs.workloadFactors.length) {
    const wlTitle = document.createElement('div');
    wlTitle.className = 'twin-lookup-wl-title';
    wlTitle.textContent = 'Потребление при разных нагрузках:';
    panel.appendChild(wlTitle);
    const wlList = document.createElement('ul');
    wlList.className = 'twin-lookup-wl-list';
    specs.workloadFactors.forEach((wf) => {
      const li = document.createElement('li');
      li.textContent = `${wf.condition}: ~${wf.consumptionKwh} кВт·ч (${wf.unit})`;
      wlList.appendChild(li);
    });
    panel.appendChild(wlList);
  }

  const compareBlock = document.createElement('div');
  compareBlock.className = 'twin-lookup-compare';
  const compareLines = [];
  if (comparison.modelVsSpec && comparison.modelVsSpec.text) {
    compareLines.push({ text: comparison.modelVsSpec.text, level: comparison.modelVsSpec.level });
  }
  if (comparison.ratedVsSpec && comparison.ratedVsSpec.text) {
    compareLines.push({ text: comparison.ratedVsSpec.text, level: comparison.ratedVsSpec.level });
  }
  if (comparison.modelVsSpecDaily && comparison.modelVsSpecDaily.text) {
    compareLines.push({ text: comparison.modelVsSpecDaily.text, level: comparison.modelVsSpecDaily.level });
  }
  if (comparison.userReadings && comparison.userReadings.text) {
    compareLines.push({ text: comparison.userReadings.text, level: comparison.userReadings.level });
  }
  compareLines.forEach(({ text, level }) => {
    const row = document.createElement('div');
    row.className = `twin-lookup-compare-row twin-lookup-compare-${level || 'neutral'}`;
    row.textContent = text;
    compareBlock.appendChild(row);
  });
  if (compareLines.length) panel.appendChild(compareBlock);

  if (!aiEnabled && source === 'fallback') {
    const hint = document.createElement('div');
    hint.className = 'twin-lookup-hint';
    hint.textContent = 'Для точного поиска по модели задайте GEMINI_API_KEY на сервере.';
    panel.appendChild(hint);
  }

  const actions = document.createElement('div');
  actions.className = 'twin-lookup-actions';
  if (specs.ratedWatts && ratedField) {
    const applyRated = document.createElement('button');
    applyRated.type = 'button';
    applyRated.className = 'twin-lookup-apply-btn';
    applyRated.textContent = `Подставить ${specs.ratedWatts} Вт (паспорт)`;
    applyRated.addEventListener('click', () => { ratedField.value = specs.ratedWatts; });
    actions.appendChild(applyRated);
  }
  if (specs.ratedWatts && wattsField) {
    const applyWatts = document.createElement('button');
    applyWatts.type = 'button';
    applyWatts.className = 'twin-lookup-apply-btn';
    applyWatts.textContent = `Подставить ${specs.ratedWatts} Вт в модель`;
    applyWatts.addEventListener('click', () => { wattsField.value = specs.ratedWatts; });
    actions.appendChild(applyWatts);
  }
  if (specs.typicalHoursPerDay && hoursField) {
    const applyHours = document.createElement('button');
    applyHours.type = 'button';
    applyHours.className = 'twin-lookup-apply-btn';
    applyHours.textContent = `Подставить ${specs.typicalHoursPerDay} ч/сут`;
    applyHours.addEventListener('click', () => { hoursField.value = specs.typicalHoursPerDay; });
    actions.appendChild(applyHours);
  }
  if (actions.childNodes.length) panel.appendChild(actions);

  if (summary) {
    const sumEl = document.createElement('p');
    sumEl.className = 'twin-lookup-summary';
    sumEl.textContent = summary;
    panel.appendChild(sumEl);
  }
}

// ---------- сверка введённой мощности с паспортом прибора/квитанцией ----------
// dev.watts — то, что задано в модели двойника; ratedWatts — то, что пользователь
// переписал с шильдика прибора, счётчика или квитанции. Порог в 15% выбран как
// разумный запас на округление и на то, что реальная мощность приборов часто
// ниже "пиковой" паспортной — совпадение до пары ватт можно не ожидать.
function twinCompareRatedWatts(modelWatts, ratedWatts) {
  const diff = modelWatts - ratedWatts;
  const diffPct = ratedWatts > 0 ? (diff / ratedWatts) * 100 : 0;
  const absPct = Math.abs(diffPct);

  if (absPct <= 15) {
    return {
      level: 'ok',
      text: `Совпадает с паспортом/квитанцией (${ratedWatts} Вт), расхождение ${absPct.toFixed(0)}%.`,
    };
  }
  if (diff > 0) {
    return {
      level: 'warn',
      text: `Внимание: в модели ${modelWatts} Вт, а по паспорту/квитанции — ${ratedWatts} Вт (на ${absPct.toFixed(0)}% меньше). Возможно, прибор изношен или указана не пиковая мощность — проверьте цифры.`,
    };
  }
  return {
    level: 'warn',
    text: `Внимание: в модели ${modelWatts} Вт, а по паспорту/квитанции — ${ratedWatts} Вт (на ${absPct.toFixed(0)}% больше). Возможно, прибор потребляет больше заявленного — стоит перепроверить показания.`,
  };
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
  const toolbar = document.getElementById('twin-scene-toolbar');
  if (toolbar) toolbar.hidden = true;
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

// Считает позиции приборов на полу. Если приборы привязаны к комнатам
// (roomIndex задан), группирует их по комнатам в отдельных ячейках сетки;
// иначе — как раньше, одним кругом по всему контуру.
function twinComputeDevicePositions(devices, footprintSize) {
  const n = devices.length || 1;
  const hasRoomBinding = devices.some((d) => d.roomIndex !== undefined);

  // Приборы, для которых пользователь в редакторе плана явно отметил точку
  // ("Комнаты и приборы" → "Место на плане") — ставим их точно в эти
  // реальные координаты, а не в автоматически рассчитанный центр
  // комнаты/ячейки. Остальные приборы по-прежнему распределяются старым
  // алгоритмом (по кругу или по ячейкам комнат).
  const planPoints = window.EcotchiFloorplan && window.EcotchiFloorplan.devicePoints;
  const pinnedPositions = new Map(); // index in devices -> {x, z}
  if (planPoints && planPoints.length) {
    devices.forEach((dev, i) => {
      if (dev.planPointIndex != null && planPoints[dev.planPointIndex]) {
        const pt = planPoints[dev.planPointIndex];
        pinnedPositions.set(i, { x: pt.x, z: pt.z });
      }
    });
  }

  const fallback = (() => {
    if (!hasRoomBinding) {
      const r = footprintSize * 0.32;
      if (n === 1) return [{ x: 0, z: 0 }];
      return devices.map((_, i) => ({
        x: Math.cos((i / n) * Math.PI * 2) * r,
        z: Math.sin((i / n) * Math.PI * 2) * r,
      }));
    }

    const roomIndices = [...new Set(devices.map((d) => d.roomIndex))];
    const cols = Math.ceil(Math.sqrt(roomIndices.length));
    const rows = Math.ceil(roomIndices.length / cols);
    const cellW = footprintSize * 0.85 / cols;
    const cellH = footprintSize * 0.85 / rows;

    const roomDeviceCounters = new Map();
    return devices.map((dev) => {
      const slot = roomIndices.indexOf(dev.roomIndex);
      const col = slot % cols;
      const row = Math.floor(slot / cols);
      const cx = (col - (cols - 1) / 2) * cellW;
      const cz = (row - (rows - 1) / 2) * cellH;

      const count = roomDeviceCounters.get(dev.roomIndex) || 0;
      roomDeviceCounters.set(dev.roomIndex, count + 1);
      const roomDeviceCount = devices.filter((d) => d.roomIndex === dev.roomIndex).length;
      const clusterR = Math.min(cellW, cellH) * (roomDeviceCount > 1 ? 0.22 : 0);
      const angle = (count / Math.max(1, roomDeviceCount)) * Math.PI * 2;

      return {
        x: cx + (roomDeviceCount > 1 ? Math.cos(angle) * clusterR : 0),
        z: cz + (roomDeviceCount > 1 ? Math.sin(angle) * clusterR : 0),
      };
    });
  })();

  if (!pinnedPositions.size) return fallback;

  return devices.map((_, i) => pinnedPositions.get(i) || fallback[i]);
}

function twinBuildScene(areaM2) {
  const wrap = document.getElementById('twin-scene-wrap');
  wrap.innerHTML = '';

  const width = wrap.clientWidth || 600;
  const height = Math.max(320, wrap.clientHeight || 320);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1512);
  scene.fog = new THREE.Fog(0x0b1512, 10, 60);

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 200);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  // Мягкие тени + киношный тонмаппинг — то, чего не хватало, чтобы вид
  // ощущался как окно 3D-редактора (Blender/Cycles), а не как плоские
  // залитые цветом кубики без объёма.
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if (THREE.ACESFilmicToneMapping) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
  }
  if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
  else if ('outputEncoding' in renderer) renderer.outputEncoding = THREE.sRGBEncoding;
  wrap.appendChild(renderer.domElement);

  // свет — раньше пол/стены были почти того же тёмного цвета, что и фон,
  // и модель выглядела как полупустая чёрная плоскость; добавили мягкий
  // верхний/боковой свет и подняли контраст материалов
  scene.add(new THREE.HemisphereLight(0x9fe8c9, 0x0a1410, 0.65));
  scene.add(new THREE.AmbientLight(0xffffff, 0.3));
  const sun = new THREE.DirectionalLight(0xcdeeff, 1.15);
  sun.position.set(6, 10, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 40;
  sun.shadow.camera.left = -12;
  sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 12;
  sun.shadow.camera.bottom = -12;
  sun.shadow.bias = -0.0015;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x45d9ff, 0.35);
  fill.position.set(-8, 4, -6);
  scene.add(fill);

  const WALL_EDGE_COLOR = 0x6df3b0;
  const WALL_FILL_COLOR = 0x35e08f;
  const FLOOR_COLOR = 0x1c4636;
  const GRID_COLOR = 0x2fbd86;

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
    const mat = new THREE.MeshStandardMaterial({ color: FLOOR_COLOR, roughness: 0.85, metalness: 0.05 });
    floorMesh = new THREE.Mesh(geo, mat);
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // стены — контур здания, вытянутый вверх (раньше для реального плана/адреса
    // стены не строились вовсе, и модель выглядела как плоская подложка вместо дома).
    // Делаем их полупрозрачными "стеклянными", а не только тонким проводом —
    // иначе на тёмном фоне контур почти не читается.
    const wallHeight = floorplan.levels
      ? Math.min(24, Math.max(2.4, floorplan.levels * 2.8))
      : 2.7;
    const wallGeo = new THREE.ExtrudeGeometry(shape, { depth: wallHeight, bevelEnabled: false });
    wallGeo.rotateX(Math.PI / 2);

    const wallMesh = new THREE.Mesh(wallGeo, new THREE.MeshStandardMaterial({
      color: WALL_FILL_COLOR, transparent: true, opacity: 0.14, roughness: 1, side: THREE.DoubleSide,
    }));
    wallMesh.position.y = wallHeight;
    scene.add(wallMesh);

    const wallEdges = new THREE.EdgesGeometry(wallGeo);
    const wallLines = new THREE.LineSegments(wallEdges, new THREE.LineBasicMaterial({ color: WALL_EDGE_COLOR }));
    wallLines.position.y = wallHeight;
    scene.add(wallLines);

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
    const mat = new THREE.MeshStandardMaterial({ color: FLOOR_COLOR, roughness: 0.85, metalness: 0.05 });
    floorMesh = new THREE.Mesh(geo, mat);
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // стены — тоже делаем полупрозрачными "стеклянными" коробками, а не
    // просто тонкой проволокой, которую было почти не видно на тёмном фоне
    const wallHeight = 2.7;
    const wallBoxGeo = new THREE.BoxGeometry(footprintSize, wallHeight, footprintSize);
    const wallMesh = new THREE.Mesh(wallBoxGeo, new THREE.MeshStandardMaterial({
      color: WALL_FILL_COLOR, transparent: true, opacity: 0.14, roughness: 1, side: THREE.DoubleSide,
    }));
    wallMesh.position.y = wallHeight / 2;
    scene.add(wallMesh);

    const edges = new THREE.EdgesGeometry(wallBoxGeo);
    const wallLines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: WALL_EDGE_COLOR }));
    wallLines.position.y = wallHeight / 2;
    scene.add(wallLines);
  }

  // лёгкая сетка на полу — даёт масштаб и глубину, иначе тёмный пол сливается с фоном
  const gridSize = Math.max(8, footprintSize * 1.6);
  const gridDivisions = Math.max(6, Math.round(gridSize / 1.2));
  const grid = new THREE.GridHelper(gridSize, gridDivisions, GRID_COLOR, GRID_COLOR);
  grid.position.y = -0.01;
  grid.material.transparent = true;
  grid.material.opacity = 0.12;
  scene.add(grid);

  // приборы — цветные кубики со "световым пятном" на полу под ними.
  // Раньше все приборы расставлялись по одному общему кругу на весь контур
  // здания, из-за чего, например, холодильник и стиральная машина одной
  // квартиры оказывались рядом друг с другом по кругу без всякой связи с тем,
  // в какой они на самом деле комнате. Если приборы привязаны к комнатам
  // (через панель "Комнаты и приборы"), делим контур на отдельные ячейки —
  // по одной на комнату — и внутри каждой ячейки расставляем только приборы
  // этой комнаты небольшим кластером.
  const deviceGroup = new THREE.Group();
  const devicePositions = twinComputeDevicePositions(twinState.devices, footprintSize);

  twinState.devices.forEach((dev, i) => {
    const { x: px, z: pz } = devicePositions[i];
    const size = 0.22 + Math.min(0.28, dev.watts / 6000);

    const geo = new THREE.BoxGeometry(size, size, size);
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(dev.color),
      emissive: new THREE.Color(dev.color),
      emissiveIntensity: dev.efficient ? 0.35 : 0.65,
      roughness: 0.4,
      metalness: 0.15,
    });
    const cube = new THREE.Mesh(geo, mat);
    cube.position.set(px, size / 2 + 0.06, pz);
    cube.castShadow = true;
    // сохраняем базовую яркость свечения, чтобы в цикле анимации плавно
    // "дышать" ею синусоидой — иначе приборы выглядят как статичная бижутерия,
    // а не как работающая техника
    cube.userData.baseEmissive = mat.emissiveIntensity;
    cube.userData.pulsePhase = Math.random() * Math.PI * 2;
    deviceGroup.add(cube);

    const glowGeo = new THREE.CircleGeometry(size * 1.5, 20);
    glowGeo.rotateX(-Math.PI / 2);
    const glowMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(dev.color), transparent: true, opacity: 0.22,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.set(px, 0.015, pz);
    deviceGroup.add(glow);
  });
  scene.add(deviceGroup);

  const camDist = footprintSize * 1.35 + 2;

  twinState.renderer = renderer;
  twinState.scene = scene;
  twinState.camera = camera;
  twinState.footprintSize = footprintSize;
  twinState.camDist = camDist;
  twinState.deviceGroup = deviceGroup;
  twinState.clock = new THREE.Clock();

  // "Кинематографичный" залёт камеры при появлении новой модели — начинаем
  // издалека и сверху и плавно подъезжаем к обычному ракурсу, вместо того
  // чтобы модель просто мгновенно появлялась целиком.
  twinState.rotY = twinState.targetRotY;
  twinState.rotX = Math.min(1.3, twinState.targetRotX + 0.35);
  twinState.zoom = 1.9;
  twinState.introT = 0;

  twinAttachDragControls(wrap);
  twinBindSceneToolbar();

  const animate = () => {
    twinState.raf = requestAnimationFrame(animate);
    const dt = Math.min(0.05, twinState.clock.getDelta());

    if (twinState.autoSpin && !twinState.dragging) twinState.targetRotY += dt * 0.25;

    // Плавное затухание (damping) — камера "догоняет" целевой угол/зум,
    // а не прыгает мгновенно к позиции мыши, как раньше. Так вращение
    // ощущается инерционным, как орбитальная камера в 3D-редакторах.
    const damp = 1 - Math.pow(0.0015, dt);
    twinState.rotY += (twinState.targetRotY - twinState.rotY) * damp;
    twinState.rotX += (twinState.targetRotX - twinState.rotX) * damp;
    twinState.zoom += (twinState.targetZoom - twinState.zoom) * damp;

    // Интро-залёт: первые ~1.1 сек после генерации плавно подтягиваем зум
    // к целевому значению по кривой ease-out, поверх обычного damping.
    if (twinState.introT < 1) {
      twinState.introT = Math.min(1, twinState.introT + dt / 1.1);
      const eased = 1 - Math.pow(1 - twinState.introT, 3);
      twinState.zoom = 1.9 + (twinState.targetZoom - 1.9) * eased;
    }

    const dist = camDist * twinState.zoom;
    twinState.camera.position.x = Math.cos(twinState.rotY) * dist * Math.cos(twinState.rotX);
    twinState.camera.position.z = Math.sin(twinState.rotY) * dist * Math.cos(twinState.rotX);
    twinState.camera.position.y = Math.max(1.5, dist * Math.sin(twinState.rotX) + dist * 0.5);
    twinState.camera.lookAt(0, 0, 0);

    // "Дыхание" индикаторов приборов — мягкая синусоида яркости свечения,
    // у энергоёмких приборов чуть заметнее, чем у эффективных.
    const t = performance.now() / 1000;
    deviceGroup.children.forEach((child) => {
      if (child.userData && child.userData.baseEmissive != null) {
        const wave = 0.15 * Math.sin(t * 1.6 + child.userData.pulsePhase);
        child.material.emissiveIntensity = Math.max(0.05, child.userData.baseEmissive + wave);
      }
    });

    renderer.render(scene, camera);
  };
  animate();
}

function twinBindSceneToolbar() {
  const toolbar = document.getElementById('twin-scene-toolbar');
  if (toolbar) toolbar.hidden = false;

  const resetBtn = document.getElementById('twin-view-reset-btn');
  if (resetBtn && !resetBtn.dataset.bound) {
    resetBtn.dataset.bound = '1';
    resetBtn.addEventListener('click', () => {
      twinState.targetRotY = 0.6;
      twinState.targetRotX = 0.5;
      twinState.targetZoom = 1;
    });
  }

  const spinBtn = document.getElementById('twin-view-spin-btn');
  if (spinBtn && !spinBtn.dataset.bound) {
    spinBtn.dataset.bound = '1';
    spinBtn.addEventListener('click', () => {
      twinState.autoSpin = !twinState.autoSpin;
      spinBtn.classList.toggle('is-active', twinState.autoSpin);
      spinBtn.textContent = twinState.autoSpin ? '⏸ Стоп' : '▶ Вращать';
    });
  }
}

function twinAttachDragControls(wrap) {
  const canvas = wrap.querySelector('canvas');
  if (!canvas) return;

  const ZOOM_MIN = 0.4;
  const ZOOM_MAX = 3;

  // Крутим/зумим "цель" (targetRotX/Y/Zoom), а не сам угол камеры напрямую —
  // цикл animate() в twinBuildScene сам плавно догоняет цель с затуханием,
  // поэтому вращение и зум ощущаются инерционными, а не дёрганными.
  const onDown = (x, y) => {
    twinState.dragging = true;
    twinState.autoSpin = false;
    const spinBtn = document.getElementById('twin-view-spin-btn');
    if (spinBtn) { spinBtn.classList.remove('is-active'); spinBtn.textContent = '▶ Вращать'; }
    twinState.lastX = x; twinState.lastY = y;
  };
  const onMove = (x, y) => {
    if (!twinState.dragging) return;
    twinState.targetRotY += (x - twinState.lastX) * 0.008;
    twinState.targetRotX = Math.max(0.15, Math.min(1.3, twinState.targetRotX + (y - twinState.lastY) * -0.006));
    twinState.lastX = x; twinState.lastY = y;
  };
  const onUp = () => { twinState.dragging = false; };
  const onZoom = (delta) => {
    twinState.targetZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, twinState.targetZoom + delta));
  };

  canvas.addEventListener('mousedown', (e) => onDown(e.clientX, e.clientY));
  window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
  window.addEventListener('mouseup', onUp);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    onZoom(e.deltaY * 0.001);
  }, { passive: false });

  let pinchStartDist = null;
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      const [a, b] = e.touches;
      pinchStartDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    } else {
      const t = e.touches[0]; onDown(t.clientX, t.clientY);
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && pinchStartDist != null) {
      const [a, b] = e.touches;
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      onZoom((pinchStartDist - dist) * 0.006);
      pinchStartDist = dist;
    } else {
      const t = e.touches[0]; onMove(t.clientX, t.clientY);
    }
  }, { passive: true });
  canvas.addEventListener('touchend', () => { onUp(); pinchStartDist = null; });
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

function twinRenderOfflineScene(areaM2) {
  const wrap = document.getElementById('twin-scene-wrap');
  if (!wrap) return;
  wrap.innerHTML = '';
  const scene = document.createElement('div');
  scene.className = 'twin-offline-scene';
  const title = document.createElement('div');
  title.className = 'twin-offline-title';
  title.textContent = `Схема помещения · ${Math.round(areaM2)} м²`;
  const note = document.createElement('div');
  note.className = 'twin-offline-note';
  note.textContent = 'Локальный режим: приборы и расчёт экономии работают без загрузки 3D-движка.';
  const grid = document.createElement('div');
  grid.className = 'twin-offline-grid';
  twinState.devices.forEach((device) => {
    const item = document.createElement('div');
    item.className = 'twin-offline-device';
    item.style.setProperty('--device-color', device.color);
    item.textContent = device.name.replace(/ ×\d+$/, '');
    grid.appendChild(item);
  });
  scene.append(title, note, grid);
  wrap.appendChild(scene);
}

// ---------- главная точка входа ----------
function twinGenerate() {
  const wrap = document.getElementById('twin-scene-wrap');
  if (!wrap) return;

  twinFlushPendingDevices();
  const roomDevices = twinBuildDevicesFromRooms();

  if (twinHasRoomSetup() && roomDevices.length === 0) {
    twinSetGenerateStatus(
      'Заполните название прибора и нажмите «+ Добавить прибор» (или оставьте поле с названием — оно подхватится при генерации, если указаны Вт и часы).',
      'warn',
    );
    return;
  }

  twinSetGenerateStatus(
    roomDevices.length
      ? `Модель по вашим комнатам: ${roomDevices.length} прибор(ов).`
      : 'Типовой набор приборов — комнаты не заполнены.',
  );

  if (typeof THREE === 'undefined') {
    const type = document.getElementById('twin-type').value;
    const areaM2 = Math.max(6, Number(document.getElementById('twin-area').value) || 60);
    const units = Math.max(1, Number(document.getElementById('twin-units').value) || 1);
    twinState.devices = roomDevices.length ? roomDevices : twinBuildDevices(type, areaM2, units);
    twinDisposeScene();
    twinRenderOfflineScene(areaM2);
    twinRenderDeviceList();
    twinRecalcTotals();
    return;
  }

  const type = document.getElementById('twin-type').value;
  const areaM2 = Math.max(6, Number(document.getElementById('twin-area').value) || 60);
  const units = Math.max(1, Number(document.getElementById('twin-units').value) || 1);

  twinState.devices = roomDevices.length ? roomDevices : twinBuildDevices(type, areaM2, units);

  twinDisposeScene();
  wrap.innerHTML = '';
  twinBuildScene(areaM2);

  twinRenderDeviceList();
  twinRecalcTotals();
}

document.addEventListener('DOMContentLoaded', twinInit);
