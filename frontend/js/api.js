// Небольшая обёртка над fetch для общения с backend API.

const API_BASE = '/api';
const AUTH_TOKEN_KEY = 'ecodvoinik_token';

function getToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

function setToken(token) {
  if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
  else localStorage.removeItem(AUTH_TOKEN_KEY);
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

async function apiPost(path, body, { auth = true } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ? authHeaders() : {}) },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `POST ${path} failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function apiPatch(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `PATCH ${path} failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const api = {
  getSummary: () => apiGet('/analytics/summary'),
  getDeviceStatus: () => apiGet('/analytics/device-status'),
  getRecommendations: () => apiGet('/assistant/recommendations'),
  getHistory: () => apiGet('/assistant/history'),
  sendMessage: (message) => apiPost('/assistant/message', { message }),
  addReading: (type, value) => apiPost('/readings', { type, value, source: 'manual' }),

  // --- Аккаунт ---
  register: (payload) => apiPost('/auth/register', payload, { auth: false }),
  login: (email, password) => apiPost('/auth/login', { email, password }, { auth: false }),
  me: () => apiGet('/auth/me'),
  updateMe: (payload) => apiPatch('/auth/me', payload),
};
