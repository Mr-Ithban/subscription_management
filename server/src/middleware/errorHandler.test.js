import express from 'express';
import request from 'supertest';
import { errorHandler } from './errorHandler.js';

describe('errorHandler', () => {
  it('maps Prisma unique constraint errors to 409 with the fields', async () => {
    const app = express();
    app.get('/duplicate', (_req, _res, next) => {
      next(Object.assign(new Error('duplicate'), { code: 'P2002', meta: { target: ['email'] } }));
    });
    app.use(errorHandler);

    const response = await request(app).get('/duplicate');

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: {
        message: 'A record with these values already exists',
        details: { fields: ['email'] },
      },
    });
  });

  it('uses the shared error response shape', async () => {
    const app = express();
    app.get('/failure', (_req, _res, next) => next(Object.assign(new Error('Bad request'), { status: 400 })));
    app.use(errorHandler);

    const response = await request(app).get('/failure');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: { message: 'Bad request' } });
  });
});
