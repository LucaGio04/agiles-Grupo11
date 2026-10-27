import { Router } from 'express';
import * as itemController from '../controllers/item.controller.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { validate } from '../middlewares/validate.js';
import { listItemsQuerySchema } from '../schemas/item.schema.js';

const router = Router();

router.get('/', requireAuth, validate({ query: listItemsQuerySchema }), itemController.list);

export default router;
