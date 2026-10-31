import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import { createApp } from '../src/app.js';
import { signToken } from '../src/lib/jwt.js';
import { prisma } from '../src/lib/prisma.js';

const createdAt = new Date('2026-03-01T12:00:00.000Z');

type UserArgs = { where: { id: number }; select?: Record<string, boolean> };
type ItemArgs = {
  where: { ownerId?: number; estado?: string };
  orderBy?: unknown;
  select?: Record<string, boolean>;
};
type RatingFindArgs = {
  where: { evaluadoId?: number };
  orderBy?: unknown;
  take?: number;
  select?: { evaluador?: { select?: Record<string, boolean> } };
};
type CountArgs = {
  where: { estado?: string; OR?: { proponenteId?: number; receptorId?: number }[] };
};

let userResult: Record<string, unknown> | null = null;
let promedio: number | null = 4.25;
let cantidadResenas = 3;
let intercambios = 2;
let itemsResult: unknown[] = [];
let ratingsResult: unknown[] = [];

const findUnique = mock.fn<(args: UserArgs) => Promise<typeof userResult>>(async () => userResult);
const aggregate = mock.fn(async () => ({ _avg: { puntaje: promedio }, _count: cantidadResenas }));
const findRatings = mock.fn<(args: RatingFindArgs) => Promise<unknown[]>>(
  async () => ratingsResult
);
const countProposals = mock.fn<(args: CountArgs) => Promise<number>>(async () => intercambios);
const findMany = mock.fn<(args: ItemArgs) => Promise<unknown[]>>(async () => itemsResult);

Object.defineProperty(prisma, 'user', {
  value: { findUnique },
  configurable: true,
});
Object.defineProperty(prisma, 'rating', {
  value: { aggregate, findMany: findRatings },
  configurable: true,
});
Object.defineProperty(prisma, 'proposal', {
  value: { count: countProposals },
  configurable: true,
});
Object.defineProperty(prisma, 'item', {
  value: { findMany },
  configurable: true,
});

const server = createApp().listen(0);
let baseUrl = '';
const token = signToken({ id: 1, email: 'tomas@utn.edu.ar' });

type ErrorResponse = {
  error: { code: string; message: string; details?: { field: string; message: string }[] };
};

type ProfileResponse = {
  data: {
    id: number;
    nombre: string;
    carrera: string;
    createdAt: string;
    reputacionPromedio: number | null;
    cantidadResenas: number;
    cantidadIntercambios: number;
    items: { id: number; estado: string }[];
    ultimasCalificaciones: {
      id: number;
      puntaje: number;
      comentario: string | null;
      evaluador: { id: number; nombre: string };
    }[];
  };
};

const getProfile = (id: string, authToken: string | null = token) =>
  fetch(`${baseUrl}/api/users/${id}`, {
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
  });

const listMine = () =>
  fetch(`${baseUrl}/api/users/me/items`, {
    headers: { Authorization: `Bearer ${token}` },
  });

function keysOf(value: unknown, keys = new Set<string>()) {
  if (Array.isArray(value)) {
    for (const item of value) keysOf(item, keys);
    return keys;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      keys.add(key);
      keysOf(nested, keys);
    }
  }
  return keys;
}

before(async () => {
  if (!server.listening) await once(server, 'listening');
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
});

describe('GET /api/users/:id', () => {
  beforeEach(() => {
    findUnique.mock.resetCalls();
    aggregate.mock.resetCalls();
    findRatings.mock.resetCalls();
    countProposals.mock.resetCalls();
    findMany.mock.resetCalls();
    userResult = {
      id: 7,
      nombre: 'Ana Demo',
      carrera: 'Ingeniería en Sistemas',
      createdAt,
    };
    promedio = 4.25;
    cantidadResenas = 3;
    intercambios = 2;
    itemsResult = [
      {
        id: 4,
        titulo: 'Apunte de álgebra',
        descripcion: null,
        categoria: 'APUNTE',
        estadoConservacion: 'BUENO',
        materia: 'Álgebra',
        fotoUrl: null,
        estado: 'DISPONIBLE',
        ownerId: 7,
        createdAt,
        updatedAt: createdAt,
      },
    ];
    ratingsResult = [
      {
        id: 9,
        puntaje: 5,
        comentario: 'El intercambio fue claro.',
        createdAt,
        evaluador: { id: 2, nombre: 'Sofía Demo' },
      },
      {
        id: 8,
        puntaje: 4,
        comentario: null,
        createdAt,
        evaluador: { id: 3, nombre: 'Luis Demo' },
      },
    ];
  });

  it('devuelve el perfil público con el promedio redondeado a un decimal', async () => {
    const res = await getProfile('7');
    assert.equal(res.status, 200);
    const body = (await res.json()) as ProfileResponse;

    assert.equal(body.data.id, 7);
    assert.equal(body.data.nombre, 'Ana Demo');
    assert.equal(body.data.carrera, 'Ingeniería en Sistemas');
    assert.equal(body.data.createdAt, createdAt.toISOString());
    assert.equal(body.data.reputacionPromedio, 4.3);
    assert.equal(body.data.cantidadResenas, 3);
    assert.equal(body.data.cantidadIntercambios, 2);
    assert.deepEqual(
      body.data.items,
      itemsResult.map((item) => ({
        ...(item as object),
        createdAt: createdAt.toISOString(),
        updatedAt: createdAt.toISOString(),
      }))
    );
    assert.equal(body.data.ultimasCalificaciones.length, 2);
    assert.equal(body.data.ultimasCalificaciones[0].evaluador.nombre, 'Sofía Demo');

    const userQuery = findUnique.mock.calls.at(-1)!.arguments[0];
    assert.deepEqual(userQuery.where, { id: 7 });
    assert.deepEqual(userQuery.select, {
      id: true,
      nombre: true,
      carrera: true,
      createdAt: true,
    });
    assert.equal(userQuery.select.email, undefined);
    assert.equal(userQuery.select.passwordHash, undefined);

    assert.deepEqual(countProposals.mock.calls.at(-1)!.arguments[0].where, {
      estado: 'CONCRETADA',
      OR: [{ proponenteId: 7 }, { receptorId: 7 }],
    });
  });

  it('la respuesta no tiene email ni passwordHash en ninguna clave', async () => {
    const body = (await (await getProfile('7')).json()) as ProfileResponse;
    const keys = keysOf(body);
    assert.equal(keys.has('email'), false);
    assert.equal(keys.has('passwordHash'), false);
    assert.deepEqual(Object.keys(body.data.ultimasCalificaciones[0].evaluador).sort(), [
      'id',
      'nombre',
    ]);
  });

  it('pide solo ítems DISPONIBLE, del más reciente al más antiguo', async () => {
    await getProfile('7');
    const query = findMany.mock.calls.at(-1)!.arguments[0];
    assert.deepEqual(query.where, { ownerId: 7, estado: 'DISPONIBLE' });
    assert.deepEqual(query.orderBy, [{ createdAt: 'desc' }, { id: 'desc' }]);
    assert.equal(query.select.estado, true);
    assert.equal(query.select.email, undefined);
  });

  it('pide como máximo 5 calificaciones, las más recientes primero, y solo el nombre de quien calificó', async () => {
    await getProfile('7');
    const query = findRatings.mock.calls.at(-1)!.arguments[0];
    assert.deepEqual(query.where, { evaluadoId: 7 });
    assert.equal(query.take, 5);
    assert.deepEqual(query.orderBy, [{ createdAt: 'desc' }, { id: 'desc' }]);
    assert.deepEqual(query.select.evaluador.select, { id: true, nombre: true });
    assert.equal(query.select.evaluador.select.email, undefined);
    assert.equal(query.select.evaluador.select.passwordHash, undefined);
  });

  it('sin calificaciones el promedio es null y la cantidad es 0', async () => {
    promedio = null;
    cantidadResenas = 0;
    ratingsResult = [];

    const res = await getProfile('7');
    assert.equal(res.status, 200);
    const body = (await res.json()) as ProfileResponse;
    assert.equal(body.data.reputacionPromedio, null);
    assert.equal(body.data.cantidadResenas, 0);
    assert.deepEqual(body.data.ultimasCalificaciones, []);
  });

  it('el propio id responde igual que el de otra persona', async () => {
    userResult = { ...userResult, id: 1 };
    const res = await getProfile('1');
    assert.equal(res.status, 200);
    assert.deepEqual(findUnique.mock.calls.at(-1)!.arguments[0].where, { id: 1 });
  });

  it('si el usuario no existe responde 404 y no sigue consultando', async () => {
    userResult = null;
    const res = await getProfile('999');
    assert.equal(res.status, 404);
    const { error } = (await res.json()) as ErrorResponse;
    assert.equal(error.code, 'NOT_FOUND');
    assert.equal(error.message, 'No encontramos a ese estudiante');
    assert.equal(aggregate.mock.callCount(), 0);
    assert.equal(findMany.mock.callCount(), 0);
    assert.equal(findRatings.mock.callCount(), 0);
    assert.equal(countProposals.mock.callCount(), 0);
  });

  for (const id of ['abc', '7.5', '0', '-3']) {
    it(`con el id inválido "${id}" responde 400 y no consulta la base`, async () => {
      const res = await getProfile(id);
      assert.equal(res.status, 400);
      const { error } = (await res.json()) as ErrorResponse;
      assert.equal(error.code, 'VALIDATION_ERROR');
      assert.deepEqual(error.details, [
        { field: 'params.id', message: 'El id del usuario no es válido' },
      ]);
      assert.equal(findUnique.mock.callCount(), 0);
      assert.equal(findMany.mock.callCount(), 0);
    });
  }

  it('sin token responde 401', async () => {
    const res = await getProfile('7', null);
    assert.equal(res.status, 401);
    assert.equal(((await res.json()) as ErrorResponse).error.code, 'UNAUTHORIZED');
    assert.equal(findUnique.mock.callCount(), 0);
  });

  it('GET /api/users/me/items sigue respondiendo y no cae en /:id', async () => {
    itemsResult = [{ id: 4, titulo: 'Apunte', estado: 'PAUSADO', ownerId: 1 }];
    const res = await listMine();
    assert.equal(res.status, 200);
    const body = (await res.json()) as { data: { id: number }[] };
    assert.equal(body.data[0].id, 4);
    assert.deepEqual(findMany.mock.calls.at(-1)!.arguments[0].where, {
      ownerId: 1,
      estado: { not: 'ELIMINADO' },
    });
    assert.equal(findUnique.mock.callCount(), 0);
  });
});
