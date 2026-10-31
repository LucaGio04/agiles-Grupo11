import { Router } from 'express';
import * as itemController from '../controllers/item.controller.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { validate } from '../middlewares/validate.js';
import {
  createItemSchema,
  itemIdParamsSchema,
  listItemsQuerySchema,
  updateItemSchema,
} from '../schemas/item.schema.js';

const router = Router();

router.get('/', requireAuth, validate({ query: listItemsQuerySchema }), itemController.list);
router.post('/', requireAuth, validate({ body: createItemSchema }), itemController.create);
router.get('/:id', requireAuth, validate({ params: itemIdParamsSchema }), itemController.getById);
// Elimina lógicamente el ítem propio (HU-15). Requiere ser el dueño; responde 204 en éxito.
router.delete('/:id', requireAuth, validate({ params: itemIdParamsSchema }), itemController.remove);
router.patch(
  '/:id',
  requireAuth,
  validate({ params: itemIdParamsSchema, body: updateItemSchema }),
  itemController.update
);

export default router;
