import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import { createApp } from '../src/app.js';
import { signToken } from '../src/lib/jwt.js';
import { prisma } from '../src/lib/prisma.js';

// Perfil propio (HU-11). Prisma se mockea como en los otros tests: se reemplaza el delegate
// completo porque el cliente es un Proxy.
const createdAt = new Date('2026-09-20T15:00:00.000Z');
const storedUser = {
  id: 1,
  nombre: 'Tomás Bellizzi',
  email: 'tomas@utn.edu.ar',
  carrera: 'Ingeniería en Sistemas',
  createdAt,
};

type Select = Record<string, boolean>;
const pick = (select: Select) =>
  Object.fromEntries(Object.keys(select).map((k) => [k, storedUser[k as keyof typeof storedUser]]));

const findUnique = mock.fn(async ({ where, select }: { where: { id: number }; select: Select }) =>
  where.id === storedUser.id ? pick(select) : null
);
const update = mock.fn(
  async ({
    data,
    select,
  }: {
    where: { id: number };
    data: Partial<typeof storedUser>;
    select: Select;
  }) => ({
    ...pick(select),
    ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)),
  })
);
let ratings = { _avg: { puntaje: null as number | null }, _count: 0 };
const aggregate = mock.fn<(args: { where: { evaluadoId: number } }) => Promise<typeof ratings>>(
  async () => ratings
);
let concretados = 0;
const count = mock.fn<(args: { where: Record<string, unknown> }) => Promise<number>>(
  async () => concretados
);

Object.defineProperty(prisma, 'user', { value: { findUnique, update }, configurable: true });
Object.defineProperty(prisma, 'rating', { value: { aggregate }, configurable: true });
Object.defineProperty(prisma, 'proposal', { value: { count }, configurable: true });

const server = createApp().listen(0);
let baseUrl = '';
const token = signToken({ id: 1, email: storedUser.email });

type ErrorResponse = {
  error: { code: string; message: string; details?: { field: string; message: string }[] };
};
type ProfileResponse = {
  user: Record<string, unknown>;
  reputacion: { promedio: number | null; cantidad: number };
  intercambiosConcretados: number;
};

const getProfile = (authToken: string | null = token) =>
  fetch(`${baseUrl}/api/users/me`, {
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
  });

const patchProfile = (body: unknown, authToken: string | null = token) =>
  fetch(`${baseUrl}/api/users/me`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify(body),
  });

before(async () => {
  if (!server.listening) await once(server, 'listening');
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
});

beforeEach(() => {
  for (const fn of [findUnique, update, aggregate, count]) fn.mock.resetCalls();
  ratings = { _avg: { puntaje: null }, _count: 0 };
  concretados = 0;
});

describe('GET /api/users/me', () => {
  it('devuelve nombre, email, carrera, fecha de alta, reputación e intercambios concretados', async () => {
    ratings = { _avg: { puntaje: 4.5 }, _count: 2 };
    concretados = 3;

    const res = await getProfile();
    assert.equal(res.status, 200);
    const body = (await res.json()) as ProfileResponse;
    assert.deepEqual(body, {
      user: { ...storedUser, createdAt: createdAt.toISOString() },
      reputacion: { promedio: 4.5, cantidad: 2 },
      intercambiosConcretados: 3,
    });
  });

  it('calcula la reputación con las calificaciones recibidas y cuenta los intercambios como proponente o receptor', async () => {
    await getProfile();
    assert.deepEqual(aggregate.mock.calls[0].arguments[0].where, { evaluadoId: 1 });
    assert.deepEqual(count.mock.calls[0].arguments[0].where, {
      estado: 'CONCRETADA',
      OR: [{ proponenteId: 1 }, { receptorId: 1 }],
    });
  });

  it('sin calificaciones devuelve promedio null y cantidad 0', async () => {
    const body = (await (await getProfile()).json()) as ProfileResponse;
    assert.deepEqual(body.reputacion, { promedio: null, cantidad: 0 });
    assert.equal(body.intercambiosConcretados, 0);
  });

  it('nunca devuelve la contraseña', async () => {
    const text = await (await getProfile()).text();
    assert.ok(!text.includes('passwordHash'));
  });

  it('sin token responde 401', async () => {
    const res = await getProfile(null);
    assert.equal(res.status, 401);
    assert.equal(findUnique.mock.callCount(), 0);
  });

  it('si el usuario del token ya no existe responde 401', async () => {
    const res = await getProfile(signToken({ id: 99, email: 'borrado@utn.edu.ar' }));
    assert.equal(res.status, 401);
  });
});

describe('PATCH /api/users/me', () => {
  it('actualiza nombre y carrera del usuario del token y devuelve el perfil actualizado', async () => {
    const res = await patchProfile({ nombre: '  Tomás B.  ', carrera: 'Ingeniería Civil' });
    assert.equal(res.status, 200);

    const call = update.mock.calls[0].arguments[0];
    assert.deepEqual(call.where, { id: 1 });
    assert.deepEqual(call.data, { nombre: 'Tomás B.', carrera: 'Ingeniería Civil' });

    const body = (await res.json()) as ProfileResponse;
    assert.equal(body.user.nombre, 'Tomás B.');
    assert.equal(body.user.carrera, 'Ingeniería Civil');
    assert.equal(body.user.email, storedUser.email);
    assert.ok('reputacion' in body && 'intercambiosConcretados' in body);
  });

  it('se puede editar un solo campo', async () => {
    const res = await patchProfile({ carrera: 'Ingeniería Química' });
    assert.equal(res.status, 200);
    assert.deepEqual(update.mock.calls[0].arguments[0].data, {
      nombre: undefined,
      carrera: 'Ingeniería Química',
    });
  });

  it('el email no se puede modificar', async () => {
    const res = await patchProfile({ nombre: 'Tomás', email: 'otro@utn.edu.ar' });
    assert.equal(res.status, 400);
    const { error } = (await res.json()) as ErrorResponse;
    assert.deepEqual(error.details, [
      { field: 'body.email', message: 'El email no se puede modificar' },
    ]);
    assert.equal(update.mock.callCount(), 0);
  });

  it('ignora cualquier otro campo, como el id o la contraseña', async () => {
    await patchProfile({ nombre: 'Tomás', id: 2, passwordHash: 'x' });
    const call = update.mock.calls[0].arguments[0];
    assert.deepEqual(call.where, { id: 1 });
    assert.deepEqual(Object.keys(call.data).sort(), ['carrera', 'nombre']);
  });

  it('rechaza con 400 un nombre o una carrera vacíos o demasiado largos', async () => {
    for (const [body, field, message] of [
      [{ nombre: '   ' }, 'body.nombre', 'Ingresá tu nombre'],
      [{ carrera: '' }, 'body.carrera', 'Ingresá tu carrera'],
      [{ nombre: 'a'.repeat(81) }, 'body.nombre', 'El nombre puede tener hasta 80 caracteres'],
      [{ carrera: 'a'.repeat(101) }, 'body.carrera', 'La carrera puede tener hasta 100 caracteres'],
    ] as const) {
      const res = await patchProfile(body);
      assert.equal(res.status, 400, field);
      const { error } = (await res.json()) as ErrorResponse;
      assert.deepEqual(error.details, [{ field, message }]);
    }
    assert.equal(update.mock.callCount(), 0);
  });

  it('sin nombre ni carrera responde 400', async () => {
    const res = await patchProfile({});
    assert.equal(res.status, 400);
    const { error } = (await res.json()) as ErrorResponse;
    assert.equal(error.details?.[0].message, 'Enviá el nombre o la carrera para actualizar');
  });

  it('sin token responde 401', async () => {
    const res = await patchProfile({ nombre: 'Tomás' }, null);
    assert.equal(res.status, 401);
    assert.equal(update.mock.callCount(), 0);
  });
});
