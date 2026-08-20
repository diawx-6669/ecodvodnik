const request = require('supertest');
const app = require('../server');
const { readDb, writeDb } = require('../data/db');

describe('Goals API', () => {
  let token;
  const testUser = {
    id: 'test-user-goals',
    email: 'test@goals.com',
    passwordHash: 'hashed',
    name: 'Test User',
  };

  beforeEach(() => {
    const db = readDb();
    // Clear existing test data
    db.users = [testUser];
    db.goals = [];
    db.readings = [];
    writeDb(db);

    // Mock JWT token
    token = require('jsonwebtoken').sign({ id: testUser.id }, require('../config/config').jwtSecret);
  });

  it('should set a new consumption goal', async () => {
    const response = await request(app)
      .post('/api/goals')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'water',
        targetValue: 5000,
        monthYear: '2026-08',
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('id');
    expect(response.body.type).toBe('water');
    expect(response.body.targetValue).toBe(5000);
  });

  it('should reject invalid goal type', async () => {
    const response = await request(app)
      .post('/api/goals')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'invalid',
        targetValue: 5000,
        monthYear: '2026-08',
      });

    expect(response.status).toBe(400);
  });

  it('should get user goals for specific month', async () => {
    // First, create a goal
    await request(app)
      .post('/api/goals')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'water',
        targetValue: 5000,
        monthYear: '2026-08',
      });

    // Then retrieve it
    const response = await request(app)
      .get('/api/goals?monthYear=2026-08')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].type).toBe('water');
  });

  it('should calculate goal progress correctly', async () => {
    // Create a goal
    await request(app)
      .post('/api/goals')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'water',
        targetValue: 5000,
        monthYear: '2026-08',
      });

    // Add some readings
    const db = readDb();
    db.readings.push({
      id: 'test-reading-1',
      type: 'water',
      value: 2000,
      unit: 'liters',
      timestamp: '2026-08-15T10:00:00Z',
      userId: testUser.id,
    });
    writeDb(db);

    // Get progress
    const response = await request(app)
      .get('/api/goals/progress?monthYear=2026-08')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body[0].currentUsage).toBe(2000);
    expect(response.body[0].percentageUsed).toBe('40.0');
    expect(response.body[0].isExceeded).toBe(false);
  });
});

describe('Alerts API', () => {
  let token;
  const testUser = {
    id: 'test-user-alerts',
    email: 'test@alerts.com',
    passwordHash: 'hashed',
    name: 'Test User',
  };

  beforeEach(() => {
    const db = readDb();
    db.users = [testUser];
    db.goals = [];
    db.readings = [];
    db.alerts = [];
    writeDb(db);

    token = require('jsonwebtoken').sign({ id: testUser.id }, require('../config/config').jwtSecret);
  });

  it('should create alert when consumption exceeds goal', async () => {
    const db = readDb();

    // Set a goal
    db.goals.push({
      id: 'test-goal',
      userId: testUser.id,
      type: 'water',
      monthYear: '2026-08',
      targetValue: 5000,
      unit: 'liters',
    });

    // Add readings exceeding goal
    db.readings.push(
      {
        id: 'r1',
        type: 'water',
        value: 6000,
        userId: testUser.id,
        timestamp: '2026-08-15T10:00:00Z',
      },
      {
        id: 'r2',
        type: 'water',
        value: 500,
        userId: testUser.id,
        timestamp: '2026-08-16T10:00:00Z',
      }
    );
    writeDb(db);

    const response = await request(app)
      .post('/api/alerts/check')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].message).toContain('Вода');
  });

  it('should retrieve user alerts', async () => {
    const db = readDb();
    db.alerts.push({
      id: 'alert-1',
      userId: testUser.id,
      type: 'water',
      month: '2026-08',
      currentUsage: 6500,
      goalValue: 5000,
      percentageOver: 30,
      message: 'Вода: вы превышили норму на 30%',
      acknowledged: false,
    });
    writeDb(db);

    const response = await request(app)
      .get('/api/alerts')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].acknowledged).toBe(false);
  });

  it('should acknowledge alert', async () => {
    const db = readDb();
    db.alerts.push({
      id: 'alert-1',
      userId: testUser.id,
      type: 'water',
      month: '2026-08',
      currentUsage: 6500,
      goalValue: 5000,
      percentageOver: 30,
      message: 'Вода: вы превышили норму на 30%',
      acknowledged: false,
    });
    writeDb(db);

    const response = await request(app)
      .put('/api/alerts/alert-1/acknowledge')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.acknowledged).toBe(true);
  });
});

describe('Export API', () => {
  let token;
  const testUser = {
    id: 'test-user-export',
    email: 'test@export.com',
    passwordHash: 'hashed',
    name: 'Test User',
  };

  beforeEach(() => {
    const db = readDb();
    db.users = [testUser];
    db.readings = [
      {
        id: 'r1',
        type: 'water',
        value: 1000,
        unit: 'liters',
        timestamp: '2026-08-15T10:00:00Z',
        userId: testUser.id,
      },
      {
        id: 'r2',
        type: 'electricity',
        value: 25,
        unit: 'kwh',
        timestamp: '2026-08-15T11:00:00Z',
        userId: testUser.id,
      },
    ];
    writeDb(db);

    token = require('jsonwebtoken').sign({ id: testUser.id }, require('../config/config').jwtSecret);
  });

  it('should export data as CSV', async () => {
    const response = await request(app)
      .get('/api/export/csv')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.text).toContain('Дата и время');
    expect(response.text).toContain('Вода');
    expect(response.text).toContain('Электричество');
  });

  it('should get consumption summary', async () => {
    const response = await request(app)
      .get('/api/export/summary?monthYear=2026-08')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.water.total_liters).toBe('1000.00');
    expect(response.body.electricity.total_kwh).toBe('25.00');
    expect(response.body.water.reading_count).toBe(1);
    expect(response.body.electricity.reading_count).toBe(1);
  });
});
