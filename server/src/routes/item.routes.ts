import { Router } from 'express';
import * as itemController from '../controllers/item.controller.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { validate } from '../middlewares/validate.js';
import { createItemSchema, itemIdParamsSchema } from '../schemas/item.schema.js';

const router = Router();

router.post('/', requireAuth, validate({ body: createItemSchema }), itemController.create);
router.get('/:id', requireAuth, validate({ params: itemIdParamsSchema }), itemController.getById);

export default router;
