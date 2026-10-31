import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { createAuthenticate } from '../../../middleware/authenticate.js';
import { authorize } from '../../../middleware/authorize.js';
import { validate } from '../../../middleware/validate.js';
import { createSubscriptionFromTemplateSchema, createTemplateSchema, templateIdSchema, updateTemplateSchema } from './validation.js';
import { createSubscriptionFromTemplate, createTemplate, deleteTemplate, getTemplate, listTemplates, updateTemplate } from './service.js';

const defaultPrisma = new PrismaClient();

export function createTemplatesRouter(prisma = defaultPrisma, middleware = {}) {
  const router = Router();
  router.use(middleware.authenticate ?? createAuthenticate(prisma));
  const authorizeRequest = middleware.authorize ?? authorize;
  router.get('/', authorizeRequest('ADMIN', 'STAFF'), async (_req, res, next) => {
    try { res.json({ templates: await listTemplates(prisma) }); } catch (error) { next(error); }
  });
  router.post('/', authorizeRequest('ADMIN', 'STAFF'), validate(createTemplateSchema), async (req, res, next) => {
    try { res.status(201).json({ template: await createTemplate(prisma, req.body) }); } catch (error) { next(error); }
  });
  router.post('/:id/create-subscription', authorizeRequest('ADMIN', 'STAFF'), validate(templateIdSchema, 'params'), validate(createSubscriptionFromTemplateSchema), async (req, res, next) => {
    try {
      const subscription = await createSubscriptionFromTemplate(prisma, req.params.id, req.body, req.user?.id ?? null);
      res.status(201).json({ subscription });
    } catch (error) { next(error); }
  });
  router.get('/:id', authorizeRequest('ADMIN', 'STAFF'), validate(templateIdSchema, 'params'), async (req, res, next) => {
    try { res.json({ template: await getTemplate(prisma, req.params.id) }); } catch (error) { next(error); }
  });
  router.put('/:id', authorizeRequest('ADMIN', 'STAFF'), validate(templateIdSchema, 'params'), validate(updateTemplateSchema), async (req, res, next) => {
    try { res.json({ template: await updateTemplate(prisma, req.params.id, req.body) }); } catch (error) { next(error); }
  });
  router.delete('/:id', authorizeRequest('ADMIN', 'STAFF'), validate(templateIdSchema, 'params'), async (req, res, next) => {
    try { res.json(await deleteTemplate(prisma, req.params.id)); } catch (error) { next(error); }
  });
  return router;
}

export default createTemplatesRouter();
