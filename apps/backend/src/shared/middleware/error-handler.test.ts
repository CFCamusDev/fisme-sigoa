import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { apiErrorResponseSchema } from '@sigoa/shared';
import { createApp } from '../../app.js';
import { NotFoundError, ValidationError } from '../errors/index.js';
import type { Env } from '../../config/env.js';

describe('global error-handler middleware', () => {
  const baseEnv: Env = {
    NODE_ENV: 'test',
    PORT: 3000,
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  };

  it('maps AppError to the uniform error body and matches schema', async () => {
    const app = createApp({
      env: baseEnv,
      setupRoutes: (router) => {
        router.get('/test-not-found', () => {
          throw new NotFoundError('Elemento buscado no existe');
        });
      },
    });

    const response = await request(app).get('/test-not-found');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Elemento buscado no existe',
        requestId: expect.any(String),
      },
    });

    const parsed = apiErrorResponseSchema.safeParse(response.body);
    expect(parsed.success).toBe(true);
  });

  it('includes validation details and request id for ValidationError', async () => {
    const app = createApp({
      env: baseEnv,
      setupRoutes: (router) => {
        router.get('/test-validation', () => {
          throw new ValidationError('Parámetros incorrectos', [
            { path: 'dni', message: 'Debe contener 8 dígitos' },
          ]);
        });
      },
    });

    const response = await request(app).get('/test-validation');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual([
      { path: 'dni', message: 'Debe contener 8 dígitos' },
    ]);
    expect(response.body.error.requestId).toBeDefined();

    const parsed = apiErrorResponseSchema.safeParse(response.body);
    expect(parsed.success).toBe(true);
  });

  it('hides stack and internal message on unexpected errors', async () => {
    const app = createApp({
      env: baseEnv,
      setupRoutes: (router) => {
        router.get('/test-crash', () => {
          throw new Error('Database password was 123456 in line 99');
        });
      },
    });

    const response = await request(app).get('/test-crash');

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
    expect(response.body.error.message).not.toContain('123456');
    expect(response.body.error.message).toBe('Ha ocurrido un error inesperado en el servidor.');
    expect(response.body.stack).toBeUndefined();
    expect(response.body.error.requestId).toBeDefined();

    const parsed = apiErrorResponseSchema.safeParse(response.body);
    expect(parsed.success).toBe(true);
  });

  it('responds 404 with uniform body for unknown routes', async () => {
    const app = createApp({ env: baseEnv });

    const response = await request(app).get('/unknown-endpoint-route');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.error.requestId).toBeDefined();

    const parsed = apiErrorResponseSchema.safeParse(response.body);
    expect(parsed.success).toBe(true);
  });

  it('responds 400 for malformed json body', async () => {
    const app = createApp({
      env: baseEnv,
      setupRoutes: (router) => {
        router.post('/test-json', (_req, res) => {
          res.status(200).json({ ok: true });
        });
      },
    });

    const response = await request(app)
      .post('/test-json')
      .set('Content-Type', 'application/json')
      .send('{"invalidJson": ');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toContain('JSON');

    const parsed = apiErrorResponseSchema.safeParse(response.body);
    expect(parsed.success).toBe(true);
  });
});
