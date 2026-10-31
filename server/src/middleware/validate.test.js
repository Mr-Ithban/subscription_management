import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { validate } from './validate.js';

describe('validate middleware', () => {
  it('returns field errors for invalid query input', async () => {
    const app = express();
    app.get('/items', validate(z.object({ page: z.coerce.number().int().positive() }), 'query'), (req, res) =>
      res.json(req.query)
    );
    const response = await request(app).get('/items?page=invalid');

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('Expected number');
    expect(response.body.error.details).toEqual([
      { field: 'page', message: expect.any(String) },
    ]);
  });

  it('replaces the request source with parsed Zod data', async () => {
    const app = express();
    app.use(express.json());
    app.post('/items', validate(z.object({ name: z.string().trim() })), (req, res) =>
      res.json(req.body)
    );
    const response = await request(app).post('/items').send({ name: '  item  ' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ name: 'item' });
  });

  it('rejects unsupported request sources during route setup', () => {
    expect(() => validate(z.object({}), 'headers')).toThrow(
      "validate source must be 'body', 'query', or 'params'"
    );
  });
});
