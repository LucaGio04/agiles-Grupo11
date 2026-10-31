import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import { createApp } from '../src/app.js';
import { signToken } from '../src/lib/jwt.js';
import { prisma } from '../src/lib/prisma.js';

type ListArgs = {
  where: { ownerId?: number; estado?: string };
  orderBy?: unknown;
};

let listResult: unknown[] = [];
const findMany = mock.fn<(args: ListArgs) => Promise<unknown[]>>(async () => listResult);

Object.defineProperty(prisma, 'item', {
  value: { findMany },
  configurable: true,
});

const server = createApp().listen(0);
let baseUrl = '';
const token = signToken({ id: 1, email: 'tomas@utn.edu.ar' });

type ErrorResponse = {
  error: { code: string; message: string; details?: { field: string; message: string }[] };
};

const listMine = (search = '', authToken: string | null = token) =>
  fetch(`${baseUrl}/api/users/me/items${search}`, {
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
  });

const lastQuery = () => findMany.mock.calls.at(-1)!.arguments[0];

before(async () => {
  if (!server.listening) await once(server, 'listening');
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
});

describe('GET /api/users/me/items', () => {
  beforeEach(() => {
    findMany.mock.resetCalls();
    listResult = [];
  });

  it('devuelve solo los ítems del usuario del token, pausados incluidos, más recientes primero', async () => {
    listResult = [{ id: 4, titulo: 'Calculadora pausada', estado: 'PAUSADO', ownerId: 1 }];

    const res = await listMine();
    assert.equal(res.status, 200);
    const body = (await res.json()) as { data: { id: number; ownerId: number }[] };
    assert.deepEqual(body.data, listResult);

    const query = lastQuery();
    // El ownerId sale del token: un pausado de otra persona no entra en esta consulta.
    assert.deepEqual(query.where, { ownerId: 1, estado: { not: 'ELIMINADO' } });
    assert.deepEqual(query.orderBy, [{ createdAt: 'desc' }, { id: 'desc' }]);
  });

  it('filtra por estado cuando status es válido', async () => {
    await listMine('?status=PAUSADO');
    assert.deepEqual(lastQuery().where, { ownerId: 1, estado: 'PAUSADO' });
  });

  it('un status vacío equivale a no filtrar', async () => {
    const res = await listMine('?status=');
    assert.equal(res.status, 200);
    assert.deepEqual(lastQuery().where, { ownerId: 1, estado: { not: 'ELIMINADO' } });
  });

  it('un estado inválido responde 400 y no consulta la base', async () => {
    const res = await listMine('?status=NO_EXISTE');
    assert.equal(res.status, 400);
    const { error } = (await res.json()) as ErrorResponse;
    assert.equal(error.code, 'VALIDATION_ERROR');
    assert.deepEqual(error.details, [{ field: 'query.status', message: 'El estado no es válido' }]);
    assert.equal(findMany.mock.callCount(), 0);
  });

  it('ELIMINADO no es un filtro válido', async () => {
    const res = await listMine('?status=ELIMINADO');
    assert.equal(res.status, 400);
    assert.equal(findMany.mock.callCount(), 0);
  });

  it('sin token responde 401', async () => {
    const res = await listMine('', null);
    assert.equal(res.status, 401);
    assert.equal(((await res.json()) as ErrorResponse).error.code, 'UNAUTHORIZED');
    assert.equal(findMany.mock.callCount(), 0);
  });
});
