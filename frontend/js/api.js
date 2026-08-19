// Небольшая обёртка над fetch для общения с backend API.

const API_BASE = '/api';

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json();
}

const api = {
  getSummary: () => apiGet('/analytics/summary'),
  getDeviceStatus: () => apiGet('/analytics/device-status'),
  getRecommendations: () => apiGet('/assistant/recommendations'),
  getHistory: () => apiGet('/assistant/history'),
  sendMessage: (message) => apiPost('/assistant/message', { message }),
  addReading: (type, value) => apiPost('/readings', { type, value, source: 'manual' }),
};
