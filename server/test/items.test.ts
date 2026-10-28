import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import { createApp } from '../src/app.js';
import { signToken } from '../src/lib/jwt.js';
import { prisma } from '../src/lib/prisma.js';

// Simula prisma.item.create devolviendo el ítem como lo guardaría la base (ver auth.test.ts).
type CreateArgs = { data: Record<string, unknown> & { ownerId: number } };
const create = mock.fn(async ({ data }: CreateArgs) => ({
  id: 10,
  descripcion: null,
  materia: null,
  fotoUrl: null,
  ...data,
  estado: 'DISPONIBLE',
  createdAt: new Date(),
  updatedAt: new Date(),
}));

// Un único ítem guardado (id 7), del usuario 1, con dos calificaciones recibidas.
const storedItem = {
  id: 7,
  titulo: 'Calculadora Casio fx-82',
  descripcion: null,
  categoria: 'CALCULADORA',
  estadoConservacion: 'BUENO',
  materia: 'Física I',
  fotoUrl: null,
  estado: 'RESERVADO',
  ownerId: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  owner: { id: 1, nombre: 'Tomás Bellizzi', carrera: 'Ingeniería en Sistemas' },
};
const findUnique = mock.fn(async ({ where }: { where: { id: number } }) =>
  where.id === storedItem.id ? storedItem : null
);
const aggregate = mock.fn(async () => ({ _avg: { puntaje: 4.5 }, _count: 2 }));

// Listado (HU-04): findMany devuelve lo que diga listResult y count, listTotal.
// Lo que importa en estos tests es qué filtros, orden y paginación se le piden a Prisma.
let listResult: unknown[] = [];
let listTotal = 0;
type ListArgs = {
  where: { estado?: string; ownerId?: unknown; categoria?: string; OR?: unknown[] };
  orderBy?: unknown;
  skip?: number;
  take?: number;
};
const findMany = mock.fn<(args: ListArgs) => Promise<unknown[]>>(async () => listResult);
const count = mock.fn<(args: ListArgs) => Promise<number>>(async () => listTotal);

Object.defineProperty(prisma, 'item', {
  value: { create, findUnique, findMany, count },
  configurable: true,
});
Object.defineProperty(prisma, 'rating', { value: { aggregate }, configurable: true });

const server = createApp().listen(0);
let baseUrl = '';
const token = signToken({ id: 1, email: 'tomas@utn.edu.ar' });

type ErrorResponse = {
  error: { code: string; message: string; details?: { field: string; message: string }[] };
};
type ItemResponse = { item: Record<string, unknown> };

const publish = (body: unknown, authToken: string | null = token) =>
  fetch(`${baseUrl}/api/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify(body),
  });

const validItem = {
  titulo: 'Análisis Matemático I - Stewart',
  categoria: 'LIBRO',
  estadoConservacion: 'BUENO',
};

before(async () => {
  if (!server.listening) await once(server, 'listening');
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
});

describe('POST /api/items', () => {
  beforeEach(() => {
    create.mock.resetCalls();
  });

  it('con los campos obligatorios devuelve 201 con el ítem DISPONIBLE del usuario del token', async () => {
    const res = await publish(validItem);
    assert.equal(res.status, 201);

    const { item } = (await res.json()) as ItemResponse;
    assert.equal(item.id, 10);
    assert.equal(item.titulo, validItem.titulo);
    assert.equal(item.estado, 'DISPONIBLE');
    assert.equal(item.ownerId, 1);
  });

  it('acepta descripción, materia y foto opcionales', async () => {
    const res = await publish({
      ...validItem,
      descripcion: 'Edición 7, con algunas anotaciones en lápiz',
      materia: 'Análisis Matemático I',
      fotoUrl: 'https://example.com/stewart.jpg',
    });
    assert.equal(res.status, 201);
    assert.deepEqual(create.mock.calls[0].arguments[0].data, {
      ...validItem,
      descripcion: 'Edición 7, con algunas anotaciones en lápiz',
      materia: 'Análisis Matemático I',
      fotoUrl: 'https://example.com/stewart.jpg',
      ownerId: 1,
    });
  });

  it('ignora un ownerId o estado enviados en el body', async () => {
    await publish({ ...validItem, ownerId: 99, estado: 'INTERCAMBIADO' });
    const data = create.mock.calls[0].arguments[0].data;
    assert.equal(data.ownerId, 1);
    assert.equal(data.estado, undefined);
  });

  it('recorta los textos y toma los opcionales vacíos como no enviados', async () => {
    await publish({
      ...validItem,
      titulo: '  Calculadora Casio  ',
      descripcion: '  ',
      fotoUrl: '',
    });
    const data = create.mock.calls[0].arguments[0].data;
    assert.equal(data.titulo, 'Calculadora Casio');
    assert.equal(data.descripcion, undefined);
    assert.equal(data.fotoUrl, undefined);
  });

  it('sin título ni categoría responde 400 marcando ambos campos', async () => {
    const res = await publish({ estadoConservacion: 'NUEVO' });
    assert.equal(res.status, 400);

    const { error } = (await res.json()) as ErrorResponse;
    assert.equal(error.code, 'VALIDATION_ERROR');
    const fields = error.details?.map((d) => d.field);
    assert.ok(fields?.includes('body.titulo'));
    assert.ok(fields?.includes('body.categoria'));
    assert.equal(create.mock.callCount(), 0);
  });

  it('valida el largo del título (3 a 80) y de la descripción (hasta 500)', async () => {
    for (const body of [
      { ...validItem, titulo: 'ab' },
      { ...validItem, titulo: 'a'.repeat(81) },
      { ...validItem, descripcion: 'a'.repeat(501) },
    ]) {
      const res = await publish(body);
      assert.equal(res.status, 400);
    }
    assert.equal(create.mock.callCount(), 0);
  });

  it('rechaza una categoría inexistente o una foto que no es URL', async () => {
    const badCategory = await publish({ ...validItem, categoria: 'AUTO' });
    const badPhoto = await publish({ ...validItem, fotoUrl: 'javascript:alert(1)' });
    assert.equal(badCategory.status, 400);
    assert.equal(badPhoto.status, 400);
    assert.equal(create.mock.callCount(), 0);
  });

  it('sin token responde 401', async () => {
    const res = await publish(validItem, null);
    assert.equal(res.status, 401);
    assert.equal(((await res.json()) as ErrorResponse).error.code, 'UNAUTHORIZED');
    assert.equal(create.mock.callCount(), 0);
  });
});

describe('GET /api/items/:id', () => {
  const getItem = (id: string, authToken: string | null = token) =>
    fetch(`${baseUrl}/api/items/${id}`, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    });

  it('devuelve el ítem y su dueño con nombre, carrera y reputación', async () => {
    const res = await getItem('7');
    assert.equal(res.status, 200);

    const body = (await res.json()) as { item: Record<string, unknown>; owner: unknown };
    assert.equal(body.item.titulo, storedItem.titulo);
    assert.equal(body.item.owner, undefined);
    assert.deepEqual(body.owner, {
      id: 1,
      nombre: 'Tomás Bellizzi',
      carrera: 'Ingeniería en Sistemas',
      reputacion: { promedio: 4.5, cantidad: 2 },
    });
  });

  it('es visible aunque el ítem esté RESERVADO', async () => {
    const body = (await (await getItem('7')).json()) as { item: { estado: string } };
    assert.equal(body.item.estado, 'RESERVADO');
  });

  it('nunca expone el email ni la contraseña del dueño', async () => {
    const text = await (await getItem('7')).text();
    assert.ok(!text.includes('email'));
    assert.ok(!text.includes('passwordHash'));
  });

  it('si el ítem no existe responde 404', async () => {
    const res = await getItem('999');
    assert.equal(res.status, 404);
    assert.equal(((await res.json()) as ErrorResponse).error.code, 'NOT_FOUND');
  });

  for (const id of ['abc', '7.5', '0', '-3']) {
    it(`con el id inválido "${id}" responde 400 con el mensaje en español`, async () => {
      const res = await getItem(id);
      assert.equal(res.status, 400);
      const { error } = (await res.json()) as ErrorResponse;
      assert.deepEqual(error.details, [
        { field: 'params.id', message: 'El id del ítem no es válido' },
      ]);
    });
  }

  it('sin token responde 401', async () => {
    const res = await getItem('7', null);
    assert.equal(res.status, 401);
  });
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
    listResult = [{ ...storedItem, owner: undefined, estado: 'DISPONIBLE', ownerId: 2 }];
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

  it('un page o limit vacío equivale a no enviarlo', async () => {
    const res = await listItems('?page=&limit=');
    assert.equal(res.status, 200);
    const body = (await res.json()) as { page: number };
    assert.equal(body.page, 1);
    assert.equal(lastQuery().skip, 0);
    assert.equal(lastQuery().take, 12);
  });

  it('acepta la página máxima y rechaza las que la superan, sin llegar a la base', async () => {
    assert.equal((await listItems('?page=100000')).status, 200);
    findMany.mock.resetCalls();

    for (const page of ['100001', '99999999999999999999', '9007199254740993']) {
      const res = await listItems(`?page=${page}`);
      assert.equal(res.status, 400, page);
      const { error } = (await res.json()) as ErrorResponse;
      // Un solo mensaje por campo, aunque el número tampoco sea un entero seguro.
      assert.deepEqual(
        error.details,
        [{ field: 'query.page', message: 'La página máxima es 100000' }],
        page
      );
    }
    assert.equal(findMany.mock.callCount(), 0);
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
