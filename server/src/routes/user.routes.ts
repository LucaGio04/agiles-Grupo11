import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { validate } from '../middlewares/validate.js';
import { listMyItemsQuerySchema, userIdParamsSchema } from '../schemas/user.schema.js';

const router = Router();

router.get(
  '/me/items',
  requireAuth,
  validate({ query: listMyItemsQuerySchema }),
  userController.listMyItems
);

// Después de /me/items: si esta ruta fuera primero, "me" se leería como un :id.
router.get(
  '/:id',
  requireAuth,
  validate({ params: userIdParamsSchema }),
  userController.getPublicProfile
);

export default router;
