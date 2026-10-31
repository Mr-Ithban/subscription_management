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
    expect(res.body.status).toBe('error');
    expect(res.body.statusCode).toBe(404);
  });
});
