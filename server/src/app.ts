import 'dotenv/config';
import cors from 'cors';
import express, { type Router } from 'express';
import helmet from 'helmet';
import { AppError } from './errors/AppError.js';
import { errorHandler } from './middlewares/errorHandler.js';
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
    }),
  );
  app.use(express.json());

  app.use('/api', apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp();
