import 'dotenv/config';
import cors from 'cors';
import express, { type Router } from 'express';
import helmet from 'helmet';
import { AppError } from './errors/AppError.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { getUploadsDir, UPLOADS_URL_PATH } from './lib/uploads.js';
import { notFound } from './middlewares/notFound.js';
import routes from './routes/index.js';

const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173';
const allowedOrigins = [clientUrl, clientUrl.replace('localhost', '127.0.0.1')];

// Recibe el router de la API por parámetro para poder montar rutas de prueba en los tests.
export function createApp(apiRouter: Router = routes) {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new AppError(403, 'CORS_NOT_ALLOWED', `Origen no permitido por CORS: ${origin}`));
      },
    })
  );
  app.use(express.json());

  // Fotos de los ítems (HU-13). Helmet marca los recursos como same-origin por defecto y el front
  // (otro origen) no podría mostrarlas, por eso se habilita la lectura cross-origin solo acá.
  // Los nombres son UUID y nunca se reescriben, así que se pueden cachear sin problema.
  app.use(
    UPLOADS_URL_PATH,
    (_req, res, next) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      next();
    },
    express.static(getUploadsDir(), { index: false, immutable: true, maxAge: '30d' })
  );

  app.use('/api', apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp();
