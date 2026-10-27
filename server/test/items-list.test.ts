import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import { createApp } from '../src/app.js';
import { signToken } from '../src/lib/jwt.js';
import { prisma } from '../src/lib/prisma.js';

// Listado (HU-04): findMany devuelve lo que diga listResult y count, listTotal.
// Lo que importa en estos tests es qué filtros, orden y paginación se le piden a Prisma.
// El cliente de Prisma es un Proxy: se reemplaza el delegate completo (ver auth.test.ts).
type ListArgs = {
  where: { estado?: string; ownerId?: unknown; categoria?: string; OR?: unknown[] };
  orderBy?: unknown;
  skip?: number;
  take?: number;
};
let listResult: unknown[] = [];
let listTotal = 0;
const findMany = mock.fn<(args: ListArgs) => Promise<unknown[]>>(async () => listResult);
const count = mock.fn<(args: ListArgs) => Promise<number>>(async () => listTotal);

Object.defineProperty(prisma, 'item', { value: { findMany, count }, configurable: true });

const server = createApp().listen(0);
let baseUrl = '';
const token = signToken({ id: 1, email: 'tomas@utn.edu.ar' });

type ErrorResponse = {
  error: { code: string; message: string; details?: { field: string; message: string }[] };
};

const availableItem = {
  id: 7,
  titulo: 'Calculadora Casio fx-82',
  descripcion: null,
  categoria: 'CALCULADORA',
  estadoConservacion: 'BUENO',
  materia: 'Física I',
  fotoUrl: null,
  estado: 'DISPONIBLE',
  ownerId: 2,
  createdAt: new Date(),
  updatedAt: new Date(),
};

before(async () => {
  if (!server.listening) await once(server, 'listening');
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
});
describe('GET /api/items', () => {
  const listItems = (search = '', authToken: string | null = token) =>
    fetch(`${baseUrl}/api/items${search}`, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    });
  const lastQuery = () => findMany.mock.calls.at(-1)!.arguments[0];

  beforeEach(() => {
    findMany.mock.resetCalls();
    count.mock.resetCalls();
    listResult = [];
    listTotal = 0;
  });

  it('sin filtros lista los DISPONIBLES de otros usuarios, más recientes primero, de a 12', async () => {
    listResult = [availableItem];
    listTotal = 1;

    const res = await listItems();
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      data: unknown[];
      page: number;
      totalPages: number;
      total: number;
    };
    assert.equal(body.data.length, 1);
    assert.equal(body.page, 1);
    assert.equal(body.totalPages, 1);
    assert.equal(body.total, 1);

    const query = lastQuery();
    assert.deepEqual(query.where, { estado: 'DISPONIBLE', ownerId: { not: 1 } });
    assert.deepEqual(query.orderBy, [{ createdAt: 'desc' }, { id: 'desc' }]);
    assert.equal(query.skip, 0);
    assert.equal(query.take, 12);
    // count usa el mismo filtro que el listado, para que el total coincida.
    assert.deepEqual(count.mock.calls[0].arguments[0], { where: query.where });
  });

  it('busca el texto en título, descripción y materia sin distinguir mayúsculas', async () => {
    await listItems('?query=%20Casio%20');
    const contains = { contains: 'Casio', mode: 'insensitive' };
    assert.deepEqual(lastQuery().where.OR, [
      { titulo: contains },
      { descripcion: contains },
      { materia: contains },
    ]);
  });

  it('filtra por categoría y lo combina con la búsqueda', async () => {
    await listItems('?query=stewart&category=LIBRO');
    const { where } = lastQuery();
    assert.equal(where.categoria, 'LIBRO');
    assert.equal(where.estado, 'DISPONIBLE');
    assert.equal(where.OR?.length, 3);
  });

  it('una búsqueda o categoría vacía equivale a no filtrar', async () => {
    await listItems('?query=%20%20&category=');
    assert.deepEqual(lastQuery().where, { estado: 'DISPONIBLE', ownerId: { not: 1 } });
  });

  it('pagina con page y limit y calcula el total de páginas', async () => {
    listTotal = 11;
    const res = await listItems('?page=3&limit=5');
    const body = (await res.json()) as { page: number; totalPages: number; total: number };
    assert.equal(lastQuery().skip, 10);
    assert.equal(lastQuery().take, 5);
    assert.deepEqual(
      { page: body.page, totalPages: body.totalPages, total: body.total },
      {
        page: 3,
        totalPages: 3,
        total: 11,
      }
    );
  });

  it('sin resultados devuelve una lista vacía', async () => {
    const body = (await (await listItems('?query=inexistente')).json()) as Record<string, unknown>;
    assert.deepEqual(body, { data: [], page: 1, totalPages: 0, total: 0 });
  });

  it('rechaza con 400 y mensajes en español los parámetros inválidos', async () => {
    for (const [search, field, message] of [
      ['?limit=51', 'query.limit', 'El límite máximo es 50'],
      ['?page=abc', 'query.page', 'La página tiene que ser un número mayor a 0'],
      ['?page=0', 'query.page', 'La página tiene que ser un número mayor a 0'],
      ['?category=AUTO', 'query.category', 'La categoría no es válida'],
    ]) {
      const res = await listItems(search);
      assert.equal(res.status, 400, search);
      const { error } = (await res.json()) as ErrorResponse;
      assert.deepEqual(error.details, [{ field, message }], search);
    }
    assert.equal(findMany.mock.callCount(), 0);
  });

  it('sin token responde 401', async () => {
    const res = await listItems('', null);
    assert.equal(res.status, 401);
    assert.equal(findMany.mock.callCount(), 0);
  });
});
