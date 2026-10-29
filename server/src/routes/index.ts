import { Router } from 'express';
import authRoutes from './auth.routes.js';
import healthRoutes from './health.routes.js';
import itemRoutes from './item.routes.js';
import proposalRoutes from './proposal.routes.js';
import uploadRoutes from './upload.routes.js';
import userRoutes from './user.routes.js';

// Router raíz de la API (montado en /api). Cada recurso suma acá su propio router.
const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/items', itemRoutes);
router.use('/uploads', uploadRoutes);
router.use('/users', userRoutes);
router.use('/proposals', proposalRoutes);

export default router;
