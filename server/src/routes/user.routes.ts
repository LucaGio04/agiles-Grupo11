import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { validate } from '../middlewares/validate.js';
import { listMyItemsQuerySchema } from '../schemas/user.schema.js';

const router = Router();

router.get(
  '/me/items',
  requireAuth,
  validate({ query: listMyItemsQuerySchema }),
  userController.listMyItems
);

export default router;
