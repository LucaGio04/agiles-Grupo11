import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import { createApp } from '../src/app.js';
import { signToken } from '../src/lib/jwt.js';
import { prisma } from '../src/lib/prisma.js';

type ProposalRow = {
  id: number;
  estado: string;
  proponenteId: number;
  receptorId: number;
  itemSolicitadoId: number;
  itemOfrecidoId: number;
  mensaje: string | null;
};

type ItemRow = { id: number; titulo: string; estado: string };

const baseProposal = (): ProposalRow => ({
  id: 20,
  estado: 'PENDIENTE',
  proponenteId: 1,
  receptorId: 2,
  itemSolicitadoId: 8,
  itemOfrecidoId: 4,
  mensaje: '¿Lo cambiamos?',
});

const baseItems = (): Record<number, ItemRow> => ({
  8: { id: 8, titulo: 'Libro de Sofía', estado: 'DISPONIBLE' },
  4: { id: 4, titulo: 'Apunte de Tomás', estado: 'DISPONIBLE' },
});

let proposal: ProposalRow | null = baseProposal();
let items: Record<number, ItemRow> = baseItems();
let proposalUpdates: { where: unknown; data: unknown }[] = [];
let itemUpdates: { where: unknown; data: unknown }[] = [];
let staleUpdate = false;

const queryRaw = mock.fn(async () => []);
const findUnique = mock.fn(
  async ({ where, include }: { where: { id: number }; include?: unknown }) => {
    if (!proposal || proposal.id !== where.id) return null;
    if (!include) {
      return {
        id: proposal.id,
        estado: proposal.estado,
        proponenteId: proposal.proponenteId,
        receptorId: proposal.receptorId,
        itemSolicitadoId: proposal.itemSolicitadoId,
        itemOfrecidoId: proposal.itemOfrecidoId,
      };
    }
    return {
      ...proposal,
      createdAt: new Date('2026-11-01T00:00:00.000Z'),
      updatedAt: new Date('2026-11-15T12:00:00.000Z'),
      proponente: { id: 1, nombre: 'Tomás Bellizzi' },
      receptor: { id: 2, nombre: 'Sofía Demo' },
      itemSolicitado: items[proposal.itemSolicitadoId],
      itemOfrecido: items[proposal.itemOfrecidoId],
      calificaciones: [],
    };
  }
);
const proposalUpdateMany = mock.fn(
  async ({ where, data }: { where: { id: number; estado: string }; data: { estado: string } }) => {
    proposalUpdates.push({ where, data });
    if (staleUpdate || !proposal || proposal.id !== where.id || proposal.estado !== where.estado) {
      return { count: 0 };
    }
    proposal = { ...proposal, estado: data.estado };
    return { count: 1 };
  }
);
const itemUpdateMany = mock.fn(
  async (args: { where: { id: { in: number[] }; estado: string }; data: { estado: string } }) => {
    itemUpdates.push(args);
    for (const id of args.where.id.in) {
      const item = items[id];
      if (item?.estado === args.where.estado) items[id] = { ...item, estado: args.data.estado };
    }
    return { count: args.where.id.in.length };
  }
);

const tx = {
  $queryRaw: queryRaw,
  proposal: { findUnique, updateMany: proposalUpdateMany },
  item: { updateMany: itemUpdateMany },
};
const transaction = mock.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx));

Object.defineProperty(prisma, '$transaction', {
  value: transaction,
  configurable: true,
});

const server = createApp().listen(0);
let baseUrl = '';
const proponente = signToken({ id: 1, email: 'tomas@utn.edu.ar' });
const receptor = signToken({ id: 2, email: 'sofia.demo@utn.edu.ar' });
const ajeno = signToken({ id: 3, email: 'otro@utn.edu.ar' });

type ErrorResponse = {
  error: { code: string; message: string; details?: { field: string; message: string }[] };
};

const cancel = (id: number | string, body: unknown, authToken: string | null = proponente) =>
  fetch(`${baseUrl}/api/proposals/${id}`, {
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

describe('PATCH /api/proposals/:id', () => {
  beforeEach(() => {
    proposal = baseProposal();
    items = baseItems();
    proposalUpdates = [];
    itemUpdates = [];
    staleUpdate = false;
    queryRaw.mock.resetCalls();
    findUnique.mock.resetCalls();
    proposalUpdateMany.mock.resetCalls();
    itemUpdateMany.mock.resetCalls();
    transaction.mock.resetCalls();
  });

  it('quien la envió cancela una pendiente y queda CANCELADA', async () => {
    const res = await cancel(20, { accion: 'cancelar' });
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      data: { id: number; estado: string; rol: string; persona: { id: number; nombre: string } };
    };
    assert.deepEqual(body.data, {
      id: 20,
      estado: 'CANCELADA',
      mensaje: '¿Lo cambiamos?',
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-15T12:00:00.000Z',
      rol: 'proponente',
      persona: { id: 2, nombre: 'Sofía Demo' },
      itemSolicitado: { id: 8, titulo: 'Libro de Sofía', estado: 'DISPONIBLE' },
      itemOfrecido: { id: 4, titulo: 'Apunte de Tomás', estado: 'DISPONIBLE' },
      calificacionDada: null,
      calificacionRecibida: null,
    });
    assert.deepEqual(proposalUpdates[0], {
      where: { id: 20, estado: 'PENDIENTE' },
      data: { estado: 'CANCELADA' },
    });
    assert.equal(itemUpdateMany.mock.callCount(), 0);
    assert.equal(queryRaw.mock.callCount(), 1);
  });

  it('el receptor no puede cancelar una pendiente y el estado no cambia', async () => {
    const res = await cancel(20, { accion: 'cancelar' }, receptor);
    assert.equal(res.status, 409);
    assert.equal(
      ((await res.json()) as ErrorResponse).error.message,
      'Mientras está pendiente, solo quien la envió puede cancelarla'
    );
    assert.equal(proposalUpdateMany.mock.callCount(), 0);
    assert.equal(itemUpdateMany.mock.callCount(), 0);
  });

  it('cualquiera de las dos partes cancela una aceptada y libera los ítems reservados', async () => {
    proposal = { ...baseProposal(), estado: 'ACEPTADA' };
    items[8] = { ...items[8], estado: 'RESERVADO' };
    items[4] = { ...items[4], estado: 'RESERVADO' };
    const res = await cancel(20, { accion: 'cancelar' }, receptor);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      data: { estado: string; rol: string; itemSolicitado: { estado: string } };
    };
    assert.equal(body.data.estado, 'CANCELADA');
    assert.equal(body.data.rol, 'receptor');
    assert.equal(body.data.itemSolicitado.estado, 'DISPONIBLE');
    assert.deepEqual(proposalUpdates[0], {
      where: { id: 20, estado: 'ACEPTADA' },
      data: { estado: 'CANCELADA' },
    });
    assert.deepEqual(itemUpdates[0], {
      where: { id: { in: [4, 8] }, estado: 'RESERVADO' },
      data: { estado: 'DISPONIBLE' },
    });
    assert.equal(queryRaw.mock.callCount(), 2);
  });

  it('quien la envió también puede cancelar una aceptada', async () => {
    proposal = { ...baseProposal(), estado: 'ACEPTADA' };
    const res = await cancel(20, { accion: 'cancelar' });
    assert.equal(res.status, 200);
    assert.equal(itemUpdateMany.mock.callCount(), 1);
  });

  it('si el estado cambió entre la lectura y la escritura responde 409 y no libera ítems', async () => {
    proposal = { ...baseProposal(), estado: 'ACEPTADA' };
    staleUpdate = true;
    const res = await cancel(20, { accion: 'cancelar' });
    assert.equal(res.status, 409);
    assert.equal(
      ((await res.json()) as ErrorResponse).error.message,
      'Esta propuesta ya no se puede cancelar'
    );
    assert.equal(itemUpdateMany.mock.callCount(), 0);
    assert.equal(proposal?.estado, 'ACEPTADA');
  });

  it('quien no participa responde 403 y no modifica la propuesta', async () => {
    const res = await cancel(20, { accion: 'cancelar' }, ajeno);
    assert.equal(res.status, 403);
    assert.equal(((await res.json()) as ErrorResponse).error.code, 'FORBIDDEN');
    assert.equal(proposalUpdateMany.mock.callCount(), 0);
  });

  it('una propuesta inexistente responde 404', async () => {
    proposal = null;
    const res = await cancel(99, { accion: 'cancelar' });
    assert.equal(res.status, 404);
    assert.equal(((await res.json()) as ErrorResponse).error.code, 'NOT_FOUND');
    assert.equal(proposalUpdateMany.mock.callCount(), 0);
  });

  for (const estado of ['RECHAZADA', 'CANCELADA', 'CONCRETADA']) {
    it(`una propuesta ${estado} responde 409`, async () => {
      proposal = { ...baseProposal(), estado };
      const res = await cancel(20, { accion: 'cancelar' });
      assert.equal(res.status, 409);
      assert.equal(
        ((await res.json()) as ErrorResponse).error.message,
        'Esta propuesta ya no se puede cancelar'
      );
      assert.equal(proposalUpdateMany.mock.callCount(), 0);
      assert.equal(itemUpdateMany.mock.callCount(), 0);
    });
  }

  it('una acción distinta de cancelar responde 400 y no abre la transacción', async () => {
    const res = await cancel(20, { accion: 'aceptar' });
    assert.equal(res.status, 400);
    const { error } = (await res.json()) as ErrorResponse;
    assert.equal(error.code, 'VALIDATION_ERROR');
    assert.deepEqual(error.details, [
      { field: 'body.accion', message: 'La acción tiene que ser cancelar' },
    ]);
    assert.equal(transaction.mock.callCount(), 0);
  });

  it('un id inválido responde 400', async () => {
    const res = await cancel('abc', { accion: 'cancelar' });
    assert.equal(res.status, 400);
    const { error } = (await res.json()) as ErrorResponse;
    assert.equal(error.code, 'VALIDATION_ERROR');
    assert.deepEqual(error.details, [
      { field: 'params.id', message: 'El id de la propuesta no es válido' },
    ]);
    assert.equal(transaction.mock.callCount(), 0);
  });

  it('sin token responde 401', async () => {
    const res = await cancel(20, { accion: 'cancelar' }, null);
    assert.equal(res.status, 401);
    assert.equal(((await res.json()) as ErrorResponse).error.code, 'UNAUTHORIZED');
    assert.equal(transaction.mock.callCount(), 0);
  });
});
