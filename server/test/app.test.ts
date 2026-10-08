import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { Router } from 'express';
import { z } from 'zod';
import { createApp } from '../src/app.js';
import { validate } from '../src/middlewares/validate.js';
import routes from '../src/routes/index.js';

// Rutas solo para los tests, montadas junto a las reales.
const testRouter = Router();
testRouter.use(routes);
testRouter.post(
  '/test/echo',
  validate({
    body: z.object({ email: z.email(), age: z.number().int().min(18) }),
    query: z.object({ page: z.coerce.number().int().min(1).default(1) }),
  }),
  (req, res) => {
    res.json({ body: req.body, query: req.query });
  },
);
testRouter.get('/test/boom', () => {
  throw new Error('fallo secreto');
});
testRouter.get('/test/boom-async', async () => {
  throw new Error('fallo secreto async');
});

const server = createApp(testRouter).listen(0);
let baseUrl = '';

type ErrorResponse = {
  error: { code: string; message: string; details?: unknown };
};

const readError = async (res: Response) => ((await res.json()) as ErrorResponse).error;

const post = (path: string, body: string) =>
  fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

describe('base del servidor', () => {
  const originalError = console.error;

  before(async () => {
    if (!server.listening) await once(server, 'listening');
    baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
    console.error = () => {};
  });

  after(() => {
    console.error = originalError;
    server.close();
  });

  it('GET /api/health responde 200', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ok' });
    assert.ok(res.headers.get('x-content-type-options'), 'helmet debería agregar sus headers');
  });

  it('un body inválido devuelve 400 con el detalle de los campos', async () => {
    const res = await post('/api/test/echo?page=0', JSON.stringify({ email: 'no-es-email' }));
    assert.equal(res.status, 400);

    const error = await readError(res);
    assert.equal(error.code, 'VALIDATION_ERROR');
    assert.equal(typeof error.message, 'string');
    const fields = (error.details as { field: string }[]).map((d) => d.field).sort();
    assert.deepEqual(fields, ['body.age', 'body.email', 'query.page']);
  });

  it('un body válido llega parseado al controller', async () => {
    const res = await post('/api/test/echo', JSON.stringify({ email: 'a@utn.edu.ar', age: 20 }));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      body: { email: 'a@utn.edu.ar', age: 20 },
      query: { page: 1 },
    });
  });

  it('un JSON mal formado devuelve 400 con el formato estándar', async () => {
    const res = await post('/api/test/echo', '{ esto no es json');
    assert.equal(res.status, 400);
    assert.equal((await readError(res)).code, 'INVALID_JSON');
  });

  it('una ruta inexistente devuelve 404 con el formato estándar', async () => {
    for (const path of ['/api/no-existe', '/no-existe']) {
      const res = await fetch(`${baseUrl}${path}`);
      assert.equal(res.status, 404);

      const body = (await res.json()) as ErrorResponse;
      assert.deepEqual(Object.keys(body), ['error']);
      assert.equal(body.error.code, 'NOT_FOUND');
      assert.equal(typeof body.error.message, 'string');
    }
  });

  it('un origen no permitido devuelve 403 con el formato estándar', async () => {
    const res = await fetch(`${baseUrl}/api/health`, { headers: { Origin: 'http://otro.com' } });
    assert.equal(res.status, 403);
    assert.equal((await readError(res)).code, 'CORS_NOT_ALLOWED');
  });

  it('un error no controlado devuelve 500 sin exponer el stack en producción', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      for (const path of ['/api/test/boom', '/api/test/boom-async']) {
        const res = await fetch(`${baseUrl}${path}`);
        assert.equal(res.status, 500);

        const text = await res.text();
        assert.deepEqual(JSON.parse(text), {
          error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' },
        });
        assert.ok(!text.includes('fallo secreto'));
      }
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('fuera de producción el 500 incluye el detalle para depurar', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      const res = await fetch(`${baseUrl}/api/test/boom`);
      assert.equal(res.status, 500);
      const details = (await readError(res)).details as { message: string; stack: string };
      assert.equal(details.message, 'fallo secreto');
      assert.equal(typeof details.stack, 'string');
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
