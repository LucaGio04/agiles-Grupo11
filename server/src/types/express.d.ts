import type { AuthUser } from '../lib/jwt.js';

// Agrega `req.user` al Request de Express. Lo completa el middleware requireAuth.
declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}
