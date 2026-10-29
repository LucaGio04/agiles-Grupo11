import type { Request, RequestHandler } from 'express';
import { UPLOADS_URL_PATH } from '../lib/uploads.js';
import * as uploadService from '../services/upload.service.js';

// URL pública del backend, para armar el link de la foto. En producción (detrás de un proxy)
// conviene fijarla con API_PUBLIC_URL; si no, se toma del propio request.
function publicBaseUrl(req: Request) {
  const configured = process.env.API_PUBLIC_URL?.trim().replace(/\/+$/, '');
  return configured || `${req.protocol}://${req.get('host')}`;
}

export const create: RequestHandler = async (req, res) => {
  const filename = await uploadService.saveImage(req.file);
  res.status(201).json({ url: `${publicBaseUrl(req)}${UPLOADS_URL_PATH}/${filename}` });
};
