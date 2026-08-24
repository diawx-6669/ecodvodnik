const request = require('supertest');
const app = require('../server');

async function registerUser(app, overrides = {}) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Тест Пользователь',
      email: overrides.email || `user_${Date.now()}_${Math.random()}@example.com`,
      password: 'secret123',
      type: 'household',
      unitsCount: 2,
      ...overrides,
    });
  return res.body.token;
}

describe('POST /api/readings', () => {
  it('accepts a valid manual reading', async () => {
    const res = await request(app).post('/api/readings').send({ type: 'water', value: 120 });
    expect(res.status).toBe(201);
    expect(res.body.type).toBe('water');
    expect(res.body.value).toBe(120);
    expect(res.body.unit).toBe('liters');
  });

  it('rejects an unknown type', async () => {
    const res = await request(app).post('/api/readings').send({ type: 'gas', value: 10 });
    expect(res.status).toBe(400);
  });

  it('rejects a negative value', async () => {
    const res = await request(app).post('/api/readings').send({ type: 'water', value: -5 });
    expect(res.status).toBe(400);
  });

  it('rejects an unrealistically large single reading', async () => {
    const res = await request(app).post('/api/readings').send({ type: 'electricity', value: 999999 });
    expect(res.status).toBe(400);
  });

  it('rejects a device reading with a wrong device token', async () => {
    const res = await request(app)
      .post('/api/readings')
      .send({ type: 'water', value: 10, source: 'device', token: 'wrong-token' });
    expect(res.status).toBe(401);
  });

  it('accepts a device reading with the correct device token', async () => {
    const res = await request(app)
      .post('/api/readings')
      .send({ type: 'water', value: 10, source: 'device', token: process.env.DEVICE_TOKEN });
    expect(res.status).toBe(201);
  });
});

describe('GET /api/readings — privacy between accounts', () => {
  it('keeps guest demo readings separate from a logged-in account\'s private readings', async () => {
    const token = await registerUser(app);

    // Гостевое показание (без токена) — общая демо-лента
    await request(app).post('/api/readings').send({ type: 'water', value: 50 });
    // Приватное показание конкретного аккаунта
    await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'water', value: 77 });

    const guestView = await request(app).get('/api/readings');
    expect(guestView.status).toBe(200);
    expect(guestView.body.every((r) => r.value !== 77)).toBe(true);

    const ownerView = await request(app).get('/api/readings').set('Authorization', `Bearer ${token}`);
    expect(ownerView.status).toBe(200);
    expect(ownerView.body.some((r) => r.value === 77)).toBe(true);
  });

  it('does not leak one account\'s readings to another account', async () => {
    const tokenA = await registerUser(app, { email: 'a@example.com' });
    const tokenB = await registerUser(app, { email: 'b@example.com' });

    await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ type: 'electricity', value: 42 });

    const viewB = await request(app).get('/api/readings').set('Authorization', `Bearer ${tokenB}`);
    expect(viewB.body.some((r) => r.value === 42)).toBe(false);
  });
});
