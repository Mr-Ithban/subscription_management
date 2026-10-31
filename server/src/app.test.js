import request from 'supertest';
import app from './app.js';

describe('Server Health and Core Routes', () => {
  it('GET /api/health should return status ok with 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /api/unknown should return 404 error response', async () => {
    const res = await request(app).get('/api/unknown');
    expect(res.statusCode).toBe(404);
    expect(res.body.error.message).toContain('Route not found');
  });

  it('limits authentication routes to 20 requests per 15 minutes', async () => {
    let response;
    for (let index = 0; index < 21; index += 1) {
      response = await request(app).post('/api/auth/login').send({});
    }

    expect(response.statusCode).toBe(429);
    expect(response.body).toEqual({
      error: { message: 'Too many authentication requests. Please try again later.' },
    });
  });
});
