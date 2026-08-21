// Интеграция с реальными данными (счётчики/умный дом) — генерация личного
// API-ключа и общего webhook-адреса, на который любой шлюз/скрипт может
// присылать показания. См. backend/controllers/integrationsController.js
// за честным описанием ограничений (нет прямых интеграций с конкретными
// облаками производителей, только универсальный протокол).

function integrationsEl(id) {
  return document.getElementById(id);
}

async function loadIntegrationStatus() {
  const section = integrationsEl('integrations-section');
  if (!section || !window.appAuth || !window.appAuth.user) {
    if (section) section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');

  try {
    const status = await api.getIntegrationStatus();
    renderIntegrationStatus(status);
  } catch (err) {
    console.error('Не удалось загрузить статус интеграции:', err);
  }
}

function renderIntegrationStatus(status) {
  const notConnected = integrationsEl('integration-not-connected');
  const connected = integrationsEl('integration-connected');
  if (!notConnected || !connected) return;

  notConnected.classList.toggle('hidden', status.connected);
  connected.classList.toggle('hidden', !status.connected);

  if (status.connected) {
    integrationsEl('integration-readings-count').textContent = status.totalReadingsFromIntegration;
    integrationsEl('integration-last-reading').textContent = status.lastReading
      ? `${status.lastReading.type === 'water' ? 'Вода' : 'Электричество'}: ${status.lastReading.value} (${new Date(status.lastReading.timestamp).toLocaleString('ru-RU')})`
      : 'Показаний пока не поступало';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const issueBtn = integrationsEl('integration-issue-btn');
  if (issueBtn) {
    issueBtn.addEventListener('click', async () => {
      issueBtn.disabled = true;
      try {
        const data = await api.issueIntegrationKey();
        integrationsEl('integration-api-key').textContent = data.apiKey;
        integrationsEl('integration-webhook-url').textContent = `${window.location.origin}/api${data.webhookUrl}`;
        integrationsEl('integration-key-block').classList.remove('hidden');
        await loadIntegrationStatus();
      } catch (err) {
        console.error('Не удалось создать ключ интеграции:', err);
      } finally {
        issueBtn.disabled = false;
      }
    });
  }

  const revokeBtn = integrationsEl('integration-revoke-btn');
  if (revokeBtn) {
    revokeBtn.addEventListener('click', async () => {
      if (!confirm('Отозвать ключ интеграции? Внешние устройства перестанут присылать данные.')) return;
      try {
        await api.revokeIntegrationKey();
        integrationsEl('integration-key-block').classList.add('hidden');
        await loadIntegrationStatus();
      } catch (err) {
        console.error('Не удалось отозвать ключ:', err);
      }
    });
  }
});

window.loadIntegrationStatus = loadIntegrationStatus;
