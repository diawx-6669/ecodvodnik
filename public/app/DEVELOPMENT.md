<!-- Development Notes for Frontend -->

# EcoTwin Frontend Development

## Структура

```
frontend/
├── index.html          # Главная страница
├── css/
│   └── style.css       # Стили
├── js/
│   ├── app.js          # Основной скрипт приложения
│   ├── api.js          # Работа с API
│   ├── auth.js         # Аутентификация
│   ├── chart.js        # Графики данных
│   └── pet.js          # Логика питомца
└── assets/
    └── pet/            # Изображения питомца
```

## Как запустить

1. **Убедитесь, что backend запущен:**
   ```bash
   cd backend
   npm run dev
   ```

2. **Откройте в браузере:**
   - `http://localhost:5000`

## Основные компоненты

### Pet System (js/pet.js)
- Состояние питомца (happy, sad, tired)
- Реакция на данные потребления
- Анимации и эмодзи

### Analytics (js/chart.js)
- Графики потребления воды
- Графики электроэнергии
- Сравнение с нормами

### API Communication (js/api.js)
- Запросы к backend
- Кэширование данных
- Обработка ошибок

## Development Tips

- **Горячая перезагрузка:** Обновите страницу в браузере (Cmd+R)
- **Отладка:** Откройте DevTools (F12) и смотрите Console
- **Логирование:** В `js/app.js` используйте `console.log()`

## Testing

Используйте Postman коллекцию (`EcoTwin-API.postman_collection.json`) для тестирования backend перед использованием frontend.

## Статика

При деплое в production все файлы из папки `frontend/` должны раздаваться как статика через express `static()` middleware в `backend/server.js`.
