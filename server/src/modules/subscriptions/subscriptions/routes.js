import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize } from '../../../middleware/auth.js';
import { validate } from '../../../middleware/validate.js';
import { createSubscriptionSchema, listSubscriptionsSchema, subscriptionIdSchema, updateSubscriptionSchema } from './validation.js';
import { createSubscription, getSubscription, listSubscriptions, updateSubscription } from './service.js';

const defaultPrisma = new PrismaClient();

export function createSubscriptionsRouter(prisma = defaultPrisma, middleware = { authenticate, authorize }) {
  const router = Router();
  router.use(middleware.authenticate);
  router.get('/', middleware.authorize('ADMIN', 'STAFF'), validate(listSubscriptionsSchema, 'query'), async (req, res, next) => {
    try { res.json(await listSubscriptions(prisma, req.query)); } catch (error) { next(error); }
  });
  router.post('/', middleware.authorize('ADMIN', 'STAFF'), validate(createSubscriptionSchema), async (req, res, next) => {
    try { res.status(201).json({ subscription: await createSubscription(prisma, req.body) }); } catch (error) { next(error); }
  });
  router.get('/:id', middleware.authorize('ADMIN', 'STAFF'), validate(subscriptionIdSchema, 'params'), async (req, res, next) => {
    try { res.json({ subscription: await getSubscription(prisma, req.params.id) }); } catch (error) { next(error); }
  });
  router.put('/:id', middleware.authorize('ADMIN', 'STAFF'), validate(subscriptionIdSchema, 'params'), validate(updateSubscriptionSchema), async (req, res, next) => {
    try { res.json({ subscription: await updateSubscription(prisma, req.params.id, req.body) }); } catch (error) { next(error); }
  });
  return router;
}

export default createSubscriptionsRouter();
