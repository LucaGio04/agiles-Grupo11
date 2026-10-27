import { Router } from 'express';
import authRoutes from './auth.routes.js';
import healthRoutes from './health.routes.js';
import itemRoutes from './item.routes.js';

// Router raíz de la API (montado en /api). Cada recurso suma acá su propio router.
const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/items', itemRoutes);

export default router;
