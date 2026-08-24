# API Reference

Базовый URL: `http://localhost:3000/api`

## Readings (показания)

### `POST /readings`
Добавить новое показание.

```json
{
  "type": "water",           // "water" | "electricity"
  "value": 12.5,
  "source": "manual",        // "manual" | "device" | "csv_import"
  "token": "..."             // обязателен только если source = "device"
}
```

### `GET /readings?type=water&limit=50`
Список показаний, с опциональной фильтрацией по типу и лимитом.

### `POST /readings/import-csv`
Массовый импорт (например, из сгенерированного демо-CSV).

```json
{
  "readings": [
    { "type": "water", "value": 320, "timestamp": "2026-08-01T00:00:00Z" }
  ]
}
```

### `POST /readings/photo-analyze`
Распознаёт фото счётчика воды/электричества или квитанции через Claude Vision.
Показание при этом НЕ сохраняется — эндпоинт только возвращает распознанные
данные, сохранение делается отдельным `POST /readings` после подтверждения
пользователем.

```json
// Запрос
{
  "image": "data:image/jpeg;base64,..."
}
```

```json
// Ответ (200)
{
  "documentType": "meter",        // "meter" | "receipt" | "unknown"
  "resourceType": "water",        // "water" | "electricity" | null
  "value": 1234.5,                // распознанное показание или null
  "unit": "л",
  "costKzt": null,                // сумма к оплате, если это квитанция
  "period": null,                 // период квитанции, если виден
  "confidence": 0.87,             // 0..1
  "notes": "Чёткое фото счётчика воды, цифры хорошо видны."
}
```

Если `ANTHROPIC_API_KEY` не настроен на сервере или фото не удалось разобрать,
возвращается `422` с полем `error` — понятным сообщением для показа пользователю.

## Analytics (аналитика)

### `GET /analytics/summary`
Возвращает сводку за неделю: расход, деньги, тренды, аномалии + состояние питомца.

```json
{
  "summary": {
    "water": { "total_liters": 2100, "cost_kzt": 735, "trend_percent": 12.4 },
    "electricity": { "total_kwh": 65.3, "cost_kzt": 1632, "trend_percent": -5.1 },
    "total_cost_kzt": 2367,
    "anomalies": []
  },
  "pet": { "mood": "neutral", "level": 1, "worstTrend": 12.4 }
}
```

### `GET /analytics/device-status`
Показывает, "на связи" ли реальное устройство (счётчик/датчик) прямо сейчас —
по времени последнего показания с `source: "device"`. Используется на
фронтенде для живого индикатора " датчик на связи".

```json
{
  "connected": true,
  "lastReading": { "type": "water", "value": 1.0, "timestamp": "...", "source": "device" },
  "secondsAgo": 12,
  "totalReadingsFromDevice": 47
}
```

## Assistant (питомец-ассистент)

### `POST /assistant/message`
Отправить сообщение питомцу, получить ответ на основе актуальных данных.

```json
{ "message": "Почему вырос счёт за воду?" }
```

### `GET /assistant/recommendations`
Список персональных рекомендаций с оценкой экономии в тенге/месяц.

### `GET /assistant/history`
История переписки с питомцом.

## Health check

### `GET /health`
Проверка, что сервер жив. Возвращает `{ "status": "ok" }`.
