import type { Env } from '../config/env.js';

export function createTestEnv(overrides: Partial<Env> = {}): Env {
  return {
    NODE_ENV: 'test',
    PORT: 3000,
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    CORS_ORIGIN: ['http://localhost:5173'],
    HSTS_ENABLED: true,
    ...overrides,
  };
}
