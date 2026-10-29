import { Router } from 'express';
import * as uploadController from '../controllers/upload.controller.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { uploadImage } from '../middlewares/uploadImage.js';

const router = Router();

// requireAuth va primero: un request sin sesión se rechaza antes de leer el archivo.
router.post('/', requireAuth, uploadImage, uploadController.create);

export default router;
