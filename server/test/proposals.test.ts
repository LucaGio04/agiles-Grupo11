import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import { createApp } from '../src/app.js';
import { signToken } from '../src/lib/jwt.js';
import { prisma } from '../src/lib/prisma.js';

const storedProposal = {
  id: 3,
  estado: 'CONCRETADA',
  mensaje: '¿Lo cambiamos?',
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
  updatedAt: new Date('2026-10-20T00:00:00.000Z'),
  proponenteId: 1,
  receptorId: 2,
  proponente: { id: 1, nombre: 'Tomás Bellizzi' },
  receptor: { id: 2, nombre: 'Sofía Demo' },
  itemSolicitado: {
    id: 8,
    titulo: 'Libro pausado de Sofía',
    estado: 'PAUSADO',
    categoria: 'LIBRO',
    fotoUrl: null,
  },
  itemOfrecido: {
    id: 4,
    titulo: 'Instrumental intercambiado',
    estado: 'INTERCAMBIADO',
    categoria: 'INSTRUMENTAL',
    fotoUrl: '/uploads/4.jpg',
  },
  calificaciones: [
    { puntaje: 5, comentario: 'Genial', evaluadorId: 1, evaluadoId: 2 },
    { puntaje: 4, comentario: null, evaluadorId: 2, evaluadoId: 1 },
  ],
};

let rows = [storedProposal];
const findMany = mock.fn(async () => rows);
let pendientes = 2;
const count = mock.fn(async () => pendientes);

Object.defineProperty(prisma, 'proposal', {
  value: { findMany, count },
  configurable: true,
});

const server = createApp().listen(0);
let baseUrl = '';
const token = signToken({ id: 1, email: 'tomas@utn.edu.ar' });

type ErrorResponse = {
  error: { code: string; message: string; details?: { field: string; message: string }[] };
};
type ProposalBody = {
  data: Array<{
    rol: string;
    persona: { id: number; nombre: string };
    calificacionDada: { puntaje: number; comentario: string | null } | null;
    calificacionRecibida: { puntaje: number; comentario: string | null } | null;
  }>;
};

const listProposals = (search = '', authToken: string | null = token) =>
  fetch(`${baseUrl}/api/proposals${search}`, {
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
  });

const lastQuery = () =>
  findMany.mock.calls.at(-1)!.arguments[0] as { where: unknown; orderBy: unknown };

before(async () => {
  if (!server.listening) await once(server, 'listening');
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
});

describe('GET /api/proposals', () => {
  beforeEach(() => {
    findMany.mock.resetCalls();
    count.mock.resetCalls();
    rows = [storedProposal];
    pendientes = 2;
  });

  it('devuelve las propuestas del usuario con la otra persona, los ítems y las calificaciones', async () => {
    const res = await listProposals('?status=CONCRETADA');
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      data: Array<Record<string, unknown>>;
    };

    assert.deepEqual(body.data[0], {
      id: 3,
      estado: 'CONCRETADA',
      mensaje: '¿Lo cambiamos?',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-20T00:00:00.000Z',
      rol: 'proponente',
      persona: { id: 2, nombre: 'Sofía Demo' },
      itemSolicitado: {
        id: 8,
        titulo: 'Libro pausado de Sofía',
        estado: 'PAUSADO',
        categoria: 'LIBRO',
        fotoUrl: null,
      },
      itemOfrecido: {
        id: 4,
        titulo: 'Instrumental intercambiado',
        estado: 'INTERCAMBIADO',
        categoria: 'INSTRUMENTAL',
        fotoUrl: '/uploads/4.jpg',
      },
      calificacionDada: { puntaje: 5, comentario: 'Genial' },
      calificacionRecibida: { puntaje: 4, comentario: null },
    });

    const query = lastQuery();
    assert.deepEqual(query.where, {
      OR: [{ proponenteId: 1 }, { receptorId: 1 }],
      estado: 'CONCRETADA',
    });
    assert.deepEqual(query.orderBy, [{ updatedAt: 'desc' }, { id: 'desc' }]);
  });

  it('arma la calificación dada y recibida según quién consulta', async () => {
    const sofia = signToken({ id: 2, email: 'sofia.demo@utn.edu.ar' });
    const res = await listProposals('?status=CONCRETADA', sofia);
    const body = (await res.json()) as ProposalBody;
    assert.equal(body.data[0].rol, 'receptor');
    assert.deepEqual(body.data[0].persona, { id: 1, nombre: 'Tomás Bellizzi' });
    assert.deepEqual(body.data[0].calificacionDada, { puntaje: 4, comentario: null });
    assert.deepEqual(body.data[0].calificacionRecibida, { puntaje: 5, comentario: 'Genial' });
    assert.deepEqual((lastQuery().where as { OR: unknown }).OR, [
      { proponenteId: 2 },
      { receptorId: 2 },
    ]);
  });

  it('sin calificaciones devuelve null en dada y recibida', async () => {
    rows = [{ ...storedProposal, calificaciones: [] }];
    const body = (await (await listProposals('?status=CONCRETADA')).json()) as ProposalBody;
    assert.equal(body.data[0].calificacionDada, null);
    assert.equal(body.data[0].calificacionRecibida, null);
  });

  it('sin status devuelve todas las propuestas en las que participa', async () => {
    const res = await listProposals();
    assert.equal(res.status, 200);
    assert.deepEqual(lastQuery().where, {
      OR: [{ proponenteId: 1 }, { receptorId: 1 }],
    });
  });

  it('type=sent limita a las propuestas que envió el usuario', async () => {
    const res = await listProposals('?type=sent');
    assert.equal(res.status, 200);
    assert.deepEqual(lastQuery().where, { proponenteId: 1 });
  });

  it('type=received limita a las recibidas y se combina con status', async () => {
    const res = await listProposals('?type=received&status=PENDIENTE');
    assert.equal(res.status, 200);
    assert.deepEqual(lastQuery().where, { receptorId: 1, estado: 'PENDIENTE' });
  });

  it('un type inválido responde 400 y no consulta la base', async () => {
    const res = await listProposals('?type=otro');
    assert.equal(res.status, 400);
    const { error } = (await res.json()) as ErrorResponse;
    assert.equal(error.details?.[0].field, 'query.type');
    assert.equal(findMany.mock.callCount(), 0);
  });

  it('informa cuántas recibidas pendientes tiene el usuario, sin importar los filtros', async () => {
    const res = await listProposals('?type=sent&status=CONCRETADA');
    const body = (await res.json()) as { pendientesRecibidas: number };
    assert.equal(body.pendientesRecibidas, 2);
    assert.deepEqual(count.mock.calls[0].arguments[0], {
      where: { receptorId: 1, estado: 'PENDIENTE' },
    });
  });

  it('pone primero las recibidas pendientes y deja el resto por última actividad', async () => {
    rows = [
      { ...storedProposal, id: 10, estado: 'ACEPTADA', receptorId: 1, proponenteId: 2 },
      { ...storedProposal, id: 11, estado: 'PENDIENTE', receptorId: 2, proponenteId: 1 },
      { ...storedProposal, id: 12, estado: 'PENDIENTE', receptorId: 1, proponenteId: 2 },
    ];
    const body = (await (await listProposals()).json()) as { data: Array<{ id: number }> };
    assert.deepEqual(
      body.data.map((proposal) => proposal.id),
      [12, 10, 11]
    );
  });

  it('un estado inválido responde 400 y no consulta la base', async () => {
    const res = await listProposals('?status=PAUSADO');
    assert.equal(res.status, 400);
    const { error } = (await res.json()) as ErrorResponse;
    assert.equal(error.code, 'VALIDATION_ERROR');
    assert.deepEqual(error.details, [
      { field: 'query.status', message: 'El estado de la propuesta no es válido' },
    ]);
    assert.equal(findMany.mock.callCount(), 0);
  });

  it('sin token responde 401', async () => {
    const res = await listProposals('?status=CONCRETADA', null);
    assert.equal(res.status, 401);
    assert.equal(((await res.json()) as ErrorResponse).error.code, 'UNAUTHORIZED');
    assert.equal(findMany.mock.callCount(), 0);
  });
});
