import jwt from 'jsonwebtoken';

// Usuario autenticado que viaja en el token y que los controllers leen de `req.user`.
export type AuthUser = { id: number; email: string };

const EXPIRES_IN = '24h';
const ALGORITHM = 'HS256';

// Se lee en cada uso (y no al importar) para que la app arranque aunque la ruta no use auth,
// y para que los tests puedan definir el secreto antes de firmar.
function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Falta la variable de entorno JWT_SECRET (ver server/.env.example)');
  }
  return secret;
}

// Genera el token de sesión que se devuelve al hacer login. Expira en 24 h.
export function signToken(user: AuthUser) {
  return jwt.sign({ email: user.email }, getSecret(), {
    subject: String(user.id),
    expiresIn: EXPIRES_IN,
    algorithm: ALGORITHM,
  });
}

// Verifica firma y expiración. Lanza un error de `jsonwebtoken` si el token es inválido.
export function verifyToken(token: string): AuthUser {
  const payload = jwt.verify(token, getSecret(), { algorithms: [ALGORITHM] });

  if (typeof payload === 'string' || typeof payload.email !== 'string') {
    throw new jwt.JsonWebTokenError('Payload de token inválido');
  }
  const id = Number(payload.sub);
  if (!Number.isInteger(id)) {
    throw new jwt.JsonWebTokenError('Payload de token inválido');
  }
  return { id, email: payload.email };
}
