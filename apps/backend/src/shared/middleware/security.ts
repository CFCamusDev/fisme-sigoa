import type { RequestHandler } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import type { Env } from '../../config/env.js';

export function createSecurityMiddleware(env: Env): RequestHandler[] {
  const helmetMiddleware = helmet({
    hidePoweredBy: true,
    hsts: env.HSTS_ENABLED
      ? {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: false,
        }
      : false,
  });

  const corsMiddleware = cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (env.CORS_ORIGIN.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'Retry-After'],
  });

  return [helmetMiddleware, corsMiddleware];
}
