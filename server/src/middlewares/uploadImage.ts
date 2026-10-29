import type { RequestHandler } from 'express';
import multer from 'multer';
import { AppError } from '../errors/AppError.js';
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from '../lib/uploads.js';

const INVALID_TYPE_MESSAGE = 'El archivo tiene que ser una imagen JPG, PNG o WebP';

// Las fotos se leen en memoria (máximo 5 MB) y el service las guarda recién después de
// comprobar su contenido real. Así nunca queda en disco un archivo que no sea una imagen.
const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype in ALLOWED_IMAGE_TYPES) {
      callback(null, true);
      return;
    }
    callback(new AppError(400, 'INVALID_FILE_TYPE', INVALID_TYPE_MESSAGE));
  },
}).single('file');

// Lee un único archivo del campo `file` (multipart/form-data) y deja el resultado en `req.file`.
// Traduce los errores de multer al formato estándar de la API.
export const uploadImage: RequestHandler = (req, res, next) => {
  parser(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof AppError) {
      next(err);
      return;
    }
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        next(
          new AppError(
            413,
            'FILE_TOO_LARGE',
            `La imagen supera el tamaño máximo de ${MAX_UPLOAD_BYTES / 1024 / 1024} MB`
          )
        );
        return;
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        next(AppError.badRequest('Enviá una sola imagen en el campo "file"'));
        return;
      }
    }
    // Cualquier otro fallo al leer el formulario (multipart mal formado, request cortado)
    // es un problema del pedido, no del servidor.
    next(AppError.badRequest('No pudimos leer el archivo enviado'));
  });
};
