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

async function apiPut(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `PUT ${path} failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function apiDelete(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `DELETE ${path} failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const api = {
  getSummary: () => apiGet('/analytics/summary'),
  getHistory: (period = 'day') => apiGet(`/analytics/history?period=${encodeURIComponent(period)}`),
  getDeviceStatus: () => apiGet('/analytics/device-status'),
  getRecommendations: () => apiGet('/assistant/recommendations'),
  getChatHistory: () => apiGet('/assistant/history'),
  sendMessage: (message) => apiPost('/assistant/message', { message }),
  lookupAppliance: (payload) => apiPost('/appliances/lookup', payload),
  addReading: (type, value) => apiPost('/readings', { type, value, source: 'manual' }),
  analyzeMeterPhoto: (imageDataUrl) => apiPost('/readings/photo-analyze', { image: imageDataUrl }),

  // --- Аккаунт ---
  register: (payload) => apiPost('/auth/register', payload, { auth: false }),
  login: (email, password) => apiPost('/auth/login', { email, password }, { auth: false }),
  me: () => apiGet('/auth/me'),
  updateMe: (payload) => apiPatch('/auth/me', payload),
  changePassword: (currentPassword, newPassword) =>
    apiPost('/auth/change-password', { currentPassword, newPassword }),
  claimAdmin: (code) => apiPost('/auth/admin-code', { code }),

  // --- Уведомления ---
  getAlerts: () => apiGet('/alerts'),
  checkAlerts: () => apiPost('/alerts/check', {}),
  acknowledgeAlert: (alertId) => apiPut(`/alerts/${alertId}/acknowledge`, {}),

  // --- Советы по экономии ---
  getTips: () => apiGet('/tips'),

  // --- Достижения / геймификация ---
  getAchievements: () => apiGet('/achievements'),
  checkAchievements: () => apiPost('/achievements/check', {}),

  // --- Семейный аккаунт ---
  createHousehold: (name) => apiPost('/household', { name }),
  joinHousehold: (inviteCode) => apiPost('/household/join', { inviteCode }),
  getHousehold: () => apiGet('/household'),
  leaveHousehold: () => apiPost('/household/leave', {}),

  // --- Интеграция с реальными счётчиками / умным домом ---
  issueIntegrationKey: () => apiPost('/integrations/api-key', {}),
  getIntegrationStatus: () => apiGet('/integrations'),
  revokeIntegrationKey: () => apiDelete('/integrations/api-key'),

  // --- Админка ---
  adminListUsers: () => apiGet('/admin/users'),
  adminSetUserRole: (userId, role) => apiPut(`/admin/users/${userId}/role`, { role }),
  adminGlobalStats: () => apiGet('/admin/stats'),
  adminGetSettings: () => apiGet('/admin/settings'),
  adminUpdateSettings: (payload) => apiPut('/admin/settings', payload),
};
