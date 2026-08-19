<!-- Development Notes for Backend -->

# EcoTwin Backend Development

## Структура

```
backend/
├── server.js           # Точка входа
├── package.json        # Зависимости
├── config/
│   └── config.js       # Конфигурация приложения
├── routes/             # Express маршруты
│   ├── auth.js
│   ├── readings.js
│   ├── analytics.js
│   └── assistant.js
├── controllers/        # Обработчики запросов
│   ├── authController.js
│   ├── readingsController.js
│   ├── analyticsController.js
│   └── assistantController.js
├── services/           # Бизнес-логика
│   ├── aiService.js
│   ├── analyticsService.js
│   └── petStateService.js
├── models/             # Модели данных
│   ├── User.js
│   └── Reading.js
├── middleware/
│   ├── auth.js
│   └── errorHandler.js
└── data/
    └── db.js           # JSON база данных
```

## Как запустить

### Разработка (с автоперезагрузкой)
```bash
npm run dev
```

### Production
```bash
npm start
```

## Environment Variables

Создайте `backend/.env` (скопируйте из `.env.example`):

```
NODE_ENV=development
PORT=5000
JWT_SECRET=dev-secret-key
OPENAI_API_KEY=sk-...  # опционально
```

## API Endpoints

### Authentication
- `POST /api/auth/register` — регистрация
- `POST /api/auth/login` — вход
- `POST /api/auth/logout` — выход

### Readings
- `GET /api/readings` — получить показания
- `POST /api/readings` — добавить показание

### Analytics
- `GET /api/analytics/summary` — сводка
- `GET /api/analytics/trends` — тренды

### Assistant
- `POST /api/assistant/chat` — чат с питомцем

## Middleware

- **auth.js** — проверка JWT токена
- **errorHandler.js** — обработка ошибок

## Database

JSON "база данных" в `data/db.js`:
- Простое хранилище для локальной разработки
- Автоматически сохраняется при каждом изменении
- Подойдет для хакатона, но для production нужна реальная БД

## Testing

1. **Используйте Postman коллекцию:**
   ```bash
   # Импортируйте EcoTwin-API.postman_collection.json в Postman
   ```

2. **Проверьте логи:**
   ```bash
   # В консоли будут видны все запросы и ошибки
   ```

## Дебаг

```javascript
// В любом файле можно использовать
console.log('Debug info:', data);

// Или более красиво
console.table(data);
```

Смотрите логи в терминале где запущен `npm run dev`.

## Performance

- Минимальное логирование в production
- Кэширование данных где возможно
- Оптимизация запросов к "БД"

## Contributing

Смотрите [../CONTRIBUTING.md](../CONTRIBUTING.md)
