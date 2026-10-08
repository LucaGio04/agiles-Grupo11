import type { ErrorRequestHandler } from 'express';
import { AppError } from '../errors/AppError.js';

type ErrorBody = {
  error: { code: string; message: string; details?: unknown };
};

// Errores que lanzan express.json() y otros middlewares de Express (traen `status` y `type`).
function isHttpError(err: unknown): err is Error & { status: number; type?: string } {
  return err instanceof Error && typeof (err as { status?: unknown }).status === 'number';
}

// Middleware global de errores. Toda respuesta de error de la API sale de acá
// con el formato { error: { code, message, details? } }.
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof AppError) {
    const body: ErrorBody = { error: { code: err.code, message: err.message } };
    if (err.details !== undefined) body.error.details = err.details;
    res.status(err.statusCode).json(body);
    return;
  }

  if (isHttpError(err) && err.status >= 400 && err.status < 500) {
    const invalidJson = err.type === 'entity.parse.failed';
    res.status(err.status).json({
      error: {
        code: invalidJson ? 'INVALID_JSON' : 'BAD_REQUEST',
        message: invalidJson ? 'El body no es un JSON válido' : err.message,
      },
    } satisfies ErrorBody);
    return;
  }

  console.error(err);

  const body: ErrorBody = {
    error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' },
  };
  // El detalle del error (mensaje y stack) solo se expone fuera de producción.
  if (process.env.NODE_ENV !== 'production' && err instanceof Error) {
    body.error.details = { message: err.message, stack: err.stack };
  }
  res.status(500).json(body);
};
