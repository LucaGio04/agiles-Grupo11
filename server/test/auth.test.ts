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

type CreateArgs = {
  data: { nombre: string; email: string; passwordHash: string; carrera: string };
  select?: Record<string, boolean>;
};
const create = mock.fn(async ({ data, select }: CreateArgs) => {
  const created = { id: 2, ...data, createdAt: new Date() };
  if (!select) return created;
  return Object.fromEntries(
    Object.keys(select).map((k) => [k, created[k as keyof typeof created]])
  );
});

Object.defineProperty(prisma, 'user', { value: { findUnique, create }, configurable: true });

const server = createApp().listen(0);
let baseUrl = '';

type ErrorResponse = {
  error: { code: string; message: string; details?: { field: string; message: string }[] };
};

const register = (body: unknown) =>
  fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

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

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    findUnique.mock.resetCalls();
    create.mock.resetCalls();
  });

  const validRegisterPayload = {
    nombre: 'Luca Giordano',
    email: 'luca.nuevo@utn.edu.ar',
    password: 'PasswordSegura123',
    carrera: 'Ingeniería en Sistemas',
  };

  it('con datos válidos devuelve 201 con el usuario y un token de sesión', async () => {
    const res = await register(validRegisterPayload);
    assert.equal(res.status, 201);

    const body = (await res.json()) as {
      user: { id: number; nombre: string; email: string; carrera: string };
      token: string;
    };
    assert.equal(body.user.nombre, validRegisterPayload.nombre);
    assert.equal(body.user.email, validRegisterPayload.email);
    assert.equal(body.user.carrera, validRegisterPayload.carrera);
    assert.ok(body.token);

    const payload = jwt.verify(body.token, process.env.JWT_SECRET!) as jwt.JwtPayload;
    assert.equal(payload.sub, '2');
    assert.equal(payload.exp! - payload.iat!, 24 * 60 * 60);
  });

  it('nunca devuelve el hash de la contraseña en la respuesta', async () => {
    const res = await register(validRegisterPayload);
    const text = await res.text();
    assert.ok(!text.includes('passwordHash'));
    assert.ok(!text.includes(validRegisterPayload.password));
  });

  it('normaliza el email guardándolo en minúsculas y sin espacios', async () => {
    await register({
      ...validRegisterPayload,
      email: '  LUCA.MAYUSCULAS@UTN.EDU.AR  ',
    });

    const call = create.mock.calls[0];
    assert.equal(call.arguments[0].data.email, 'luca.mayusculas@utn.edu.ar');
  });

  it('hashea la contraseña con bcrypt (al menos 10 rondas)', async () => {
    await register(validRegisterPayload);
    const call = create.mock.calls[0];
    const passwordHash = call.arguments[0].data.passwordHash;

    assert.ok(passwordHash.startsWith('$2'));
    assert.ok(await bcrypt.compare(validRegisterPayload.password, passwordHash));
  });

  it('dado un email no institucional responde 400 y mensaje "Usá tu mail institucional"', async () => {
    const res = await register({
      ...validRegisterPayload,
      email: 'alumno@gmail.com',
    });

    assert.equal(res.status, 400);
    const body = (await res.json()) as ErrorResponse;
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    const emailIssue = body.error.details?.find((d) => d.field.includes('email'));
    assert.equal(emailIssue?.message, 'Usá tu mail institucional');
    assert.equal(create.mock.callCount(), 0);
  });

  it('dado un email ya registrado responde 409 y mensaje "Ese email ya tiene una cuenta"', async () => {
    const res = await register({
      ...validRegisterPayload,
      email: dbUser.email,
    });

    assert.equal(res.status, 409);
    const body = (await res.json()) as ErrorResponse;
    assert.equal(body.error.code, 'CONFLICT');
    assert.equal(body.error.message, 'Ese email ya tiene una cuenta');
    assert.equal(create.mock.callCount(), 0);
  });

  it('dada una contraseña de menos de 8 caracteres responde 400', async () => {
    const res = await register({
      ...validRegisterPayload,
      password: '1234567',
    });

    assert.equal(res.status, 400);
    const body = (await res.json()) as ErrorResponse;
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    const pwdIssue = body.error.details?.find((d) => d.field.includes('password'));
    assert.equal(pwdIssue?.message, 'La contraseña debe tener al menos 8 caracteres');
    assert.equal(create.mock.callCount(), 0);
  });
});
