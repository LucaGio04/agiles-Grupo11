import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import { createApp } from '../src/app.js';
import { signToken } from '../src/lib/jwt.js';
import { prisma } from '../src/lib/prisma.js';

// Dueño del ítem: id 1. Otro usuario: id 2.
const OWNER_ID = 1;
const OTHER_ID = 2;
const ITEM_ID = 7;

const ownedItem = {
  id: ITEM_ID,
  titulo: 'Análisis Matemático I',
  descripcion: null,
  categoria: 'LIBRO' as const,
  estadoConservacion: 'BUENO' as const,
  materia: null,
  fotoUrl: null,
  estado: 'DISPONIBLE' as const,
  ownerId: OWNER_ID,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Mocks de Prisma
const findUnique = mock.fn(async ({ where }: { where: { id: number } }) =>
  where.id === ITEM_ID ? ownedItem : null
);
// findFirst devuelve null por defecto → no hay propuesta ACEPTADA
const findFirst = mock.fn(async () => null);
const updateMany = mock.fn(async () => ({ count: 0 }));
const update = mock.fn(async () => ({ ...ownedItem, estado: 'ELIMINADO' }));
// $transaction ejecuta las operaciones en orden
const $transaction = mock.fn(async (ops: Promise<unknown>[]) => Promise.all(ops));

Object.defineProperty(prisma, 'item', {
  value: { findUnique, update },
  configurable: true,
});
Object.defineProperty(prisma, 'proposal', {
  value: { findFirst, updateMany },
  configurable: true,
});
Object.defineProperty(prisma, '$transaction', {
  value: $transaction,
  configurable: true,
});

const server = createApp().listen(0);
let baseUrl = '';
const ownerToken = signToken({ id: OWNER_ID, email: 'owner@utn.edu.ar' });
const otherToken = signToken({ id: OTHER_ID, email: 'other@utn.edu.ar' });

type ErrorResponse = {
  error: { code: string; message: string; details?: { field: string; message: string }[] };
};

const deleteItem = (id: string | number, authToken: string | null = ownerToken) =>
  fetch(`${baseUrl}/api/items/${id}`, {
    method: 'DELETE',
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
  });

before(async () => {
  if (!server.listening) await once(server, 'listening');
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
});

describe('DELETE /api/items/:id', () => {
  beforeEach(() => {
    findUnique.mock.resetCalls();
    findFirst.mock.resetCalls();
    updateMany.mock.resetCalls();
    update.mock.resetCalls();
    $transaction.mock.resetCalls();
    // Sin propuesta ACEPTADA por defecto
    findFirst.mock.mockImplementation(async () => null);
    findUnique.mock.mockImplementation(async ({ where }: { where: { id: number } }) =>
      where.id === ITEM_ID ? ownedItem : null
    );
  });

  it('el dueño elimina su ítem y recibe 204', async () => {
    const res = await deleteItem(ITEM_ID);
    assert.equal(res.status, 204);
    // No debe haber cuerpo en 204
    const text = await res.text();
    assert.equal(text, '');
  });

  it('ejecuta la transacción: cancela propuestas PENDIENTES y marca el ítem ELIMINADO', async () => {
    await deleteItem(ITEM_ID);
    assert.equal($transaction.mock.callCount(), 1);
    // updateMany cancela propuestas PENDIENTES
    assert.equal(updateMany.mock.callCount(), 1);
    const updateManyArgs = updateMany.mock.calls[0].arguments[0] as {
      where: { estado: string };
      data: { estado: string };
    };
    assert.equal(updateManyArgs.data.estado, 'CANCELADA');
    assert.equal(updateManyArgs.where.estado, 'PENDIENTE');
    // update marca el ítem como ELIMINADO
    assert.equal(update.mock.callCount(), 1);
    const updateArgs = update.mock.calls[0].arguments[0] as {
      where: { id: number };
      data: { estado: string };
    };
    assert.equal(updateArgs.data.estado, 'ELIMINADO');
    assert.equal(updateArgs.where.id, ITEM_ID);
  });

  it('no se puede eliminar con una propuesta ACEPTADA en curso → 409', async () => {
    findFirst.mock.mockImplementation(async () => ({ id: 99, estado: 'ACEPTADA' }));
    const res = await deleteItem(ITEM_ID);
    assert.equal(res.status, 409);
    const { error } = (await res.json()) as ErrorResponse;
    assert.equal(error.code, 'PROPOSAL_ACCEPTED');
    // No debe haber modificado nada
    assert.equal($transaction.mock.callCount(), 0);
  });

  it('otro usuario intenta eliminar el ítem del dueño → 403', async () => {
    const res = await deleteItem(ITEM_ID, otherToken);
    assert.equal(res.status, 403);
    const { error } = (await res.json()) as ErrorResponse;
    assert.equal(error.code, 'FORBIDDEN');
    assert.equal($transaction.mock.callCount(), 0);
  });

  it('ítem inexistente → 404', async () => {
    const res = await deleteItem(999);
    assert.equal(res.status, 404);
    const { error } = (await res.json()) as ErrorResponse;
    assert.equal(error.code, 'NOT_FOUND');
  });

  it('sin token → 401', async () => {
    const res = await deleteItem(ITEM_ID, null);
    assert.equal(res.status, 401);
    const { error } = (await res.json()) as ErrorResponse;
    assert.equal(error.code, 'UNAUTHORIZED');
    assert.equal($transaction.mock.callCount(), 0);
  });

  for (const id of ['abc', '7.5', '0', '-3']) {
    it(`id inválido "${id}" → 400 con mensaje en español`, async () => {
      const res = await deleteItem(id);
      assert.equal(res.status, 400);
      const { error } = (await res.json()) as ErrorResponse;
      assert.deepEqual(error.details, [
        { field: 'params.id', message: 'El id del ítem no es válido' },
      ]);
      assert.equal($transaction.mock.callCount(), 0);
    });
  }
});
