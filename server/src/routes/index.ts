import { Router } from 'express';
import healthRoutes from './health.routes.js';

// Router raíz de la API (montado en /api). Cada recurso suma acá su propio router.
const router = Router();

router.use('/health', healthRoutes);

export default router;
