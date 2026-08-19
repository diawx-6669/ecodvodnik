const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config/config');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const readingsRoutes = require('./routes/readings');
const analyticsRoutes = require('./routes/analytics');
const assistantRoutes = require('./routes/assistant');

const app = express();

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/readings', readingsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/assistant', assistantRoutes);

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

app.listen(config.port, () => {
  console.log(`ЭкоДвойник backend запущен на http://localhost:${config.port}`);
});
