import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { getUploadsDir, UPLOADS_URL_PATH } from '../src/lib/uploads.js';

// Copia una foto de prueba (seed-assets) a la carpeta de uploads y devuelve su URL pública.
export function fotoDeSeed(nombre: string) {
  const archivo = `seed-${nombre}.jpg`;
  const uploadsDir = getUploadsDir();
  mkdirSync(uploadsDir, { recursive: true });
  copyFileSync(
    path.resolve(import.meta.dirname, 'seed-assets', `${nombre}.jpg`),
    path.join(uploadsDir, archivo)
  );

  const baseUrl =
    process.env.API_PUBLIC_URL?.trim().replace(/\/+$/, '') ||
    `http://localhost:${process.env.PORT ?? 3001}`;
  return `${baseUrl}${UPLOADS_URL_PATH}/${archivo}`;
}
