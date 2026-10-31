import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import { createApp } from '../src/app.js';
import { signToken } from '../src/lib/jwt.js';
import { prisma } from '../src/lib/prisma.js';

const OWNER_ID = 1;
const OTHER_USER_ID = 2;
const ITEM_ID = 5;

const baseItem = {
  id: ITEM_ID,
  titulo: 'Física I - Resnick Halliday',
  descripcion: 'Tomo 1 en buen estado',
  categoria: 'LIBRO',
  estadoConservacion: 'BUENO',
  materia: 'Física I',
  fotoUrl: 'https://example.com/fisica.jpg',
  estado: 'DISPONIBLE',
  ownerId: OWNER_ID,
  createdAt: new Date(),
  updatedAt: new Date(),
};

let currentItem = { ...baseItem };

const findUnique = mock.fn(async ({ where }: { where: { id: number } }) =>
  where.id === currentItem.id ? currentItem : null
);

type UpdateArgs = { where: { id: number }; data: Record<string, unknown> };
const update = mock.fn(async ({ data }: UpdateArgs) => {
  currentItem = { ...currentItem, ...data, updatedAt: new Date() };
  return currentItem;
});

Object.defineProperty(prisma, 'item', {
  value: { findUnique, update },
  configurable: true,
});

const server = createApp().listen(0);
let baseUrl = '';
const ownerToken = signToken({ id: OWNER_ID, email: 'dueno@utn.edu.ar' });
const otherToken = signToken({ id: OTHER_USER_ID, email: 'otro@utn.edu.ar' });

type ErrorResponse = {
  error: { code: string; message: string; details?: { field: string; message: string }[] };
};
type ItemResponse = { item: Record<string, unknown> };

const patchItem = (id: string | number, body: unknown, authToken: string | null = ownerToken) =>
  fetch(`${baseUrl}/api/items/${id}`, {
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

describe('PATCH /api/items/:id', () => {
  beforeEach(() => {
    findUnique.mock.resetCalls();
    update.mock.resetCalls();
    currentItem = { ...baseItem };
  });

  it('el dueño puede actualizar campos (título, descripción, categoría, estado de conservación, materia)', async () => {
    const updateData = {
      titulo: 'Física I - Resnick 5ta edición',
      descripcion: 'Edición ampliada con ejercicios resueltos',
      categoria: 'LIBRO',
      estadoConservacion: 'NUEVO',
      materia: 'Física Universitaria',
    };

    const res = await patchItem(ITEM_ID, updateData);
    assert.equal(res.status, 200);

    const { item } = (await res.json()) as ItemResponse;
    assert.equal(item.titulo, updateData.titulo);
    assert.equal(item.descripcion, updateData.descripcion);
    assert.equal(item.estadoConservacion, updateData.estadoConservacion);

    assert.equal(update.mock.callCount(), 1);
    const passedData = update.mock.calls[0].arguments[0].data;
    assert.equal(passedData.titulo, updateData.titulo);
    assert.equal(passedData.descripcion, updateData.descripcion);
  });

  it('el dueño puede pausar una publicación (estado: PAUSADO)', async () => {
    const res = await patchItem(ITEM_ID, { estado: 'PAUSADO' });
    assert.equal(res.status, 200);

    const { item } = (await res.json()) as ItemResponse;
    assert.equal(item.estado, 'PAUSADO');
    assert.equal(update.mock.calls[0].arguments[0].data.estado, 'PAUSADO');
  });

  it('el dueño puede reactivar una publicación pausada (estado: DISPONIBLE)', async () => {
    currentItem.estado = 'PAUSADO';
    const res = await patchItem(ITEM_ID, { estado: 'DISPONIBLE' });
    assert.equal(res.status, 200);

    const { item } = (await res.json()) as ItemResponse;
    assert.equal(item.estado, 'DISPONIBLE');
    assert.equal(update.mock.calls[0].arguments[0].data.estado, 'DISPONIBLE');
  });

  it('el dueño puede quitar la foto enviando null o string vacío', async () => {
    const res = await patchItem(ITEM_ID, { fotoUrl: null });
    assert.equal(res.status, 200);

    assert.equal(update.mock.calls[0].arguments[0].data.fotoUrl, null);
  });

  it('si se envía body vacío responde 400 pidiendo al menos un campo', async () => {
    const res = await patchItem(ITEM_ID, {});
    assert.equal(res.status, 400);

    const { error } = (await res.json()) as ErrorResponse;
    assert.equal(error.code, 'VALIDATION_ERROR');
    assert.equal(update.mock.callCount(), 0);
  });

  it('si otro usuario intenta editar la publicación ajena responde 403', async () => {
    const res = await patchItem(ITEM_ID, { titulo: 'Intento hack' }, otherToken);
    assert.equal(res.status, 403);

    const { error } = (await res.json()) as ErrorResponse;
    assert.equal(error.code, 'FORBIDDEN');
    assert.equal(update.mock.callCount(), 0);
  });

  it('si el ítem está INTERCAMBIADO responde 400 y bloquea la edición', async () => {
    currentItem.estado = 'INTERCAMBIADO';
    const res = await patchItem(ITEM_ID, { titulo: 'Nuevo título' });
    assert.equal(res.status, 400);

    const { error } = (await res.json()) as ErrorResponse;
    assert.match(error.message, /ya fue intercambiada/);
    assert.equal(update.mock.callCount(), 0);
  });

  it('si la publicación no existe responde 404', async () => {
    const res = await patchItem(999, { titulo: 'No existo' });
    assert.equal(res.status, 404);

    const { error } = (await res.json()) as ErrorResponse;
    assert.equal(error.code, 'NOT_FOUND');
    assert.equal(update.mock.callCount(), 0);
  });

  it('sin token responde 401', async () => {
    const res = await patchItem(ITEM_ID, { titulo: 'Sin auth' }, null);
    assert.equal(res.status, 401);
    assert.equal(update.mock.callCount(), 0);
  });

  it('con campos inválidos responde 400 con validación por campo', async () => {
    const resShortTitle = await patchItem(ITEM_ID, { titulo: 'ab' });
    assert.equal(resShortTitle.status, 400);

    const resBadCat = await patchItem(ITEM_ID, { categoria: 'INEXISTENTE' });
    assert.equal(resBadCat.status, 400);

    const resBadPhoto = await patchItem(ITEM_ID, { fotoUrl: 'not-a-valid-url' });
    assert.equal(resBadPhoto.status, 400);

    const resBadState = await patchItem(ITEM_ID, { estado: 'RESERVADO' });
    assert.equal(resBadState.status, 400);

    assert.equal(update.mock.callCount(), 0);
  });

  for (const id of ['abc', '7.5', '0', '-3']) {
    it(`con id inválido "${id}" responde 400`, async () => {
      const res = await patchItem(id, { titulo: 'Valid Title' });
      assert.equal(res.status, 400);
      assert.equal(update.mock.callCount(), 0);
    });
  }
});
