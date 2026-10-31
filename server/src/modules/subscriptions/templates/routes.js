import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize } from '../../../middleware/auth.js';
import { validate } from '../../../middleware/validate.js';
import { createTemplateSchema, templateIdSchema, updateTemplateSchema } from './validation.js';
import { createTemplate, deleteTemplate, getTemplate, listTemplates, updateTemplate } from './service.js';

const defaultPrisma = new PrismaClient();

export function createTemplatesRouter(prisma = defaultPrisma, middleware = { authenticate, authorize }) {
  const router = Router();
  router.use(middleware.authenticate);
  router.get('/', middleware.authorize('ADMIN', 'STAFF'), async (_req, res, next) => {
    try { res.json({ templates: await listTemplates(prisma) }); } catch (error) { next(error); }
  });
  router.post('/', middleware.authorize('ADMIN', 'STAFF'), validate(createTemplateSchema), async (req, res, next) => {
    try { res.status(201).json({ template: await createTemplate(prisma, req.body) }); } catch (error) { next(error); }
  });
  router.get('/:id', middleware.authorize('ADMIN', 'STAFF'), validate(templateIdSchema, 'params'), async (req, res, next) => {
    try { res.json({ template: await getTemplate(prisma, req.params.id) }); } catch (error) { next(error); }
  });
  router.put('/:id', middleware.authorize('ADMIN', 'STAFF'), validate(templateIdSchema, 'params'), validate(updateTemplateSchema), async (req, res, next) => {
    try { res.json({ template: await updateTemplate(prisma, req.params.id, req.body) }); } catch (error) { next(error); }
  });
  router.delete('/:id', middleware.authorize('ADMIN', 'STAFF'), validate(templateIdSchema, 'params'), async (req, res, next) => {
    try { res.json(await deleteTemplate(prisma, req.params.id)); } catch (error) { next(error); }
  });
  return router;
}

export default createTemplatesRouter();
