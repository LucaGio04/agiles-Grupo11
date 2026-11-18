import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import { createApp } from '../src/app.js';
import { signToken } from '../src/lib/jwt.js';
import { prisma } from '../src/lib/prisma.js';

type ProposalRecord = {
  id: number;
  itemSolicitadoId: number;
  itemOfrecidoId: number;
  proponenteId: number;
  receptorId: number;
  estado: string;
};

type ItemRecord = {
  id: number;
  estado: string;
};

let proposals: Record<number, ProposalRecord> = {};
let items: Record<number, ItemRecord> = {};

const findUniqueProposal = mock.fn(async ({ where }: { where: { id: number } }) => {
  return proposals[where.id] ?? null;
});

const updateProposal = mock.fn(
  async ({ where, data }: { where: { id: number }; data: { estado: string } }) => {
    if (proposals[where.id]) {
      proposals[where.id] = { ...proposals[where.id], ...data };
    }
    return proposals[where.id];
  }
);

const updateItem = mock.fn(
  async ({ where, data }: { where: { id: number }; data: { estado: string } }) => {
    if (items[where.id]) {
      items[where.id] = { ...items[where.id], ...data };
    }
    return items[where.id];
  }
);

const $transaction = mock.fn(async (ops: unknown[]) => {
  if (Array.isArray(ops)) {
    return Promise.all(ops);
  }
  return [];
});

Object.defineProperty(prisma, 'proposal', {
  value: { findUnique: findUniqueProposal, update: updateProposal },
  configurable: true,
});

Object.defineProperty(prisma, 'item', {
  value: { update: updateItem },
  configurable: true,
});

Object.defineProperty(prisma, '$transaction', {
  value: $transaction,
  configurable: true,
});

describe('PATCH /api/proposals/:id - concretar (HU-17)', () => {
  let baseUrl: string;
  let server: Server;

  before(async () => {
    const app = createApp();
    server = app.listen(0);
    await once(server, 'listening');
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(() => {
    server.close();
  });

  beforeEach(() => {
    findUniqueProposal.mock.resetCalls();
    updateProposal.mock.resetCalls();
    updateItem.mock.resetCalls();
    $transaction.mock.resetCalls();

    proposals = {
      1: {
        id: 1,
        itemSolicitadoId: 10,
        itemOfrecidoId: 20,
        proponenteId: 100,
        receptorId: 200,
        estado: 'ACEPTADA',
      },
      2: {
        id: 2,
        itemSolicitadoId: 11,
        itemOfrecidoId: 21,
        proponenteId: 100,
        receptorId: 200,
        estado: 'PENDIENTE',
      },
    };

    items = {
      10: { id: 10, estado: 'RESERVADO' },
      20: { id: 20, estado: 'RESERVADO' },
      11: { id: 11, estado: 'DISPONIBLE' },
      21: { id: 21, estado: 'DISPONIBLE' },
    };
  });

  it('401 si no hay token', async () => {
    const res = await fetch(`${baseUrl}/api/proposals/1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'concretar' }),
    });
    assert.equal(res.status, 401);
  });

  it('400 si la acción no es válida', async () => {
    const token = signToken({ id: 100, email: 'user@frba.utn.edu.ar' });
    const res = await fetch(`${baseUrl}/api/proposals/1`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ accion: 'otra' }),
    });
    assert.equal(res.status, 400);
  });

  it('404 si la propuesta no existe', async () => {
    const token = signToken({ id: 100, email: 'user@frba.utn.edu.ar' });
    const res = await fetch(`${baseUrl}/api/proposals/999`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ accion: 'concretar' }),
    });
    assert.equal(res.status, 404);
  });

  it('403 si el usuario no es participante', async () => {
    const token = signToken({ id: 300, email: 'tercero@frba.utn.edu.ar' });
    const res = await fetch(`${baseUrl}/api/proposals/1`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ accion: 'concretar' }),
    });
    assert.equal(res.status, 403);
  });

  it('400 si la propuesta no está ACEPTADA', async () => {
    const token = signToken({ id: 100, email: 'user@frba.utn.edu.ar' });
    const res = await fetch(`${baseUrl}/api/proposals/2`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ accion: 'concretar' }),
    });
    assert.equal(res.status, 400);
  });

  it('200 y pasa propuesta a CONCRETADA y ambos items a INTERCAMBIADO (proponente)', async () => {
    const token = signToken({ id: 100, email: 'user@frba.utn.edu.ar' });
    const res = await fetch(`${baseUrl}/api/proposals/1`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ accion: 'concretar' }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { message: string };
    assert.equal(body.message, 'Intercambio concretado exitosamente');
    assert.equal(proposals[1].estado, 'CONCRETADA');
    assert.equal(items[10].estado, 'INTERCAMBIADO');
    assert.equal(items[20].estado, 'INTERCAMBIADO');
  });

  it('200 y pasa propuesta a CONCRETADA cuando lo confirma el receptor', async () => {
    const token = signToken({ id: 200, email: 'receptor@frba.utn.edu.ar' });
    const res = await fetch(`${baseUrl}/api/proposals/1`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ accion: 'concretar' }),
    });
    assert.equal(res.status, 200);
    assert.equal(proposals[1].estado, 'CONCRETADA');
  });
});
