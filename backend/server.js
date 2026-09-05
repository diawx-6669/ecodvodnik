const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config/config');
const errorHandler = require('./middleware/errorHandler');

// Захардкоженные в config.js значения ('dev_insecure_secret_change_me',
// 'DIAWX7', 'change_me_please') — это удобные значения ТОЛЬКО для локальной
// разработки, чтобы `npm test`/`npm start` работали без .env. Если сервер
// стартует в проде (NODE_ENV=production) с этими же значениями, значит
// переменные окружения не заданы на хостинге — и, например, код
// администратора совпадает с тем, что лежит в открытом виде в этом же
// репозитории. Раньше это происходило абсолютно молча.
if (config.isProduction) {
  const insecureDefaults = [
    ['JWT_SECRET', config.jwtSecret, 'dev_insecure_secret_change_me'],
    ['ADMIN_CODE', config.adminCode, 'DIAWX7'],
    ['DEVICE_TOKEN', config.deviceToken, 'change_me_please'],
  ].filter(([, value, def]) => value === def);

  if (insecureDefaults.length) {
    console.error(
      '\n⚠️  ВНИМАНИЕ: в production-режиме используются значения по умолчанию для: ' +
      insecureDefaults.map(([name]) => name).join(', ') +
      '. Это небезопасно — задайте эти переменные окружения на хостинге ' +
      '(см. render.yaml).\n'
    );
  }
}

const authRoutes = require('./routes/auth');
const readingsRoutes = require('./routes/readings');
const analyticsRoutes = require('./routes/analytics');
const assistantRoutes = require('./routes/assistant');
const goalsRoutes = require('./routes/goals');
const alertsRoutes = require('./routes/alerts');
const exportRoutes = require('./routes/export');
const achievementsRoutes = require('./routes/achievements');
const householdRoutes = require('./routes/household');
const tipsRoutes = require('./routes/tips');
const integrationsRoutes = require('./routes/integrations');
const adminRoutes = require('./routes/admin');
const appliancesRoutes = require('./routes/appliances');

const app = express();

app.use(cors());
// Лимит поднят до 15mb: фото счётчиков/квитанций с телефона в base64 легко
// превышают дефолтные 100kb express.json().
app.use(express.json({ limit: '15mb' }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/readings', readingsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/achievements', achievementsRoutes);
app.use('/api/household', householdRoutes);
app.use('/api/tips', tipsRoutes);
app.use('/api/integrations', integrationsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/appliances', appliancesRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'ecodvodnik-backend' });
});

// Отдаём фронтенд как статику
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.use(errorHandler);

// Экспортируем app отдельно от listen(), чтобы тесты (supertest) могли
// импортировать сервер, не поднимая реальный порт.
if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`ЭкоДвойник backend запущен на http://localhost:${config.port}`);
  });
}

module.exports = app;
