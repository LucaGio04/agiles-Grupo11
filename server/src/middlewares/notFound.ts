import type { RequestHandler } from 'express';
import { AppError } from '../errors/AppError.js';

// Se registra después de todas las rutas: si ninguna respondió, es un 404.
export const notFound: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`Ruta no encontrada: ${req.method} ${req.path}`));
};
