import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createApp } from '../src/app.js';
import { signToken } from '../src/lib/jwt.js';
import { MAX_UPLOAD_BYTES } from '../src/lib/uploads.js';

// Las fotos se guardan en una carpeta temporal para no ensuciar server/uploads.
const uploadsDir = await mkdtemp(path.join(tmpdir(), 'trueque-uploads-'));
process.env.UPLOADS_DIR = uploadsDir;

const server = createApp().listen(0);
let baseUrl = '';
const token = signToken({ id: 1, email: 'tomas@utn.edu.ar' });

type ErrorResponse = { error: { code: string; message: string } };

// Cabeceras mínimas (magic bytes) de cada formato, seguidas de relleno.
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 1),
]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 2)]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x40, 0, 0, 0]),
  Buffer.from('WEBP'),
  Buffer.alloc(64, 3),
]);

function formWith(content: Buffer, filename: string, type: string, field = 'file') {
  const form = new FormData();
  form.append(field, new Blob([new Uint8Array(content)], { type }), filename);
  return form;
}

const upload = (body?: FormData, authToken: string | null = token) =>
  fetch(`${baseUrl}/api/uploads`, {
    method: 'POST',
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    body,
  });

const savedFiles = () => readdir(uploadsDir).catch(() => [] as string[]);

async function assertError(res: Response, status: number, code: string) {
  assert.equal(res.status, status);
  const body = (await res.json()) as ErrorResponse;
  assert.equal(body.error.code, code);
  assert.equal(typeof body.error.message, 'string');
  return body;
}

describe('POST /api/uploads (HU-13)', () => {
  before(async () => {
    if (!server.listening) await once(server, 'listening');
    baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server.close();
    await rm(uploadsDir, { recursive: true, force: true });
  });

  it('sin token responde 401 y no guarda nada', async () => {
    const res = await upload(formWith(PNG, 'foto.png', 'image/png'), null);
    await assertError(res, 401, 'UNAUTHORIZED');
    assert.deepEqual(await savedFiles(), []);
  });

  for (const [name, content, type, ext] of [
    ['PNG', PNG, 'image/png', 'png'],
    ['JPG', JPG, 'image/jpeg', 'jpg'],
    ['WebP', WEBP, 'image/webp', 'webp'],
  ] as const) {
    it(`sube una imagen ${name} y devuelve su URL`, async () => {
      const res = await upload(formWith(content, `mi foto.${ext}`, type));
      assert.equal(res.status, 201);
      const { url } = (await res.json()) as { url: string };
      assert.match(url, new RegExp(`^${baseUrl}/uploads/[0-9a-f-]{36}\\.${ext}$`));

      // El archivo queda guardado y se puede pedir por la URL devuelta.
      const filename = url.split('/').pop()!;
      assert.deepEqual(await readFile(path.join(uploadsDir, filename)), content);

      const image = await fetch(url);
      assert.equal(image.status, 200);
      assert.equal(image.headers.get('content-type'), type);
      assert.deepEqual(Buffer.from(await image.arrayBuffer()), content);
      // Sin esto el navegador bloquearía la foto cuando la pide el front (otro origen).
      assert.equal(image.headers.get('cross-origin-resource-policy'), 'cross-origin');
    });
  }

  it('ignora el nombre del archivo que manda el cliente (path traversal)', async () => {
    const before = await savedFiles();
    const res = await upload(formWith(PNG, '../../evil.png', 'image/png'));
    assert.equal(res.status, 201);
    const { url } = (await res.json()) as { url: string };
    assert.match(url, /\/uploads\/[0-9a-f-]{36}\.png$/);
    assert.equal((await savedFiles()).length, before.length + 1);
  });

  it('sin archivo responde 400 FILE_REQUIRED', async () => {
    await assertError(await upload(new FormData()), 400, 'FILE_REQUIRED');
    // Ni siquiera es multipart.
    await assertError(await upload(), 400, 'FILE_REQUIRED');
  });

  it('rechaza formatos que no son JPG, PNG o WebP', async () => {
    const before = await savedFiles();
    const gif = Buffer.from('GIF89a-contenido');
    await assertError(await upload(formWith(gif, 'a.gif', 'image/gif')), 400, 'INVALID_FILE_TYPE');
    await assertError(
      await upload(formWith(Buffer.from('%PDF-1.7'), 'a.pdf', 'application/pdf')),
      400,
      'INVALID_FILE_TYPE'
    );
    assert.deepEqual(await savedFiles(), before);
  });

  it('rechaza un archivo que dice ser imagen pero no lo es', async () => {
    const before = await savedFiles();
    const fake = Buffer.from('<script>alert(1)</script>');
    await assertError(await upload(formWith(fake, 'x.png', 'image/png')), 400, 'INVALID_FILE_TYPE');
    assert.deepEqual(await savedFiles(), before);
  });

  it('rechaza imágenes de más de 5 MB con 413 FILE_TOO_LARGE', async () => {
    const before = await savedFiles();
    const big = Buffer.concat([PNG, Buffer.alloc(MAX_UPLOAD_BYTES)]);
    const body = await assertError(
      await upload(formWith(big, 'grande.png', 'image/png')),
      413,
      'FILE_TOO_LARGE'
    );
    assert.match(body.error.message, /5 MB/);
    assert.deepEqual(await savedFiles(), before);
  });

  it('acepta una imagen de exactamente 5 MB', async () => {
    const exact = Buffer.concat([PNG, Buffer.alloc(MAX_UPLOAD_BYTES - PNG.length)]);
    assert.equal(exact.length, MAX_UPLOAD_BYTES);
    const res = await upload(formWith(exact, 'justa.png', 'image/png'));
    assert.equal(res.status, 201);
  });

  it('rechaza un campo con otro nombre o más de un archivo', async () => {
    await assertError(
      await upload(formWith(PNG, 'a.png', 'image/png', 'foto')),
      400,
      'BAD_REQUEST'
    );

    const two = formWith(PNG, 'a.png', 'image/png');
    two.append('file', new Blob([new Uint8Array(JPG)], { type: 'image/jpeg' }), 'b.jpg');
    await assertError(await upload(two), 400, 'BAD_REQUEST');
  });
});
