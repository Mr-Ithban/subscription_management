import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { createAuthenticate } from '../../../middleware/authenticate.js';
import { authorize } from '../../../middleware/authorize.js';
import { validate } from '../../../middleware/validate.js';
import { createSubscriptionSchema, listSubscriptionsSchema, subscriptionIdSchema, transitionBodySchema, updateSubscriptionSchema } from './validation.js';
import { createSubscription, getSubscription, listSubscriptions, statusForTransitionAction, transitionSubscription, updateSubscription } from './service.js';

const defaultPrisma = new PrismaClient();

export function createSubscriptionsRouter(prisma = defaultPrisma, middleware = {}) {
  const router = Router();
  router.use(middleware.authenticate ?? createAuthenticate(prisma));
  const authorizeRequest = middleware.authorize ?? authorize;
  router.get('/', authorizeRequest('ADMIN', 'STAFF'), validate(listSubscriptionsSchema, 'query'), async (req, res, next) => {
    try { res.json(await listSubscriptions(prisma, req.query)); } catch (error) { next(error); }
  });
  router.post('/', authorizeRequest('ADMIN', 'STAFF'), validate(createSubscriptionSchema), async (req, res, next) => {
    try { res.status(201).json({ subscription: await createSubscription(prisma, req.body) }); } catch (error) { next(error); }
  });
  router.get('/:id', authorizeRequest('ADMIN', 'STAFF'), validate(subscriptionIdSchema, 'params'), async (req, res, next) => {
    try { res.json({ subscription: await getSubscription(prisma, req.params.id) }); } catch (error) { next(error); }
  });
  router.put('/:id', authorizeRequest('ADMIN', 'STAFF'), validate(subscriptionIdSchema, 'params'), validate(updateSubscriptionSchema), async (req, res, next) => {
    try { res.json({ subscription: await updateSubscription(prisma, req.params.id, req.body) }); } catch (error) { next(error); }
  });
  for (const action of ['quote', 'confirm', 'activate', 'close']) {
    router.post(`/:id/${action}`, authorizeRequest('ADMIN', 'STAFF'), validate(subscriptionIdSchema, 'params'), validate(transitionBodySchema), async (req, res, next) => {
      try {
        const subscription = await transitionSubscription(prisma, req.params.id, statusForTransitionAction(action), {
          changedById: req.user?.id ?? null,
          note: req.body.note ?? null,
        });
        res.json({ subscription });
      } catch (error) { next(error); }
    });
  }
  return router;
}

export default createSubscriptionsRouter();
