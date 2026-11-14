import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { apiErrorResponseSchema } from '@sigoa/shared';
import { createApp } from '../../app.js';
import { AppError, NotFoundError, ValidationError } from '../errors/index.js';
import { createTestEnv } from '../../test/test-env.js';

describe('global error-handler middleware', () => {
  const baseEnv = createTestEnv();

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

  it('responds 400 instead of 500 when the json body exceeds the size limit', async () => {
    const app = createApp({
      env: baseEnv,
      setupRoutes: (router) => {
        router.post('/test-large', (_req, res) => {
          res.status(200).json({ ok: true });
        });
      },
    });

    const response = await request(app)
      .post('/test-large')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ content: 'a'.repeat(150_000) }));

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toBe(
      'El cuerpo de la solicitud excede el tamaño máximo permitido.',
    );
    expect(response.body.error.requestId).toBeDefined();
    expect(apiErrorResponseSchema.safeParse(response.body).success).toBe(true);
  });

  it('keeps answering 500 for an error whose type is not a size error', async () => {
    const app = createApp({
      env: baseEnv,
      setupRoutes: (router) => {
        router.get('/test-typed', () => {
          throw Object.assign(new Error('otro'), { type: 'other.type' });
        });
      },
    });

    const response = await request(app).get('/test-typed');

    expect(response.status).toBe(500);
  });

  it('includes retryAfterSeconds and sets the Retry-After header when present', async () => {
    class CustomLockedError extends AppError {
      constructor(retryAfterSeconds: number) {
        super(
          'Acción bloqueada temporalmente',
          'ACCOUNT_LOCKED',
          429,
          undefined,
          retryAfterSeconds,
        );
      }
    }

    const app = createApp({
      env: baseEnv,
      setupRoutes: (router) => {
        router.post('/test-retry-after', () => {
          throw new CustomLockedError(600);
        });
      },
    });

    const response = await request(app).post('/test-retry-after');

    expect(response.status).toBe(429);
    expect(response.headers['retry-after']).toBe('600');
    expect(response.body.error.code).toBe('ACCOUNT_LOCKED');
    expect(response.body.error.retryAfterSeconds).toBe(600);

    const parsed = apiErrorResponseSchema.safeParse(response.body);
    expect(parsed.success).toBe(true);
  });
});
