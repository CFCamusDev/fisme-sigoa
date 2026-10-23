import { Router } from 'express';
import type { ReferenceItemController } from './reference-item.controller.js';
import { validateRequest } from '../../../../shared/middleware/validate-request.js';
import { createReferenceItemSchema } from './reference-item.schema.js';

export function createReferenceItemRouter(controller: ReferenceItemController): Router {
  const router = Router();

  router.post('/', validateRequest({ body: createReferenceItemSchema }), controller.create);

  return router;
}
