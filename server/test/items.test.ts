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

Object.defineProperty(prisma, 'item', { value: { create }, configurable: true });

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
