import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import { createApp } from '../src/app.js';
import { signToken } from '../src/lib/jwt.js';
import { prisma } from '../src/lib/prisma.js';

type ItemRow = { id: number; ownerId: number; estado: string };
type ProposalRow = {
  id: number;
  itemSolicitadoId: number;
  itemOfrecidoId: number;
  estado: string;
};

let items: Record<number, ItemRow> = {};
let rows: ProposalRow[] = [];
const steps: string[] = [];

const findUnique = mock.fn(async ({ where }: { where: { id: number } }) => items[where.id] ?? null);

const queryRaw = mock.fn(async () => {
  steps.push('lock');
  return [];
});

const findFirst = mock.fn(
  async ({
    where,
  }: {
    where: { itemSolicitadoId: number; itemOfrecidoId: number; estado: string };
  }) => {
    steps.push('find');
    return (
      rows.find(
        (row) =>
          row.itemSolicitadoId === where.itemSolicitadoId &&
          row.itemOfrecidoId === where.itemOfrecidoId &&
          row.estado === where.estado
      ) ?? null
    );
  }
);

type CreateArgs = { data: Record<string, unknown> };
const create = mock.fn(async ({ data }: CreateArgs) => {
  steps.push('create');
  return {
    id: 20,
    createdAt: new Date('2026-11-13T12:00:00.000Z'),
    updatedAt: new Date('2026-11-13T12:00:00.000Z'),
    ...data,
    mensaje: data.mensaje ?? null,
    estado: 'PENDIENTE',
  };
});

const tx = { $queryRaw: queryRaw, proposal: { findFirst, create } };
const transaction = mock.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx));

Object.defineProperty(prisma, 'item', { value: { findUnique }, configurable: true });
Object.defineProperty(prisma, '$transaction', { value: transaction, configurable: true });

const server = createApp().listen(0);
let baseUrl = '';
const token = signToken({ id: 1, email: 'tomas@utn.edu.ar' });

type ErrorResponse = {
  error: { code: string; message: string; details?: { field: string; message: string }[] };
};

const solicitado = { id: 8, ownerId: 2, estado: 'DISPONIBLE' };
const ofrecido = { id: 4, ownerId: 1, estado: 'DISPONIBLE' };

const propose = (id: number | string, body: unknown, authToken: string | null = token) =>
  fetch(`${baseUrl}/api/items/${id}/propose`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify(body),
  });

const lookedUpIds = () => findUnique.mock.calls.map((call) => call.arguments[0].where.id);

before(async () => {
  if (!server.listening) await once(server, 'listening');
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
});

describe('POST /api/items/:id/propose', () => {
  beforeEach(() => {
    items = { 8: { ...solicitado }, 4: { ...ofrecido } };
    rows = [];
    steps.length = 0;
    findUnique.mock.resetCalls();
    queryRaw.mock.resetCalls();
    findFirst.mock.resetCalls();
    create.mock.resetCalls();
    transaction.mock.resetCalls();
  });

  it('crea la propuesta PENDIENTE y deriva el receptor del ítem solicitado', async () => {
    const res = await propose(8, { itemOfrecidoId: 4, mensaje: '  ¿Lo cambiamos?  ' });
    assert.equal(res.status, 201);
    const body = (await res.json()) as { proposal: Record<string, unknown> };

    assert.equal(body.proposal.estado, 'PENDIENTE');
    assert.equal(body.proposal.itemSolicitadoId, 8);
    assert.equal(body.proposal.itemOfrecidoId, 4);
    assert.equal(body.proposal.proponenteId, 1);
    assert.equal(body.proposal.receptorId, 2);
    assert.equal(body.proposal.mensaje, '¿Lo cambiamos?');

    assert.deepEqual(steps, ['lock', 'find', 'create']);
    assert.deepEqual(create.mock.calls[0].arguments[0].data, {
      itemSolicitadoId: 8,
      itemOfrecidoId: 4,
      proponenteId: 1,
      receptorId: 2,
      mensaje: '¿Lo cambiamos?',
      estado: 'PENDIENTE',
    });
    assert.deepEqual(findFirst.mock.calls[0].arguments[0].where, {
      itemSolicitadoId: 8,
      itemOfrecidoId: 4,
      estado: 'PENDIENTE',
    });
  });

  it('un mensaje vacío no se guarda y una propuesta rechazada del mismo par no bloquea', async () => {
    rows = [{ id: 9, itemSolicitadoId: 8, itemOfrecidoId: 4, estado: 'RECHAZADA' }];
    const res = await propose(8, { itemOfrecidoId: 4, mensaje: '   ' });
    assert.equal(res.status, 201);
    assert.equal(create.mock.calls[0].arguments[0].data.mensaje, undefined);
    assert.equal(
      ((await res.json()) as { proposal: { mensaje: string | null } }).proposal.mensaje,
      null
    );
  });

  it('no permite proponer sobre un ítem propio', async () => {
    items[8] = { ...solicitado, ownerId: 1 };
    const res = await propose(8, { itemOfrecidoId: 4 });
    assert.equal(res.status, 400);
    const { error } = (await res.json()) as ErrorResponse;
    assert.equal(error.code, 'BAD_REQUEST');
    assert.equal(error.message, 'No podés proponer un intercambio sobre tu propia publicación');
    assert.deepEqual(lookedUpIds(), [8]);
    assert.equal(transaction.mock.callCount(), 0);
  });

  it('no permite proponer si el ítem solicitado no está disponible', async () => {
    items[8] = { ...solicitado, estado: 'PAUSADO' };
    const res = await propose(8, { itemOfrecidoId: 4 });
    assert.equal(res.status, 400);
    assert.equal(
      ((await res.json()) as ErrorResponse).error.message,
      'Esta publicación no está disponible para intercambiar'
    );
    assert.deepEqual(lookedUpIds(), [8]);
    assert.equal(transaction.mock.callCount(), 0);
  });

  it('no permite ofrecer un ítem de otra persona', async () => {
    items[4] = { ...ofrecido, ownerId: 3 };
    const res = await propose(8, { itemOfrecidoId: 4 });
    assert.equal(res.status, 400);
    assert.equal(
      ((await res.json()) as ErrorResponse).error.message,
      'Solo podés ofrecer un ítem propio'
    );
    assert.deepEqual(lookedUpIds(), [8, 4]);
    assert.equal(transaction.mock.callCount(), 0);
  });

  it('no permite ofrecer un ítem que no está disponible', async () => {
    items[4] = { ...ofrecido, estado: 'RESERVADO' };
    const res = await propose(8, { itemOfrecidoId: 4 });
    assert.equal(res.status, 400);
    assert.equal(
      ((await res.json()) as ErrorResponse).error.message,
      'El ítem que ofrecés no está disponible'
    );
    assert.equal(transaction.mock.callCount(), 0);
  });

  it('un mensaje de más de 300 caracteres responde 400 y no consulta la base', async () => {
    const res = await propose(8, { itemOfrecidoId: 4, mensaje: 'a'.repeat(301) });
    assert.equal(res.status, 400);
    const { error } = (await res.json()) as ErrorResponse;
    assert.equal(error.code, 'VALIDATION_ERROR');
    assert.deepEqual(error.details, [
      { field: 'body.mensaje', message: 'El mensaje puede tener hasta 300 caracteres' },
    ]);
    assert.equal(findUnique.mock.callCount(), 0);
    assert.equal(transaction.mock.callCount(), 0);
  });

  it('sin el ítem ofrecido responde 400 y no consulta la base', async () => {
    const res = await propose(8, {});
    assert.equal(res.status, 400);
    const { error } = (await res.json()) as ErrorResponse;
    assert.equal(error.code, 'VALIDATION_ERROR');
    assert.equal(error.details?.[0]?.field, 'body.itemOfrecidoId');
    assert.equal(findUnique.mock.callCount(), 0);
  });

  it('un ítem solicitado inexistente responde 404 sin mirar el ofrecido', async () => {
    delete items[8];
    const res = await propose(8, { itemOfrecidoId: 4 });
    assert.equal(res.status, 404);
    const { error } = (await res.json()) as ErrorResponse;
    assert.equal(error.code, 'NOT_FOUND');
    assert.equal(error.message, 'No encontramos esa publicación');
    assert.deepEqual(lookedUpIds(), [8]);
    assert.equal(transaction.mock.callCount(), 0);
    assert.equal(create.mock.callCount(), 0);
  });

  it('un ítem solicitado eliminado responde 404', async () => {
    items[8] = { ...solicitado, estado: 'ELIMINADO' };
    const res = await propose(8, { itemOfrecidoId: 4 });
    assert.equal(res.status, 404);
    assert.equal(
      ((await res.json()) as ErrorResponse).error.message,
      'No encontramos esa publicación'
    );
    assert.deepEqual(lookedUpIds(), [8]);
    assert.equal(create.mock.callCount(), 0);
  });

  it('un ítem ofrecido inexistente responde 404 y no crea la propuesta', async () => {
    delete items[4];
    const res = await propose(8, { itemOfrecidoId: 4 });
    assert.equal(res.status, 404);
    const { error } = (await res.json()) as ErrorResponse;
    assert.equal(error.code, 'NOT_FOUND');
    assert.equal(error.message, 'No encontramos el ítem que querés ofrecer');
    assert.deepEqual(lookedUpIds(), [8, 4]);
    assert.equal(transaction.mock.callCount(), 0);
    assert.equal(create.mock.callCount(), 0);
  });

  it('un ítem ofrecido eliminado responde 404 y no crea la propuesta', async () => {
    items[4] = { ...ofrecido, estado: 'ELIMINADO' };
    const res = await propose(8, { itemOfrecidoId: 4 });
    assert.equal(res.status, 404);
    assert.equal(
      ((await res.json()) as ErrorResponse).error.message,
      'No encontramos el ítem que querés ofrecer'
    );
    assert.deepEqual(lookedUpIds(), [8, 4]);
    assert.equal(create.mock.callCount(), 0);
  });

  it('una propuesta pendiente del mismo par responde 409 y no inserta otra', async () => {
    rows = [{ id: 9, itemSolicitadoId: 8, itemOfrecidoId: 4, estado: 'PENDIENTE' }];
    const res = await propose(8, { itemOfrecidoId: 4 });
    assert.equal(res.status, 409);
    const { error } = (await res.json()) as ErrorResponse;
    assert.equal(error.code, 'CONFLICT');
    assert.equal(error.message, 'Ya tenés una propuesta pendiente para este intercambio');
    assert.deepEqual(steps, ['lock', 'find']);
    assert.equal(create.mock.callCount(), 0);
  });

  it('sin token responde 401 y no consulta la base', async () => {
    const res = await propose(8, { itemOfrecidoId: 4 }, null);
    assert.equal(res.status, 401);
    assert.equal(((await res.json()) as ErrorResponse).error.code, 'UNAUTHORIZED');
    assert.equal(findUnique.mock.callCount(), 0);
  });
});
