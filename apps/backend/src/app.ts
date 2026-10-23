import express, { type Express } from 'express';
import { healthResponseSchema } from '@sigoa/shared';
import { createLogger, type Logger } from './shared/logger/logger.js';
import { createHttpLogger } from './shared/middleware/http-logger.js';
import { errorHandler, notFoundHandler } from './shared/middleware/error-handler.js';
import type { Env } from './config/env.js';

export interface AppOptions {
  logger?: Logger;
  env?: Env;
  setupRoutes?: (app: Express) => void;
}

export function createApp(options: AppOptions = {}): Express {
  const env: Env =
    options.env ??
    ({
      NODE_ENV: (process.env['NODE_ENV'] as 'development' | 'test' | 'production') || 'test',
      PORT: Number(process.env['PORT']) || 3000,
      LOG_LEVEL:
        (process.env['LOG_LEVEL'] as
          'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent') || 'silent',
      DATABASE_URL: process.env['DATABASE_URL'] || 'postgresql://test:test@localhost:5432/test',
    } satisfies Env);

  const logger = options.logger ?? createLogger(env);
  const app = express();

  app.use(createHttpLogger(logger));
  app.use(express.json());

  app.get('/health', (_req, res) => {
    const payload = healthResponseSchema.parse({ status: 'ok' });
    res.status(200).json(payload);
  });

  if (options.setupRoutes) {
    options.setupRoutes(app);
  }

  // Manejo de 404 para rutas no encontradas y manejador global de errores
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
