import assert from 'node:assert/strict';
import { once } from 'node:events';
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

type RatingRecord = {
  id: number;
  proposalId: number;
  evaluadorId: number;
  evaluadoId: number;
  puntaje: number;
  comentario?: string | null;
};

let proposals: Record<number, ProposalRecord> = {};
let ratings: RatingRecord[] = [];

const findUniqueProposal = mock.fn(async ({ where }: { where: { id: number } }) => {
  return proposals[where.id] ?? null;
});

const createRating = mock.fn(
  async ({
    data,
  }: {
    data: {
      proposalId: number;
      evaluadorId: number;
      evaluadoId: number;
      puntaje: number;
      comentario?: string;
    };
  }) => {
    const existing = ratings.find(
      (r) => r.proposalId === data.proposalId && r.evaluadorId === data.evaluadorId
    );
    if (existing) {
      const err = new Error('Unique constraint failed') as Error & { code: string };
      err.code = 'P2002';
      throw err;
    }
    const newRating: RatingRecord = { id: ratings.length + 1, ...data };
    ratings.push(newRating);
    return newRating;
  }
);

Object.defineProperty(prisma, 'proposal', {
  value: { findUnique: findUniqueProposal },
  configurable: true,
});

Object.defineProperty(prisma, 'rating', {
  value: { create: createRating },
  configurable: true,
});

const server = createApp().listen(0);
let baseUrl = '';

describe('POST /api/proposals/:id/rate (HU-09)', () => {
  before(async () => {
    if (!server.listening) await once(server, 'listening');
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(() => {
    server.close();
  });

  beforeEach(() => {
    findUniqueProposal.mock.resetCalls();
    createRating.mock.resetCalls();
    ratings = [];

    proposals = {
      1: {
        id: 1,
        itemSolicitadoId: 10,
        itemOfrecidoId: 20,
        proponenteId: 100,
        receptorId: 200,
        estado: 'CONCRETADA',
      },
      2: {
        id: 2,
        itemSolicitadoId: 11,
        itemOfrecidoId: 21,
        proponenteId: 100,
        receptorId: 200,
        estado: 'ACEPTADA',
      },
    };
  });

  it('401 si no hay token', async () => {
    const res = await fetch(`${baseUrl}/api/proposals/1/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ puntaje: 5 }),
    });
    assert.equal(res.status, 401);
  });

  it('400 si el puntaje no es válido (0 o 6 o no entero)', async () => {
    const token = signToken({ id: 100, email: 'user@frba.utn.edu.ar' });
    const res = await fetch(`${baseUrl}/api/proposals/1/rate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ puntaje: 6 }),
    });
    assert.equal(res.status, 400);
  });

  it('404 si la propuesta no existe', async () => {
    const token = signToken({ id: 100, email: 'user@frba.utn.edu.ar' });
    const res = await fetch(`${baseUrl}/api/proposals/999/rate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ puntaje: 5 }),
    });
    assert.equal(res.status, 404);
  });

  it('403 si el usuario no es participante de la propuesta', async () => {
    const token = signToken({ id: 300, email: 'tercero@frba.utn.edu.ar' });
    const res = await fetch(`${baseUrl}/api/proposals/1/rate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ puntaje: 5 }),
    });
    assert.equal(res.status, 403);
  });

  it('400 si la propuesta no está CONCRETADA', async () => {
    const token = signToken({ id: 100, email: 'user@frba.utn.edu.ar' });
    const res = await fetch(`${baseUrl}/api/proposals/2/rate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ puntaje: 5 }),
    });
    assert.equal(res.status, 400);
  });

  it('201 y crea la calificación para el receptor cuando califica el proponente', async () => {
    const token = signToken({ id: 100, email: 'user@frba.utn.edu.ar' });
    const res = await fetch(`${baseUrl}/api/proposals/1/rate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ puntaje: 4, comentario: 'Todo excelente!' }),
    });
    assert.equal(res.status, 201);
    const body = (await res.json()) as { rating: RatingRecord };
    assert.equal(body.rating.puntaje, 4);
    assert.equal(body.rating.comentario, 'Todo excelente!');
    assert.equal(body.rating.evaluadorId, 100);
    assert.equal(body.rating.evaluadoId, 200);
  });

  it('409 si el mismo participante intenta calificar dos veces', async () => {
    const token = signToken({ id: 100, email: 'user@frba.utn.edu.ar' });
    // Primera calificación
    await fetch(`${baseUrl}/api/proposals/1/rate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ puntaje: 5 }),
    });

    // Segunda calificación idéntico usuario
    const res = await fetch(`${baseUrl}/api/proposals/1/rate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ puntaje: 4 }),
    });
    assert.equal(res.status, 409);
  });
});
