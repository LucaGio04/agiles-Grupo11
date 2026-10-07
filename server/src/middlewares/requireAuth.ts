import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../errors/AppError.js';
import { verifyToken } from '../lib/jwt.js';

// Protege rutas que requieren usuario logueado. Lee `Authorization: Bearer <token>`,
// verifica firma y expiración y deja el usuario en `req.user` para el controller.
// Sin token, o con un token vencido o adulterado, responde 401 UNAUTHORIZED.
export const requireAuth: RequestHandler = (req, _res, next) => {
  const [scheme, token] = req.headers.authorization?.split(' ') ?? [];

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    next(AppError.unauthorized('Falta el token de autenticación'));
    return;
  }

  try {
    req.user = verifyToken(token);
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      next(AppError.unauthorized('La sesión expiró, volvé a iniciar sesión'));
      return;
    }
    if (err instanceof jwt.JsonWebTokenError) {
      next(AppError.unauthorized('Token inválido'));
      return;
    }
    // Por ejemplo, falta JWT_SECRET: es un error de configuración, no del cliente.
    next(err);
  }
};
