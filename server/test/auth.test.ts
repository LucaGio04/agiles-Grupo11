import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { signToken } from '../src/lib/jwt.js';
import { prisma } from '../src/lib/prisma.js';

const PASSWORD = 'Trueque123';
const dbUser = {
  id: 1,
  nombre: 'Tomás Bellizzi',
  email: 'tomas@utn.edu.ar',
  carrera: 'Ingeniería en Sistemas',
  passwordHash: bcrypt.hashSync(PASSWORD, 10),
  createdAt: new Date(),
};
const publicUser = { id: 1, nombre: dbUser.nombre, email: dbUser.email, carrera: dbUser.carrera };

// Simula la tabla User con un solo usuario. El cliente de Prisma es un Proxy, por eso
// no se puede usar mock.method sobre prisma.user: se reemplaza el delegate completo.
type FindUniqueArgs = { where: { id?: number; email?: string }; select?: Record<string, boolean> };
const findUnique = mock.fn(async ({ where, select }: FindUniqueArgs) => {
  const match = where.email === dbUser.email || where.id === dbUser.id;
  if (!match) return null;
  if (!select) return dbUser;
  return Object.fromEntries(Object.keys(select).map((k) => [k, dbUser[k as keyof typeof dbUser]]));
});
Object.defineProperty(prisma, 'user', { value: { findUnique }, configurable: true });

const server = createApp().listen(0);
let baseUrl = '';

type ErrorResponse = { error: { code: string; message: string } };

const login = (body: unknown) =>
  fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const getMe = (token: string) =>
  fetch(`${baseUrl}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });

before(async () => {
  if (!server.listening) await once(server, 'listening');
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
});

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    findUnique.mock.resetCalls();
  });

  it('con credenciales correctas devuelve 200 con el usuario y un token', async () => {
    const res = await login({ email: dbUser.email, password: PASSWORD });
    assert.equal(res.status, 200);

    const body = (await res.json()) as { user: unknown; token: string };
    assert.deepEqual(body.user, publicUser);

    const payload = jwt.verify(body.token, process.env.JWT_SECRET!) as jwt.JwtPayload;
    assert.equal(payload.sub, '1');
    assert.equal(payload.exp! - payload.iat!, 24 * 60 * 60);
  });

  it('nunca devuelve el hash de la contraseña', async () => {
    const res = await login({ email: dbUser.email, password: PASSWORD });
    const text = await res.text();
    assert.ok(!text.includes('passwordHash'));
    assert.ok(!text.includes(dbUser.passwordHash));
  });

  it('normaliza el email (mayúsculas y espacios)', async () => {
    const res = await login({ email: '  TOMAS@utn.edu.ar ', password: PASSWORD });
    assert.equal(res.status, 200);
    assert.deepEqual(findUnique.mock.calls[0].arguments[0], { where: { email: dbUser.email } });
  });

  it('con contraseña incorrecta o email inexistente responde 401 con el mismo mensaje', async () => {
    const wrongPassword = await login({ email: dbUser.email, password: 'otra-clave' });
    const unknownEmail = await login({ email: 'nadie@utn.edu.ar', password: PASSWORD });

    for (const res of [wrongPassword, unknownEmail]) {
      assert.equal(res.status, 401);
    }
    const errors = [
      ((await wrongPassword.json()) as ErrorResponse).error,
      ((await unknownEmail.json()) as ErrorResponse).error,
    ];
    assert.deepEqual(errors[0], {
      code: 'INVALID_CREDENTIALS',
      message: 'Email o contraseña incorrectos',
    });
    assert.deepEqual(errors[1], errors[0]);
  });

  it('con campos faltantes o email mal formado responde 400', async () => {
    const res = await login({ email: 'no-es-email' });
    assert.equal(res.status, 400);
    assert.equal(((await res.json()) as ErrorResponse).error.code, 'VALIDATION_ERROR');
    assert.equal(findUnique.mock.callCount(), 0);
  });
});

describe('GET /api/auth/me', () => {
  it('con un token válido devuelve el usuario sin la contraseña', async () => {
    const res = await getMe(signToken({ id: dbUser.id, email: dbUser.email }));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { user: publicUser });
  });

  it('sin token responde 401', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`);
    assert.equal(res.status, 401);
  });

  it('si el usuario del token ya no existe responde 401', async () => {
    const res = await getMe(signToken({ id: 99, email: 'borrado@utn.edu.ar' }));
    assert.equal(res.status, 401);
    assert.equal(((await res.json()) as ErrorResponse).error.code, 'UNAUTHORIZED');
  });
});
