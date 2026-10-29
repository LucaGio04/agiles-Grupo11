import path from 'node:path';

// Subida de fotos de ítems (HU-13).
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
export const UPLOADS_URL_PATH = '/uploads';

// Tipos permitidos: el valor es la extensión con la que se guarda el archivo.
export const ALLOWED_IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

export type AllowedImageType = keyof typeof ALLOWED_IMAGE_TYPES;

// Carpeta donde se guardan las fotos. Se puede cambiar con UPLOADS_DIR (por ejemplo, a un disco persistente).
// Se lee en cada uso (y no al importar) para que los tests puedan apuntarla a una carpeta temporal.
export function getUploadsDir() {
  return process.env.UPLOADS_DIR
    ? path.resolve(process.env.UPLOADS_DIR)
    : path.resolve(import.meta.dirname, '../../uploads');
}

// Detecta el tipo real mirando los primeros bytes del archivo. El Content-Type y el nombre
// los manda el cliente y se pueden falsificar, así que no se confía en ellos.
export function detectImageType(buffer: Buffer): AllowedImageType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}
