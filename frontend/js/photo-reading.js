// ===================== Фото счётчика/квитанции → распознавание ИИ =====================
// Пользователь загружает фото, мы отправляем его на бэкенд (Claude Vision),
// получаем распознанные тип ресурса и показание, и подставляем их в форму
// "Новое показание" — само показание сохраняется только когда человек жмёт
// "Добавить" (после проверки/правки), чтобы ошибка распознавания не улетела
// в базу молча.

const READING_PHOTO_MAX_MB = 8;

let readingPhotoState = {
  dataUrl: null,
};

function rpEl(id) {
  return document.getElementById(id);
}

function rpSetStatus(message, kind) {
  const el = rpEl('reading-photo-status');
  if (!el) return;
  if (!message) {
    el.hidden = true;
    el.textContent = '';
    el.className = 'reading-photo-status';
    return;
  }
  el.hidden = false;
  el.textContent = message;
  el.className = `reading-photo-status reading-photo-status--${kind || 'info'}`;
}

function rpResetPreview() {
  readingPhotoState.dataUrl = null;
  const wrap = rpEl('reading-photo-preview-wrap');
  const img = rpEl('reading-photo-preview');
  const clearBtn = rpEl('reading-photo-clear-btn');
  const input = rpEl('reading-photo-input');
  if (wrap) wrap.hidden = true;
  if (img) img.src = '';
  if (clearBtn) clearBtn.hidden = true;
  if (input) input.value = '';
  rpSetStatus('');
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });
}

async function rpOnFileSelected(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
    rpSetStatus('Формат не поддерживается. Загрузите JPG, PNG, WEBP или GIF.', 'error');
    return;
  }
  if (file.size > READING_PHOTO_MAX_MB * 1024 * 1024) {
    rpSetStatus(`Файл слишком большой (максимум ${READING_PHOTO_MAX_MB} МБ).`, 'error');
    return;
  }

  try {
    const dataUrl = await fileToDataUrl(file);
    readingPhotoState.dataUrl = dataUrl;

    const wrap = rpEl('reading-photo-preview-wrap');
    const img = rpEl('reading-photo-preview');
    const clearBtn = rpEl('reading-photo-clear-btn');
    if (img) img.src = dataUrl;
    if (wrap) wrap.hidden = false;
    if (clearBtn) clearBtn.hidden = false;

    rpSetStatus('Распознаю фото…', 'loading');
    const result = await api.analyzeMeterPhoto(dataUrl);
    rpApplyResult(result);
  } catch (err) {
    console.error('Ошибка распознавания фото:', err);
    rpSetStatus(err.message || 'Не удалось распознать фото. Введите показание вручную.', 'error');
  }
}

function rpApplyResult(result) {
  const typeSelect = rpEl('reading-type');
  const valueInput = rpEl('reading-value');

  if (result.resourceType && typeSelect) {
    typeSelect.value = result.resourceType;
  }
  if (typeof result.value === 'number' && valueInput) {
    valueInput.value = result.value;
  }

  const confidencePct = Math.round((result.confidence || 0) * 100);
  const parts = [];

  if (result.documentType === 'receipt') {
    parts.push('Похоже на квитанцию.');
    if (result.costKzt != null) parts.push(`Сумма: ${result.costKzt} ₸.`);
    if (result.period) parts.push(`Период: ${result.period}.`);
  } else if (result.documentType === 'meter') {
    parts.push('Похоже на фото счётчика.');
  }

  if (typeof result.value === 'number') {
    parts.push(`Показание: ${result.value}${result.unit ? ' ' + result.unit : ''} (уверенность ${confidencePct}%).`);
  } else {
    parts.push('Точное значение распознать не удалось — введите его вручную.');
  }

  if (result.notes) parts.push(result.notes);

  const kind = typeof result.value === 'number' && result.confidence >= 0.6 ? 'success' : 'warning';
  rpSetStatus(parts.join(' '), kind);
}

function rpInit() {
  const input = rpEl('reading-photo-input');
  const clearBtn = rpEl('reading-photo-clear-btn');
  if (!input) return;

  input.addEventListener('change', rpOnFileSelected);
  if (clearBtn) clearBtn.addEventListener('click', rpResetPreview);

  // После успешного добавления показания через основную форму — прячем
  // превью фото, чтобы не запутать пользователя старыми данными.
  const form = rpEl('reading-form');
  if (form) {
    form.addEventListener('submit', () => {
      // Основной обработчик в app.js сам отправит показание; здесь только
      // сбрасываем состояние фото после небольшой паузы (после успешной отправки).
      setTimeout(() => rpResetPreview(), 300);
    });
  }
}

// Скрипт подключается в конце <body>, DOM уже разобран к этому моменту —
// поэтому просто инициализируем сразу, без ожидания DOMContentLoaded
// (которое к этому времени уже могло сработать и не сработать снова).
rpInit();
