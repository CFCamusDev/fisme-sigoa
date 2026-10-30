import type { Env } from '../config/env.js';

export function createTestEnv(overrides: Partial<Env> = {}): Env {
  return {
    NODE_ENV: 'test',
    PORT: 3000,
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    CORS_ORIGIN: ['http://localhost:5173'],
    HSTS_ENABLED: true,
    TRUST_PROXY: 0,
    RATE_LIMIT_WINDOW_MS: 60000,
    RATE_LIMIT_PUBLIC_MAX: 30,
    RATE_LIMIT_LOGIN_MAX: 10,
    RATE_LIMIT_GENERAL_MAX: 300,
    EMAIL_PROVIDER: 'memory',
    FILE_STORAGE_PROVIDER: 'memory',
    APP_PUBLIC_URL: 'http://localhost:5173',
    ...overrides,
  };
}
