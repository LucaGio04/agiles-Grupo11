import { Router } from 'express';
import * as profileController from '../controllers/profile.controller.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { validate } from '../middlewares/validate.js';
import { updateProfileSchema } from '../schemas/profile.schema.js';

// Perfil propio (HU-11), montado en /api/users/me. No hay id en la URL: siempre es el del token.
const router = Router();

router.get('/', requireAuth, profileController.getMine);
router.patch(
  '/',
  requireAuth,
  validate({ body: updateProfileSchema }),
  profileController.updateMine
);

export default router;
