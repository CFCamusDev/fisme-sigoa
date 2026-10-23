import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { apiErrorResponseSchema } from '@sigoa/shared';
import { createApp } from '../../app.js';
import { createRateLimiter } from './rate-limit.js';
import { createTestEnv } from '../../test/test-env.js';

describe('rate-limit middleware', () => {
  it('responds 429 when the public limit is exceeded and follows uniform error format', async () => {
    const env = createTestEnv({
      RATE_LIMIT_PUBLIC_MAX: 2,
      RATE_LIMIT_WINDOW_MS: 60000,
    });

    const app = createApp({
      env,
      setupRoutes: (router) => {
        router.get('/public-resource', createRateLimiter('public', env), (_req, res) => {
          res.status(200).json({ ok: true });
        });
      },
    });

    // Petición 1: 200
    const res1 = await request(app).get('/public-resource');
    expect(res1.status).toBe(200);

    // Petición 2: 200
    const res2 = await request(app).get('/public-resource');
    expect(res2.status).toBe(200);

    // Petición 3: 429 Excedido
    const res3 = await request(app).get('/public-resource');
    expect(res3.status).toBe(429);
    expect(res3.body.error.code).toBe('RATE_LIMITED');
    expect(res3.body.error.message).toContain('excedido el límite');
    expect(res3.body.error.requestId).toBeDefined();

    const parsed = apiErrorResponseSchema.safeParse(res3.body);
    expect(parsed.success).toBe(true);
  });

  it('sends retry-after header on 429', async () => {
    const env = createTestEnv({
      RATE_LIMIT_PUBLIC_MAX: 1,
      RATE_LIMIT_WINDOW_MS: 60000,
    });

    const app = createApp({
      env,
      setupRoutes: (router) => {
        router.get('/rate-limited-endpoint', createRateLimiter('public', env), (_req, res) => {
          res.status(200).json({ ok: true });
        });
      },
    });

    await request(app).get('/rate-limited-endpoint');
    const blockedRes = await request(app).get('/rate-limited-endpoint');

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.headers['retry-after']).toBeDefined();
  });

  it('login profile uses its own lower limit', async () => {
    const env = createTestEnv({
      RATE_LIMIT_LOGIN_MAX: 1,
      RATE_LIMIT_PUBLIC_MAX: 10,
    });

    const app = createApp({
      env,
      setupRoutes: (router) => {
        router.post('/login', createRateLimiter('login', env), (_req, res) => {
          res.status(200).json({ ok: true });
        });
      },
    });

    const res1 = await request(app).post('/login');
    expect(res1.status).toBe(200);

    const res2 = await request(app).post('/login');
    expect(res2.status).toBe(429);
    expect(res2.body.error.code).toBe('RATE_LIMITED');
  });

  it('general limiter does not apply to /health', async () => {
    const env = createTestEnv({
      RATE_LIMIT_GENERAL_MAX: 2,
    });

    const app = createApp({
      env,
      setupRoutes: (router) => {
        router.get('/regular-api', (_req, res) => {
          res.status(200).json({ ok: true });
        });
      },
    });

    // Consumir el límite general
    await request(app).get('/regular-api');
    await request(app).get('/regular-api');
    const blockedRegular = await request(app).get('/regular-api');
    expect(blockedRegular.status).toBe(429);

    // /health sigue respondiendo 200
    const healthRes = await request(app).get('/health');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body).toEqual({ status: 'ok' });
  });

  it('trust proxy uses x-forwarded-for client ip', async () => {
    const env = createTestEnv({
      TRUST_PROXY: 1,
      RATE_LIMIT_PUBLIC_MAX: 1,
    });

    const app = createApp({
      env,
      setupRoutes: (router) => {
        router.get('/ip-test', createRateLimiter('public', env), (_req, res) => {
          res.status(200).json({ ok: true });
        });
      },
    });

    // IP 1: petición 1 ok
    const resIp1 = await request(app).get('/ip-test').set('X-Forwarded-For', '203.0.113.1');
    expect(resIp1.status).toBe(200);

    // IP 1: petición 2 bloqueada
    const resIp1Blocked = await request(app).get('/ip-test').set('X-Forwarded-For', '203.0.113.1');
    expect(resIp1Blocked.status).toBe(429);

    // IP 2 diferente: petición 1 ok (no se bloquea por la IP 1)
    const resIp2 = await request(app).get('/ip-test').set('X-Forwarded-For', '203.0.113.2');
    expect(resIp2.status).toBe(200);
  });
});
