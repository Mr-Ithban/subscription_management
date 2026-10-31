import express from 'express';
import request from 'supertest';
import { ownership } from './ownership.js';

function createApp(role, customerId, resourceOwners) {
  const app = express();
  app.use((req, _res, next) => {
    req.user = { role, customer: customerId ? { id: customerId } : null };
    next();
  });
  app.get(
    '/resources/:resourceId',
    ownership(async (req) => resourceOwners[req.params.resourceId]),
    (req, res) => res.status(200).json({ resourceId: req.params.resourceId })
  );
  return app;
}

describe('ownership middleware', () => {
  it('returns 404 when a customer requests another customer’s resource', async () => {
    const app = createApp('CUSTOMER', 'customer-1', { 'resource-2': 'customer-2' });
    const response = await request(app).get('/resources/resource-2');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { message: 'Resource not found' } });
  });

  it('allows a customer to access their own resource', async () => {
    const app = createApp('CUSTOMER', 'customer-1', { 'resource-1': 'customer-1' });
    const response = await request(app).get('/resources/resource-1');

    expect(response.status).toBe(200);
  });

  it.each(['ADMIN', 'STAFF'])('lets %s bypass customer ownership checks', async (role) => {
    const app = createApp(role, null, {});
    const response = await request(app).get('/resources/resource-2');

    expect(response.status).toBe(200);
  });
});
