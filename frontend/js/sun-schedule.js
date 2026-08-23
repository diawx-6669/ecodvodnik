// ===================== Свет по солнцу =====================
// Считает положение Солнца по координатам комнаты (отмеченной на карте)
// и строит суточное расписание «нужен ли искусственный свет» с учётом
// стороны, куда выходит окно.
//
// Координаты задаются кликом на интерактивной карте (Leaflet + OpenStreetMap).
// Адрес и часовой пояс подтягиваются автоматически по выбранной точке.

const SUN_ROOMS_KEY = 'ecodvoinik_sun_rooms';
const SUN_DEFAULT_CENTER = [43.238949, 76.945465]; // Алматы — стартовый центр карты

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

const WINDOW_HALF_ANGLE = 70;

const sunState = { rooms: [], maps: new Map(), markers: new Map() };

function sunInit() {
  const addBtn = document.getElementById('sun-add-room-btn');
  if (!addBtn) return;

  sunState.rooms = sunLoadRooms();
  addBtn.addEventListener('click', () => {
    sunState.rooms.push(sunNewRoom());
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
    locationLabel: '',
    tzOffset: -new Date().getTimezoneOffset() / 60,
    direction: 180,
  };
}

function sunLoadRooms() {
  try {
    const raw = localStorage.getItem(SUN_ROOMS_KEY);
    const rooms = raw ? JSON.parse(raw) : [];
    return rooms.map((room) => ({
      ...sunNewRoom(),
      ...room,
      id: room.id || `room-${Date.now()}`,
    }));
  } catch (e) {
    return [];
  }
}

function sunSaveRooms() {
  try {
    localStorage.setItem(SUN_ROOMS_KEY, JSON.stringify(sunState.rooms));
  } catch (e) { /* хранилище недоступно */ }
}

function sunDestroyRoomMap(roomId) {
  const map = sunState.maps.get(roomId);
  if (map) {
    map.remove();
    sunState.maps.delete(roomId);
  }
  sunState.markers.delete(roomId);
}

function sunDestroyAllMaps() {
  sunState.maps.forEach((map) => map.remove());
  sunState.maps.clear();
  sunState.markers.clear();
}

function sunTileUrl() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  return isLight
    ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
}

function sunTileAttribution() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  return isLight
    ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';
}

async function sunReverseGeocode(room, statusEl) {
  statusEl.textContent = 'Определяю адрес по точке на карте…';
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${room.lat}&lon=${room.lon}&zoom=18&addressdetails=1`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await res.json();
    const addr = data.address || {};
    const shortLabel = [addr.road, addr.house_number, addr.city || addr.town || addr.village, addr.country]
      .filter(Boolean)
      .join(', ');
    room.locationLabel = shortLabel || data.display_name || `${room.lat.toFixed(4)}, ${room.lon.toFixed(4)}`;
    statusEl.textContent = `Точка: ${room.locationLabel}`;
  } catch (e) {
    room.locationLabel = `${room.lat.toFixed(4)}, ${room.lon.toFixed(4)}`;
    statusEl.textContent = `Координаты: ${room.locationLabel}`;
  }
}

async function sunUpdateTimezone(room) {
  try {
    const res = await fetch(
      `https://timeapi.io/api/TimeZone/coordinate?latitude=${room.lat}&longitude=${room.lon}`,
    );
    if (!res.ok) throw new Error('timezone api');
    const data = await res.json();
    if (data.currentUtcOffset && typeof data.currentUtcOffset.hours === 'number') {
      room.tzOffset = data.currentUtcOffset.hours;
      return;
    }
  } catch (e) { /* fallback ниже */ }
  room.tzOffset = Math.max(-12, Math.min(14, Math.round(room.lon / 15)));
}

async function sunSetRoomLocation(room, lat, lon, statusEl, card, dateStr) {
  room.lat = lat;
  room.lon = lon;
  await sunReverseGeocode(room, statusEl);
  await sunUpdateTimezone(room);
  sunSaveRooms();
  sunRenderRoomBody(card, room, dateStr);
}

function sunInitRoomMap(room, mapEl, statusEl, card, dateStr) {
  if (typeof L === 'undefined') {
    statusEl.textContent = 'Карта не загрузилась — проверьте подключение к интернету.';
    return;
  }

  sunDestroyRoomMap(room.id);

  const hasPoint = room.lat != null && room.lon != null && !Number.isNaN(room.lat);
  const center = hasPoint ? [room.lat, room.lon] : SUN_DEFAULT_CENTER;
  const zoom = hasPoint ? 16 : 11;

  const map = L.map(mapEl, {
    scrollWheelZoom: true,
    zoomControl: true,
  }).setView(center, zoom);

  L.tileLayer(sunTileUrl(), {
    maxZoom: 19,
    attribution: sunTileAttribution(),
  }).addTo(map);

  let marker = null;
  if (hasPoint) {
    marker = L.marker([room.lat, room.lon], { draggable: true }).addTo(map);
    marker.on('dragend', async () => {
      const { lat, lng } = marker.getLatLng();
      await sunSetRoomLocation(room, lat, lng, statusEl, card, dateStr);
      sunUpdateMarker(room.id, lat, lng);
    });
    sunState.markers.set(room.id, marker);
  }

  map.on('click', async (event) => {
    const { lat, lng } = event.latlng;
    if (marker) marker.setLatLng(event.latlng);
    else {
      marker = L.marker(event.latlng, { draggable: true }).addTo(map);
      marker.on('dragend', async () => {
        const pos = marker.getLatLng();
        await sunSetRoomLocation(room, pos.lat, pos.lng, statusEl, card, dateStr);
        sunUpdateMarker(room.id, pos.lat, pos.lng);
      });
      sunState.markers.set(room.id, marker);
    }
    await sunSetRoomLocation(room, lat, lng, statusEl, card, dateStr);
  });

  sunState.maps.set(room.id, map);
  requestAnimationFrame(() => map.invalidateSize());
}

function sunUpdateMarker(roomId, lat, lon) {
  const marker = sunState.markers.get(roomId);
  if (marker) marker.setLatLng([lat, lon]);
  const map = sunState.maps.get(roomId);
  if (map) map.panTo([lat, lon]);
}

function sunPosition(dayOfYear, timeMinutesUTC, latDeg, lonDeg) {
  const rad = Math.PI / 180;
  const gamma = (2 * Math.PI / 365) * (dayOfYear - 1 + (timeMinutesUTC - 720) / 1440);

  const decl = 0.006918
    - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma)
    - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma)
    - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);

  const eqTime = 229.18 * (
    0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma)
    - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma)
  );

  const timeOffset = eqTime + 4 * lonDeg;
  const trueSolarTime = ((timeMinutesUTC + timeOffset) % 1440 + 1440) % 1440;
  const hourAngleDeg = trueSolarTime / 4 - 180;
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

function sunBuildSchedule(room, dateStr) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const dayOfYear = Math.ceil((start - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86400000);

  const slots = [];
  for (let localMin = 0; localMin < 1440; localMin += 30) {
    const utcMin = localMin - room.tzOffset * 60;
    const { altitude, azimuth } = sunPosition(dayOfYear, ((utcMin % 1440) + 1440) % 1440, room.lat, room.lon);

    let state;
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

function sunDirectionLabel(value) {
  return SUN_DIRECTIONS.find((d) => d.value === value)?.label || `${value}°`;
}

function sunRecommendation(room, groups) {
  const needLight = groups.filter((g) => g.state === 'dark');
  const directLight = groups.filter((g) => g.state === 'direct');
  const place = room.locationLabel || 'выбранной точке';

  if (!needLight.length) {
    return `AI-прогноз для «${room.name}» (${place}): весь день достаточно естественного света — искусственный свет не нужен. Окно смотрит ${sunDirectionLabel(room.direction).toLowerCase()}.`;
  }

  const lightParts = needLight.map((g) => `${sunFormatTime(g.startMin)}–${sunFormatTime(g.endMin === 1440 ? 1439 : g.endMin)}`);
  const directParts = directLight.map((g) => `${sunFormatTime(g.startMin)}–${sunFormatTime(g.endMin === 1440 ? 1439 : g.endMin)}`);

  let text = `AI-прогноз для «${room.name}» (${place}, UTC${room.tzOffset >= 0 ? '+' : ''}${room.tzOffset}): включайте свет ${lightParts.join(', ')}.`;

  if (directParts.length) {
    text += ` Прямой солнечный свет в комнату попадает ${directParts.join(', ')} — в эти часы свет можно не включать.`;
  } else {
    text += ' Прямого солнечного света в комнату почти не будет — ориентируйтесь на рассеянный дневной свет днём.';
  }

  return text;
}

function sunRenderRooms() {
  const list = document.getElementById('sun-room-list');
  const empty = document.getElementById('sun-empty');
  if (!list) return;

  sunDestroyAllMaps();
  list.innerHTML = '';
  if (empty) empty.classList.toggle('hidden', sunState.rooms.length > 0);

  const dateInput = document.getElementById('sun-date');
  const dateStr = (dateInput && dateInput.value) || new Date().toISOString().slice(0, 10);

  sunState.rooms.forEach((room) => {
    const card = sunRenderRoomCard(room, dateStr);
    list.appendChild(card);
  });
}

function sunRenderRoomCard(room, dateStr) {
  const card = document.createElement('div');
  card.className = 'sun-room-card';

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
    sunDestroyRoomMap(room.id);
    sunState.rooms = sunState.rooms.filter((r) => r.id !== room.id);
    sunSaveRooms();
    sunRenderRooms();
  });

  head.appendChild(nameInput);
  head.appendChild(delBtn);
  card.appendChild(head);

  const mapSection = document.createElement('div');
  mapSection.className = 'sun-map-section';

  const mapTitle = document.createElement('div');
  mapTitle.className = 'sun-map-title';
  mapTitle.textContent = 'Где находится комната';

  const mapHint = document.createElement('p');
  mapHint.className = 'sun-map-hint';
  mapHint.textContent = 'Кликните на карте или перетащите маркер — AI получит координаты и построит прогноз освещения.';

  const mapWrap = document.createElement('div');
  mapWrap.className = 'sun-map-wrap';
  const mapEl = document.createElement('div');
  mapEl.className = 'sun-map';
  mapEl.id = `sun-map-${room.id}`;
  mapWrap.appendChild(mapEl);

  const mapControls = document.createElement('div');
  mapControls.className = 'sun-map-controls';

  const geoBtn = document.createElement('button');
  geoBtn.type = 'button';
  geoBtn.className = 'sun-btn';
  geoBtn.textContent = 'Моё местоположение';
  geoBtn.addEventListener('click', () => {
    if (!navigator.geolocation) return;
    geoBtn.disabled = true;
    geoBtn.textContent = 'Определяю…';
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await sunSetRoomLocation(room, pos.coords.latitude, pos.coords.longitude, geoStatus, card, dateStr);
        sunUpdateMarker(room.id, room.lat, room.lon);
        geoBtn.disabled = false;
        geoBtn.textContent = 'Моё местоположение';
      },
      () => {
        geoStatus.textContent = 'Не удалось определить GPS — отметьте точку на карте вручную.';
        geoBtn.disabled = false;
        geoBtn.textContent = 'Моё местоположение';
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  });

  const geoStatus = document.createElement('div');
  geoStatus.className = 'sun-geo-status';
  geoStatus.textContent = room.lat != null
    ? (room.locationLabel ? `Точка: ${room.locationLabel}` : `Координаты: ${room.lat.toFixed(4)}, ${room.lon.toFixed(4)}`)
    : 'Точка на карте не выбрана — кликните по зданию или аудитории.';

  mapControls.appendChild(geoBtn);
  mapControls.appendChild(geoStatus);

  mapSection.appendChild(mapTitle);
  mapSection.appendChild(mapHint);
  mapSection.appendChild(mapWrap);
  mapSection.appendChild(mapControls);
  card.appendChild(mapSection);

  const fields = document.createElement('div');
  fields.className = 'sun-room-fields sun-room-fields-compact';

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

  const tzInfo = document.createElement('div');
  tzInfo.className = 'sun-tz-info';
  tzInfo.textContent = room.lat != null
    ? `Часовой пояс: UTC${room.tzOffset >= 0 ? '+' : ''}${room.tzOffset} (определён автоматически)`
    : 'Часовой пояс определится после выбора точки на карте.';

  fields.appendChild(dirWrap);
  fields.appendChild(tzInfo);
  card.appendChild(fields);

  const body = document.createElement('div');
  body.className = 'sun-room-body';
  card.appendChild(body);

  requestAnimationFrame(() => sunInitRoomMap(room, mapEl, geoStatus, card, dateStr));
  sunRenderRoomBody(card, room, dateStr);

  return card;
}

function sunRenderRoomBody(card, room, dateStr) {
  const body = card.querySelector('.sun-room-body');
  const tzInfo = card.querySelector('.sun-tz-info');
  if (tzInfo && room.lat != null) {
    tzInfo.textContent = `Часовой пояс: UTC${room.tzOffset >= 0 ? '+' : ''}${room.tzOffset} (определён автоматически)`;
  }
  body.innerHTML = '';

  if (room.lat == null || room.lon == null || Number.isNaN(room.lat) || Number.isNaN(room.lon)) {
    const msg = document.createElement('div');
    msg.className = 'sun-hint';
    msg.textContent = 'Отметьте комнату на карте выше — после этого AI построит прогноз освещения на выбранную дату.';
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
  rec.textContent = sunRecommendation(room, groups);
  body.appendChild(rec);
}

function sunStateLabel(state) {
  if (state === 'direct') return 'прямой солнечный свет';
  if (state === 'daylight') return 'рассеянный дневной свет';
  return 'темно, нужен искусственный свет';
}

document.addEventListener('DOMContentLoaded', sunInit);
