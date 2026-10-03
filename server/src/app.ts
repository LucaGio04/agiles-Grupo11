import 'dotenv/config';
import cors from 'cors';
import express from 'express';

const app = express();

const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173';
const allowedOrigins = [
  clientUrl,
  clientUrl.replace('localhost', '127.0.0.1'),
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
  }),
);
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export default app;
