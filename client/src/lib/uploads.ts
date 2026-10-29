import { apiFetch } from './api.ts';

// Reglas de la foto del ítem (HU-13). Tienen que coincidir con las del backend (POST /api/uploads).
export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp';
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

// Devuelve el mensaje de error si el archivo no sirve, o null si se puede subir.
export function validatePhoto(file: File): string | null {
  if (!PHOTO_ACCEPT.split(',').includes(file.type)) {
    return 'La foto tiene que ser una imagen JPG, PNG o WebP';
  }
  if (file.size > PHOTO_MAX_BYTES) {
    return `La foto supera el tamaño máximo de ${PHOTO_MAX_BYTES / 1024 / 1024} MB`;
  }
  return null;
}

// Sube la foto al backend y devuelve su URL pública.
export async function uploadPhoto(file: File) {
  const body = new FormData();
  body.append('file', file);
  const { url } = await apiFetch<{ url: string }>('/api/uploads', { method: 'POST', body });
  return url;
}
