import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AppError } from '../errors/AppError.js';
import { ALLOWED_IMAGE_TYPES, detectImageType, getUploadsDir } from '../lib/uploads.js';

// Guarda la foto de un ítem (HU-13) en la carpeta de uploads y devuelve el nombre del archivo.
// El nombre y la extensión los decide el servidor: se ignora el nombre original que mandó el cliente.
export async function saveImage(file: Express.Multer.File | undefined) {
  if (!file) {
    throw new AppError(400, 'FILE_REQUIRED', 'Adjuntá una imagen en el campo "file"');
  }

  const type = detectImageType(file.buffer);
  if (!type) {
    throw new AppError(
      400,
      'INVALID_FILE_TYPE',
      'El archivo tiene que ser una imagen JPG, PNG o WebP'
    );
  }

  const dir = getUploadsDir();
  const filename = `${randomUUID()}.${ALLOWED_IMAGE_TYPES[type]}`;
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), file.buffer);
  return filename;
}
