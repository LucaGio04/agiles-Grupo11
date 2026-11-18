import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import { createApp } from '../src/app.js';
import { signToken } from '../src/lib/jwt.js';
import { prisma } from '../src/lib/prisma.js';

// Propuesta de Tomás (id 1) a Sofía (id 2): Sofía es la receptora.
const pending = {
  receptorId: 2,
  estado: 'PENDIENTE',
  itemSolicitadoId: 8,
  itemOfrecidoId: 4,
};

const viewRow = {
  id: 5,
  estado: 'ACEPTADA',
  mensaje: null,
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
  updatedAt: new Date('2026-10-02T00:00:00.000Z'),
  proponenteId: 1,
  receptorId: 2,
  proponente: { id: 1, nombre: 'Tomás Bellizzi', email: 'tomas@utn.edu.ar' },
  receptor: { id: 2, nombre: 'Sofía Demo', email: 'sofia.demo@utn.edu.ar' },
  itemSolicitado: {
    id: 8,
    titulo: 'Libro',
    estado: 'RESERVADO',
    categoria: 'LIBRO',
    fotoUrl: null,
  },
  itemOfrecido: {
    id: 4,
    titulo: 'Apunte',
    estado: 'RESERVADO',
    categoria: 'APUNTE',
    fotoUrl: null,
  },
  calificaciones: [],
};

let stored: typeof pending | null = pending;
let viewResult = viewRow;
let reservedCount = 2;
const findUnique = mock.fn(async () => stored);
const findMany = mock.fn(async () => [viewResult]);
const updateMany = mock.fn<(args: unknown) => Promise<{ count: number }>>(async () => ({
  count: 1,
}));
const itemUpdateMany = mock.fn<(args: unknown) => Promise<{ count: number }>>(async () => ({
  count: reservedCount,
}));
const transaction = mock.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
  fn({ proposal: { updateMany }, item: { updateMany: itemUpdateMany } })
);

Object.defineProperty(prisma, 'proposal', {
  value: { findUnique, findMany, updateMany },
  configurable: true,
});
Object.defineProperty(prisma, '$transaction', { value: transaction, configurable: true });

const server = createApp().listen(0);
let baseUrl = '';
const sofia = signToken({ id: 2, email: 'sofia.demo@utn.edu.ar' });
const tomas = signToken({ id: 1, email: 'tomas@utn.edu.ar' });

type ErrorResponse = { error: { code: string; message: string } };

const respond = (id: string, body: unknown, token: string | null = sofia) =>
  fetch(`${baseUrl}/api/proposals/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

describe('PATCH /api/proposals/:id', () => {
  beforeEach(() => {
    for (const fn of [findUnique, findMany, updateMany, itemUpdateMany, transaction]) {
      fn.mock.resetCalls();
    }
    stored = pending;
    viewResult = viewRow;
    reservedCount = 2;
  });

  it('exige autenticación', async () => {
    const res = await respond('5', { accion: 'aceptar' }, null);
    assert.equal(res.status, 401);
  });

  it('rechaza una acción inválida con 400 sin tocar la base', async () => {
    const res = await respond('5', { accion: 'borrar' });
    assert.equal(res.status, 400);
    assert.equal(findUnique.mock.callCount(), 0);
  });

  it('rechaza un id inválido con 400', async () => {
    const res = await respond('abc', { accion: 'aceptar' });
    assert.equal(res.status, 400);
  });

  it('responde 404 si la propuesta no existe', async () => {
    stored = null;
    const res = await respond('5', { accion: 'aceptar' });
    assert.equal(res.status, 404);
  });

  it('responde 403 si quien responde no es el receptor (ni siquiera el proponente)', async () => {
    const res = await respond('5', { accion: 'aceptar' }, tomas);
    assert.equal(res.status, 403);
    assert.equal(transaction.mock.callCount(), 0);
    assert.equal(updateMany.mock.callCount(), 0);
  });

  it('responde 409 si la propuesta ya no está pendiente', async () => {
    stored = { ...pending, estado: 'ACEPTADA' };
    const res = await respond('5', { accion: 'rechazar' });
    assert.equal(res.status, 409);
    const { error } = (await res.json()) as ErrorResponse;
    assert.equal(error.code, 'CONFLICT');
    assert.equal(updateMany.mock.callCount(), 0);
  });

  it('rechazar pasa la propuesta a RECHAZADA y no toca los ítems', async () => {
    viewResult = { ...viewRow, estado: 'RECHAZADA' };
    const res = await respond('5', { accion: 'rechazar' });
    assert.equal(res.status, 200);
    assert.deepEqual(updateMany.mock.calls[0].arguments[0], {
      where: { id: 5, estado: 'PENDIENTE' },
      data: { estado: 'RECHAZADA' },
    });
    assert.equal(transaction.mock.callCount(), 0);
    const body = (await res.json()) as { data: { estado: string; persona: object } };
    assert.equal(body.data.estado, 'RECHAZADA');
    // Rechazada: no se comparte el email.
    assert.deepEqual(body.data.persona, { id: 1, nombre: 'Tomás Bellizzi' });
  });

  it('aceptar reserva ambos ítems, rechaza las otras pendientes y devuelve los emails', async () => {
    const res = await respond('5', { accion: 'aceptar' });
    assert.equal(res.status, 200);
    assert.equal(transaction.mock.callCount(), 1);

    const [aceptar, rechazarOtras] = updateMany.mock.calls.map((call) => call.arguments[0]);
    assert.deepEqual(aceptar, {
      where: { id: 5, estado: 'PENDIENTE' },
      data: { estado: 'ACEPTADA' },
    });
    assert.deepEqual(itemUpdateMany.mock.calls[0].arguments[0], {
      where: { id: { in: [8, 4] }, estado: 'DISPONIBLE' },
      data: { estado: 'RESERVADO' },
    });
    assert.deepEqual(rechazarOtras, {
      where: {
        id: { not: 5 },
        estado: 'PENDIENTE',
        OR: [{ itemSolicitadoId: { in: [8, 4] } }, { itemOfrecidoId: { in: [8, 4] } }],
      },
      data: { estado: 'RECHAZADA' },
    });

    const body = (await res.json()) as { data: { estado: string; persona: object } };
    assert.equal(body.data.estado, 'ACEPTADA');
    assert.deepEqual(body.data.persona, {
      id: 1,
      nombre: 'Tomás Bellizzi',
      email: 'tomas@utn.edu.ar',
    });
  });

  it('aceptar responde 409 y no rechaza otras propuestas si un ítem ya no está disponible', async () => {
    reservedCount = 1;
    const res = await respond('5', { accion: 'aceptar' });
    assert.equal(res.status, 409);
    // Solo corrió la aceptación; el error dentro de la transacción la revierte.
    assert.equal(updateMany.mock.callCount(), 1);
  });

  it('aceptar responde 409 si otra respuesta se adelantó (carrera)', async () => {
    updateMany.mock.mockImplementationOnce(async () => ({ count: 0 }));
    const res = await respond('5', { accion: 'aceptar' });
    assert.equal(res.status, 409);
    assert.equal(itemUpdateMany.mock.callCount(), 0);
  });
});
