import express, { type Express } from 'express';
import { healthResponseSchema } from '@sigoa/shared';

export function createApp(): Express {
  const app = express();

  app.use(express.json());

  app.get('/health', (_req, res) => {
    const payload = healthResponseSchema.parse({ status: 'ok' });
    res.status(200).json(payload);
  });

  return app;
}
