# Deployment Guide for EcoTwin

## Локальное развертывание

### Docker Compose

```bash
docker-compose up --build
```

Это запустит:
- Backend на `http://localhost:5000`
- Frontend автоматически раздается backend

## Production Deployment

### Вариант 1: Heroku

```bash
# Установите Heroku CLI
# https://devcenter.heroku.com/articles/heroku-cli

# Создайте приложение
heroku create your-app-name

# Установите переменные окружения
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your_random_secret_key_here
heroku config:set PORT=5000

# Деплой
git push heroku main
```

### Вариант 2: Railway.app

```bash
# Установите Railway CLI
npm i -g @railway/cli

# Авторизуйтесь
railway login

# Создайте проект
railway init

# Установите переменные
railway variables set NODE_ENV=production
railway variables set JWT_SECRET=your_random_secret_key_here

# Деплой
railway up
```

### Вариант 3: DigitalOcean App Platform

1. Push код на GitHub
2. Подключитесь к DigitalOcean
3. Создайте новое приложение
4. Выберите GitHub репозиторий
5. Установите переменные окружения
6. Deploy!

### Вариант 4: VPS (Ubuntu)

```bash
# Установите Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Клонируйте репозиторий
git clone https://github.com/your-username/ecodvodnik.git
cd ecodvodnik

# Установите зависимости
cd backend && npm install
cd ..

# Установите PM2 для управления процессом
sudo npm install -g pm2

# Запустите приложение
cd backend
pm2 start server.js --name "ecodvoinik"
pm2 startup
pm2 save

# Установите Nginx как reverse proxy
sudo apt-get install -y nginx

# Конфигурируйте Nginx
sudo nano /etc/nginx/sites-available/default
```

Пример конфигурации Nginx:
```nginx
server {
    listen 80;
    server_name your_domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Checklist перед Production

- [ ] Измените `JWT_SECRET` на длинную случайную строку
- [ ] Установите `NODE_ENV=production`
- [ ] Используйте реальную базу данных (не JSON файл)
- [ ] Добавьте SSL сертификат (Let's Encrypt)
- [ ] Настройте логирование
- [ ] Установите мониторинг (сигналы об ошибках)
- [ ] Настройте backup базы данных
- [ ] Протестируйте все endpoints перед деплоем

## Мониторинг

### Используйте PM2+ для мониторинга

```bash
pm2 plus
```

### Используйте Sentry для отслеживания ошибок

```bash
npm install --save @sentry/node
```

Добавьте в `backend/server.js`:
```javascript
const Sentry = require('@sentry/node');

Sentry.init({ dsn: 'YOUR_DSN_HERE' });
app.use(Sentry.Handlers.errorHandler());
```

## Мониторинг логов

```bash
# Смотрите логи PM2
pm2 logs ecodvoinik

# Или используйте journalctl
sudo journalctl -u ecodvoinik -f
```

## Откат версии

Если что-то пошло не так:

```bash
git revert HEAD  # Отката последний коммит
git push         # Push на удаленный репозиторий
# Перезагрузите приложение
```

## Частые проблемы

### Port 5000 занят

```bash
lsof -i :5000
kill -9 <PID>
```

### Недостаточно памяти

```bash
pm2 start server.js --max-memory-restart 300M
```

### Проблемы с базой данных

Убедитесь, что база данных доступна и переменные окружения установлены правильно.

---

Нужна помощь? Откройте Issue на GitHub!
