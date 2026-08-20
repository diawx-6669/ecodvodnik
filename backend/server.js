const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config/config');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const readingsRoutes = require('./routes/readings');
const analyticsRoutes = require('./routes/analytics');
const assistantRoutes = require('./routes/assistant');
const goalsRoutes = require('./routes/goals');
const alertsRoutes = require('./routes/alerts');
const exportRoutes = require('./routes/export');

const app = express();

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/readings', readingsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/export', exportRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'ecodvoinik-backend' });
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
