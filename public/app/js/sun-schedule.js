// ===================== Свет по солнцу =====================
// Считает положение Солнца (высоту и азимут) по географическим координатам
// комнаты и строит суточное расписание "нужен ли искусственный свет" с
// учётом стороны, куда выходит окно комнаты.
//
// Формулы — стандартный низкоточный алгоритм солнечной позиции (склонение
// и уравнение времени по рядам Спенсера, часовой угол/высота/азимут по
// сферической тригонометрии), общеизвестная астрономическая математика,
// работающая полностью офлайн. Координаты комнаты берутся либо с точки,
// уже отмеченной на карте выше (address-map.js), либо вводятся вручную —
// текстовый поиск адреса здесь намеренно не используется, чтобы не зависеть
// от стороннего сервиса геокодирования.

const SUN_ROOMS_KEY = 'ecodvoinik_sun_rooms';

const SUN_DIRECTIONS = [
  { value: 0, label: 'С (север)' },
  { value: 45, label: 'СВ (северо-восток)' },
  { value: 90, label: 'В (восток)' },
  { value: 135, label: 'ЮВ (юго-восток)' },
  { value: 180, label: 'Ю (юг)' },
  { value: 225, label: 'ЮЗ (юго-запад)' },
  { value: 270, label: 'З (запад)' },
  { value: 315, label: 'СЗ (северо-запад)' },
];

// Насколько широко "видит" окно вокруг своего азимута (типичный угол обзора окна)
const WINDOW_HALF_ANGLE = 70;

const sunState = { rooms: [] };

function sunInit() {
  const addBtn = document.getElementById('sun-add-room-btn');
  if (!addBtn) return; // блока нет в DOM

  sunState.rooms = sunLoadRooms();
  addBtn.addEventListener('click', () => {
    const room = sunNewRoom();
    // если пользователь уже отметил дом на карте выше — сразу подставляем
    // его координаты, чтобы не искать адрес заново
    if (window.amState && window.amState.lat != null && window.amState.lon != null) {
      room.lat = window.amState.lat;
      room.lon = window.amState.lon;
    }
    sunState.rooms.push(room);
    sunSaveRooms();
    sunRenderRooms();
  });

  const dateInput = document.getElementById('sun-date');
  if (dateInput) {
    dateInput.value = new Date().toISOString().slice(0, 10);
    dateInput.addEventListener('change', sunRenderRooms);
  }

  sunRenderRooms();
}

function sunNewRoom() {
  return {
    id: `room-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: `Комната ${sunState.rooms.length + 1}`,
    lat: null,
    lon: null,
    tzOffset: -new Date().getTimezoneOffset() / 60,
    direction: 180,
  };
}

function sunLoadRooms() {
  try {
    const raw = localStorage.getItem(SUN_ROOMS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function sunSaveRooms() {
  try {
    localStorage.setItem(SUN_ROOMS_KEY, JSON.stringify(sunState.rooms));
  } catch (e) { /* хранилище недоступно — просто не сохраняем */ }
}

// ---------- взять координаты из точки, отмеченной на карте выше (address-map.js) ----------
function sunUseMapPoint(room, statusEl) {
  if (!window.amState || window.amState.lat == null || window.amState.lon == null) {
    statusEl.textContent = 'На карте выше пока не отмечена точка — кликните по ней или введите широту/долготу вручную ниже.';
    return;
  }
  room.lat = window.amState.lat;
  room.lon = window.amState.lon;
  sunSaveRooms();
  statusEl.textContent = `Координаты взяты с карты: ${room.lat.toFixed(4)}, ${room.lon.toFixed(4)}`;
  sunRenderRooms();
}

// ---------- солнечная позиция ----------
// dayOfYear: 1..366; timeMinutesUTC: минуты от полуночи UTC; lat/lon в градусах
function sunPosition(dayOfYear, timeMinutesUTC, latDeg, lonDeg) {
  const rad = Math.PI / 180;
  const gamma = (2 * Math.PI / 365) * (dayOfYear - 1 + (timeMinutesUTC - 720) / 1440);

  // склонение Солнца (радианы) — ряд Спенсера
  const decl = 0.006918
    - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma)
    - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma)
    - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);

  // уравнение времени (минуты)
  const eqTime = 229.18 * (
    0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma)
    - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma)
  );

  const timeOffset = eqTime + 4 * lonDeg; // минуты, относительно UTC
  const trueSolarTime = ((timeMinutesUTC + timeOffset) % 1440 + 1440) % 1440;
  const hourAngleDeg = trueSolarTime / 4 - 180; // -180..180
  const hourAngle = hourAngleDeg * rad;

  const lat = latDeg * rad;
  const cosZenith = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(hourAngle);
  const zenith = Math.acos(Math.max(-1, Math.min(1, cosZenith)));
  const altitude = 90 - zenith / rad;

  let cosAz = -(Math.sin(lat) * Math.cos(zenith) - Math.sin(decl)) / (Math.cos(lat) * Math.sin(zenith) || 1e-9);
  cosAz = Math.max(-1, Math.min(1, cosAz));
  let azimuth = Math.acos(cosAz) / rad;
  if (hourAngleDeg > 0) azimuth = 360 - azimuth;

  return { altitude, azimuth };
}

function sunAngleDiff(a, b) {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

// Строит расписание на сутки с шагом 30 минут (локальное время комнаты по её часовому поясу)
function sunBuildSchedule(room, dateStr) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const dayOfYear = Math.ceil((start - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86400000);

  const slots = [];
  for (let localMin = 0; localMin < 1440; localMin += 30) {
    const utcMin = localMin - room.tzOffset * 60;
    const { altitude, azimuth } = sunPosition(dayOfYear, ((utcMin % 1440) + 1440) % 1440, room.lat, room.lon);

    let state; // 'direct' | 'daylight' | 'dark'
    if (altitude <= 0) {
      state = 'dark';
    } else if (sunAngleDiff(azimuth, room.direction) <= WINDOW_HALF_ANGLE) {
      state = 'direct';
    } else {
      state = 'daylight';
    }
    slots.push({ localMin, state, altitude, azimuth });
  }
  return slots;
}

function sunFormatTime(min) {
  const h = Math.floor(min / 60).toString().padStart(2, '0');
  const m = (min % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

// Группирует слоты в непрерывные интервалы одного состояния
function sunGroupSlots(slots) {
  const groups = [];
  slots.forEach((s) => {
    const last = groups[groups.length - 1];
    if (last && last.state === s.state) {
      last.endMin = s.localMin + 30;
    } else {
      groups.push({ state: s.state, startMin: s.localMin, endMin: s.localMin + 30 });
    }
  });
  return groups;
}

function sunRecommendation(groups) {
  const needLight = groups.filter((g) => g.state === 'dark');
  if (!needLight.length) return 'По расчёту для этой комнаты весь день достаточно естественного света.';
  const parts = needLight.map((g) => `${sunFormatTime(g.startMin)}–${sunFormatTime(g.endMin === 1440 ? 1439 : g.endMin)}`);
  return `Рекомендуется включать свет: ${parts.join(', ')}. В остальное время окно получает дневной свет.`;
}

// ---------- рендер ----------
function sunRenderRooms() {
  const list = document.getElementById('sun-room-list');
  const empty = document.getElementById('sun-empty');
  if (!list) return;

  list.innerHTML = '';
  if (empty) empty.classList.toggle('hidden', sunState.rooms.length > 0);

  const dateInput = document.getElementById('sun-date');
  const dateStr = (dateInput && dateInput.value) || new Date().toISOString().slice(0, 10);

  sunState.rooms.forEach((room) => list.appendChild(sunRenderRoomCard(room, dateStr)));
}

function sunRenderRoomCard(room, dateStr) {
  const card = document.createElement('div');
  card.className = 'sun-room-card';

  // ---- шапка: название + удалить ----
  const head = document.createElement('div');
  head.className = 'sun-room-head';
  const nameInput = document.createElement('input');
  nameInput.className = 'sun-room-name';
  nameInput.value = room.name;
  nameInput.addEventListener('input', () => { room.name = nameInput.value; sunSaveRooms(); });

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'sun-del-btn';
  delBtn.textContent = 'Удалить';
  delBtn.addEventListener('click', () => {
    sunState.rooms = sunState.rooms.filter((r) => r.id !== room.id);
    sunSaveRooms();
    sunRenderRooms();
  });

  head.appendChild(nameInput);
  head.appendChild(delBtn);
  card.appendChild(head);

  // ---- поля: координаты / часовой пояс / сторона окна ----
  const fields = document.createElement('div');
  fields.className = 'sun-room-fields';

  const geoStatus = document.createElement('div');
  geoStatus.className = 'sun-geo-status';
  geoStatus.textContent = room.lat != null
    ? `Координаты: ${room.lat.toFixed(4)}, ${room.lon.toFixed(4)}`
    : 'Координаты не заданы.';

  const geoBtn = document.createElement('button');
  geoBtn.type = 'button';
  geoBtn.className = 'sun-btn';
  geoBtn.textContent = 'Взять точку с карты выше';
  geoBtn.addEventListener('click', () => sunUseMapPoint(room, geoStatus));

  const latInput = sunMakeField('Широта', room.lat != null ? room.lat : '', (v) => {
    room.lat = v === '' ? null : Number(v);
    sunSaveRooms();
    sunRenderRoomBody(card, room, dateStr);
  }, 'number');
  const lonInput = sunMakeField('Долгота', room.lon != null ? room.lon : '', (v) => {
    room.lon = v === '' ? null : Number(v);
    sunSaveRooms();
    sunRenderRoomBody(card, room, dateStr);
  }, 'number');

  const tzInput = sunMakeField('Часовой пояс (UTC+)', room.tzOffset, (v) => {
    room.tzOffset = v === '' ? 0 : Number(v);
    sunSaveRooms();
    sunRenderRoomBody(card, room, dateStr);
  }, 'number');

  const dirWrap = document.createElement('label');
  dirWrap.className = 'sun-field';
  const dirTitle = document.createElement('span');
  dirTitle.textContent = 'Куда выходит окно';
  const dirSelect = document.createElement('select');
  SUN_DIRECTIONS.forEach((d) => {
    const opt = document.createElement('option');
    opt.value = d.value;
    opt.textContent = d.label;
    if (d.value === room.direction) opt.selected = true;
    dirSelect.appendChild(opt);
  });
  dirSelect.addEventListener('change', () => {
    room.direction = Number(dirSelect.value);
    sunSaveRooms();
    sunRenderRoomBody(card, room, dateStr);
  });
  dirWrap.appendChild(dirTitle);
  dirWrap.appendChild(dirSelect);

  fields.appendChild(geoBtn);
  fields.appendChild(geoStatus);
  fields.appendChild(latInput);
  fields.appendChild(lonInput);
  fields.appendChild(tzInput);
  fields.appendChild(dirWrap);
  card.appendChild(fields);

  // ---- тело: таймлайн + рекомендация ----
  const body = document.createElement('div');
  body.className = 'sun-room-body';
  card.appendChild(body);
  sunRenderRoomBody(card, room, dateStr);

  return card;
}

function sunMakeField(labelText, value, onChange, type = 'text') {
  const wrap = document.createElement('label');
  wrap.className = 'sun-field';
  const span = document.createElement('span');
  span.textContent = labelText;
  const input = document.createElement('input');
  input.type = type;
  if (type === 'number') input.step = 'any';
  input.value = value;
  input.addEventListener('change', () => onChange(input.value));
  wrap.appendChild(span);
  wrap.appendChild(input);
  return wrap;
}

function sunRenderRoomBody(card, room, dateStr) {
  const body = card.querySelector('.sun-room-body');
  body.innerHTML = '';

  if (room.lat == null || room.lon == null || Number.isNaN(room.lat) || Number.isNaN(room.lon)) {
    const msg = document.createElement('div');
    msg.className = 'sun-hint';
    msg.textContent = 'Укажите координаты — нажмите «Взять точку с карты выше» (если уже отметили дом на карте) или впишите широту/долготу вручную, чтобы построить график.';
    body.appendChild(msg);
    return;
  }

  const slots = sunBuildSchedule(room, dateStr);
  const groups = sunGroupSlots(slots);

  const timeline = document.createElement('div');
  timeline.className = 'sun-timeline';
  groups.forEach((g) => {
    const seg = document.createElement('div');
    seg.className = `sun-seg sun-seg-${g.state}`;
    seg.style.flexGrow = String(g.endMin - g.startMin);
    seg.title = `${sunFormatTime(g.startMin)}–${sunFormatTime(g.endMin === 1440 ? 1439 : g.endMin)}: ${sunStateLabel(g.state)}`;
    timeline.appendChild(seg);
  });
  body.appendChild(timeline);

  const legend = document.createElement('div');
  legend.className = 'sun-legend';
  legend.innerHTML = `
    <span><i class="sun-dot sun-seg-direct"></i>прямой свет — свет можно не включать</span>
    <span><i class="sun-dot sun-seg-daylight"></i>рассеянный дневной свет — обычно хватает</span>
    <span><i class="sun-dot sun-seg-dark"></i>темно — нужен свет</span>
  `;
  body.appendChild(legend);

  const rec = document.createElement('div');
  rec.className = 'sun-recommendation';
  rec.textContent = sunRecommendation(groups);
  body.appendChild(rec);
}

function sunStateLabel(state) {
  if (state === 'direct') return 'прямой солнечный свет';
  if (state === 'daylight') return 'рассеянный дневной свет';
  return 'темно, нужен искусственный свет';
}

document.addEventListener('DOMContentLoaded', sunInit);
