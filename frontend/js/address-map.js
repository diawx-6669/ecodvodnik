// ===================== Адрес на карте мира → контур дома для 3D =====================
// Даёт пользователю выбрать реальный дом: поиском адреса (Nominatim) или кликом/
// перетаскиванием метки по карте мира (Leaflet + тайлы OpenStreetMap). После выбора
// точки ищет контур здания в этой точке через Overpass API (тоже данные OSM) и
// подставляет его в window.EcotchiFloorplan — в том же формате, что и ручной план
// помещения (см. floorplan.js), поэтому 3D-двойник (twin.js) строит модель по
// настоящей форме дома вместо обобщённого прямоугольника.

const amState = {
  map: null,
  marker: null,
  lat: null,
  lon: null,
  address: '',
};

const AM_DEFAULT_VIEW = { lat: 20, lon: 10, zoom: 2 };

function amInit() {
  const mapEl = document.getElementById('am-map');
  if (!mapEl) return; // блока нет в DOM
  if (typeof L === 'undefined') {
    amSetStatus('Не удалось загрузить карту (Leaflet). Проверьте интернет и обновите страницу.', 'error');
    return;
  }

  const map = L.map(mapEl, { worldCopyJump: true }).setView([AM_DEFAULT_VIEW.lat, AM_DEFAULT_VIEW.lon], AM_DEFAULT_VIEW.zoom);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 20,
    subdomains: 'abcd',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  }).addTo(map);

  map.on('click', (e) => amSetPoint(e.latlng.lat, e.latlng.lng, { reverseGeocode: true, recenter: false }));

  amState.map = map;

  const searchBtn = document.getElementById('am-search-btn');
  const addressInput = document.getElementById('am-address-input');
  if (searchBtn) searchBtn.addEventListener('click', amSearchAddress);
  if (addressInput) {
    addressInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); amSearchAddress(); }
    });
  }

  const useBtn = document.getElementById('am-use-btn');
  if (useBtn) useBtn.addEventListener('click', amUseBuilding);

  const clearBtn = document.getElementById('am-clear-btn');
  if (clearBtn) clearBtn.addEventListener('click', amClear);

  // Карта может инициализироваться раньше, чем контейнер получит итоговые
  // размеры (шрифты/картинки ещё грузятся) — без этого тайлы иногда рисуются
  // только в углу контейнера.
  window.addEventListener('load', () => map.invalidateSize());
  setTimeout(() => map.invalidateSize(), 300);
}

function amSetStatus(text, kind) {
  const el = document.getElementById('am-status');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('am-status-error', 'am-status-ok');
  if (kind === 'error') el.classList.add('am-status-error');
  if (kind === 'ok') el.classList.add('am-status-ok');
}

// ---------- поиск адреса текстом (Nominatim) ----------
async function amSearchAddress() {
  const input = document.getElementById('am-address-input');
  const query = input ? input.value.trim() : '';
  if (!query) {
    amSetStatus('Введите адрес, чтобы найти его на карте.', 'error');
    return;
  }

  amSetStatus('Ищу адрес…');
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await res.json();
    if (!data || !data.length) {
      amSetStatus('Не удалось найти такой адрес. Попробуйте указать точнее (город, улица, номер дома) или отметьте дом на карте вручную.', 'error');
      return;
    }
    const lat = Number(data[0].lat);
    const lon = Number(data[0].lon);
    amState.address = data[0].display_name;
    amSetPoint(lat, lon, { reverseGeocode: false, recenter: true, zoom: 18 });
    amSetStatus(`Найдено: ${data[0].display_name}. Теперь нажмите «Построить 3D по этому зданию» — контур попробуем взять из OpenStreetMap.`, 'ok');
  } catch (e) {
    amSetStatus('Не удалось обратиться к сервису геокодирования (нет сети?). Отметьте дом на карте вручную.', 'error');
  }
}

// ---------- обратное геокодирование по клику/перетаскиванию метки ----------
async function amReverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await res.json();
    amState.address = (data && data.display_name) || '';
    const input = document.getElementById('am-address-input');
    if (input && amState.address) input.value = amState.address;
    amSetStatus(amState.address
      ? `Точка отмечена: ${amState.address}. Нажмите «Построить 3D по этому зданию».`
      : 'Точка отмечена на карте. Нажмите «Построить 3D по этому зданию».', 'ok');
  } catch (e) {
    amSetStatus('Точка отмечена на карте (адрес определить не удалось — нет сети). Можно строить модель по координатам.', 'ok');
  }
}

// ---------- метка на карте ----------
function amSetPoint(lat, lon, opts) {
  const options = opts || {};
  amState.lat = lat;
  amState.lon = lon;

  const map = amState.map;
  if (map) {
    if (!amState.marker) {
      amState.marker = L.marker([lat, lon], { draggable: true }).addTo(map);
      amState.marker.on('dragend', () => {
        const pos = amState.marker.getLatLng();
        amSetPoint(pos.lat, pos.lng, { reverseGeocode: true, recenter: false });
      });
    } else {
      amState.marker.setLatLng([lat, lon]);
    }
    if (options.recenter) map.setView([lat, lon], options.zoom || Math.max(map.getZoom(), 16));
  }

  const useBtn = document.getElementById('am-use-btn');
  if (useBtn) useBtn.disabled = false;

  if (options.reverseGeocode) amReverseGeocode(lat, lon);
}

// ---------- поиск контура здания в точке через Overpass API (данные OSM) ----------
async function amFetchBuildingFootprint(lat, lon) {
  const query = `[out:json][timeout:25];way(around:70,${lat},${lon})["building"];out body;>;out skel qt;`;
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('overpass-http-error');
  const data = await res.json();

  const nodes = new Map();
  const ways = [];
  (data.elements || []).forEach((el) => {
    if (el.type === 'node') nodes.set(el.id, { lat: el.lat, lon: el.lon });
    else if (el.type === 'way' && el.tags && el.tags.building) ways.push(el);
  });
  if (!ways.length) return null;

  const buildings = ways
    .map((w) => {
      const ring = w.nodes.map((id) => nodes.get(id)).filter(Boolean);
      if (ring.length < 3) return null;
      // способ Overpass отдаёт замкнутый way — первая и последняя точка совпадают
      const closed = ring.length > 1 && ring[0].lat === ring[ring.length - 1].lat && ring[0].lon === ring[ring.length - 1].lon;
      const outer = closed ? ring.slice(0, -1) : ring;
      const centroid = amCentroid(outer);
      return { outer, centroid, tags: w.tags, containsPoint: amPointInPolygon(lat, lon, outer) };
    })
    .filter(Boolean);
  if (!buildings.length) return null;

  const containing = buildings.find((b) => b.containsPoint);
  const chosen = containing || buildings.reduce((best, b) => {
    const d = amDist(lat, lon, b.centroid.lat, b.centroid.lon);
    return !best || d < best.d ? { b, d } : best;
  }, null).b;

  const levels = amReadLevels(chosen.tags);
  const outerXZ = chosen.outer.map((p) => amToLocalXZ(p.lat, p.lon, chosen.centroid.lat, chosen.centroid.lon));
  const area = amPolygonArea(outerXZ);

  return { outer: outerXZ, rooms: [], area, levels, tags: chosen.tags };
}

function amCentroid(points) {
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lon = points.reduce((s, p) => s + p.lon, 0) / points.length;
  return { lat, lon };
}

function amDist(lat1, lon1, lat2, lon2) {
  const dLat = lat1 - lat2;
  const dLon = lon1 - lon2;
  return Math.sqrt(dLat * dLat + dLon * dLon);
}

// Точка внутри многоугольника (алгоритм луча/чётности), координаты — lat/lon как плоские
function amPointInPolygon(lat, lon, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].lon, yi = ring[i].lat;
    const xj = ring[j].lon, yj = ring[j].lat;
    const intersect = ((yi > lat) !== (yj > lat))
      && (lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Перевод lat/lon в локальные метры (x — восток, z — юг) относительно центра здания.
// Простая равнопромежуточная проекция — вполне точна на масштабе одного дома.
function amToLocalXZ(lat, lon, lat0, lon0) {
  const R = 6378137;
  const rad = Math.PI / 180;
  const x = (lon - lon0) * rad * R * Math.cos(lat0 * rad);
  const z = (lat0 - lat) * rad * R; // инверсия, чтобы "на карте выше" (север) было "дальше от камеры"
  return { x, z };
}

function amPolygonArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.z - b.x * a.z;
  }
  return Math.abs(area / 2);
}

function amReadLevels(tags) {
  if (!tags) return null;
  if (tags['building:levels'] && !Number.isNaN(Number(tags['building:levels']))) {
    return Number(tags['building:levels']);
  }
  if (tags.height) {
    const h = parseFloat(tags.height);
    if (!Number.isNaN(h) && h > 0) return h / 2.8;
  }
  return null;
}

// ---------- главное действие: подставить найденное здание в 3D-двойник ----------
async function amUseBuilding() {
  if (amState.lat == null || amState.lon == null) {
    amSetStatus('Сначала отметьте дом на карте или найдите адрес.', 'error');
    return;
  }

  const useBtn = document.getElementById('am-use-btn');
  if (useBtn) useBtn.disabled = true;
  amSetStatus('Ищу контур здания в OpenStreetMap…');

  try {
    const footprint = await amFetchBuildingFootprint(amState.lat, amState.lon);
    if (!footprint) {
      amSetStatus('В этой точке нет размеченного контура здания в OpenStreetMap — модель будет построена по введённой ниже площади и типу объекта, но точка на карте сохранена.', 'error');
      if (useBtn) useBtn.disabled = false;
      return;
    }

    window.EcotchiFloorplan = footprint;

    const areaInput = document.getElementById('twin-area');
    if (areaInput) areaInput.value = Math.max(6, Math.round(footprint.area));

    const levelsNote = footprint.levels ? `, этажность ≈ ${footprint.levels.toFixed(1)}` : '';
    amSetStatus(`Контур здания найден: площадь по OSM ≈ ${footprint.area.toFixed(1)} м²${levelsNote}. Строю 3D-модель…`, 'ok');

    const genBtn = document.getElementById('twin-generate-btn');
    if (genBtn) genBtn.click();
  } catch (e) {
    amSetStatus('Не удалось получить контур здания (сервис Overpass недоступен или нет сети). Попробуйте ещё раз чуть позже — модель пока строится по площади и типу объекта.', 'error');
  } finally {
    if (useBtn) useBtn.disabled = false;
  }
}

function amClear() {
  amState.lat = null;
  amState.lon = null;
  amState.address = '';
  window.EcotchiFloorplan = null;

  if (amState.marker && amState.map) {
    amState.map.removeLayer(amState.marker);
    amState.marker = null;
  }
  const input = document.getElementById('am-address-input');
  if (input) input.value = '';
  const useBtn = document.getElementById('am-use-btn');
  if (useBtn) useBtn.disabled = true;

  amSetStatus('Адрес сброшен — модель снова строится по площади и типу объекта.');

  const genBtn = document.getElementById('twin-generate-btn');
  if (genBtn) genBtn.click();
}

document.addEventListener('DOMContentLoaded', amInit);
