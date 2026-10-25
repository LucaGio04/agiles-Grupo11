import { Router } from 'express';
import * as itemController from '../controllers/item.controller.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { validate } from '../middlewares/validate.js';
import { createItemSchema } from '../schemas/item.schema.js';

const router = Router();

router.post('/', requireAuth, validate({ body: createItemSchema }), itemController.create);

export default router;
