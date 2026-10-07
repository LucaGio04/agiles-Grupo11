import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { signToken } from '../src/lib/jwt.js';
import { requireAuth } from '../src/middlewares/requireAuth.js';

const SECRET = 'secreto-de-prueba';
process.env.JWT_SECRET = SECRET;

const user = { id: 7, email: 'tomas@utn.edu.ar' };

// Ruta protegida solo para los tests: devuelve el usuario que dejó el middleware.
const testRouter = Router();
testRouter.get('/test/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

const server = createApp(testRouter).listen(0);
let baseUrl = '';

type ErrorResponse = {
  error: { code: string; message: string; details?: unknown };
};

const getMe = (authorization?: string) =>
  fetch(`${baseUrl}/api/test/me`, {
    headers: authorization ? { Authorization: authorization } : {},
  });

async function assertUnauthorized(res: Response) {
  assert.equal(res.status, 401);
  const body = (await res.json()) as ErrorResponse;
  assert.equal(body.error.code, 'UNAUTHORIZED');
  assert.equal(typeof body.error.message, 'string');
}

describe('middleware requireAuth', () => {
  before(async () => {
    if (!server.listening) await once(server, 'listening');
    baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  });

  after(() => {
    server.close();
  });

  it('sin token responde 401 UNAUTHORIZED', async () => {
    await assertUnauthorized(await getMe());
  });

  it('con un header que no es Bearer responde 401', async () => {
    await assertUnauthorized(await getMe(signToken(user)));
    await assertUnauthorized(await getMe(`Basic ${signToken(user)}`));
    await assertUnauthorized(await getMe('Bearer'));
  });

  it('con un token vencido responde 401', async () => {
    const expired = jwt.sign({ email: user.email }, SECRET, {
      subject: String(user.id),
      expiresIn: -10,
    });
    await assertUnauthorized(await getMe(`Bearer ${expired}`));
  });

  it('con un token adulterado responde 401', async () => {
    // Payload modificado sin volver a firmar.
    const [header, , signature] = signToken(user).split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ email: 'otro@utn.edu.ar', sub: '1', exp: 9999999999 })
    ).toString('base64url');
    await assertUnauthorized(await getMe(`Bearer ${header}.${forgedPayload}.${signature}`));

    // Firmado con otro secreto.
    const otherSecret = jwt.sign({ email: user.email }, 'otro-secreto', { subject: '7' });
    await assertUnauthorized(await getMe(`Bearer ${otherSecret}`));

    // Sin firma (alg "none").
    const unsigned = jwt.sign({ email: user.email }, '', { subject: '7', algorithm: 'none' });
    await assertUnauthorized(await getMe(`Bearer ${unsigned}`));

    await assertUnauthorized(await getMe('Bearer esto-no-es-un-jwt'));
  });

  it('con un token válido el request continúa y el controller recibe el usuario', async () => {
    const res = await getMe(`Bearer ${signToken(user)}`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { user });
  });

  it('el token generado expira en 24 h', () => {
    const payload = jwt.decode(signToken(user)) as jwt.JwtPayload;
    assert.equal(payload.exp! - payload.iat!, 24 * 60 * 60);
    assert.equal(payload.sub, '7');
  });
});
