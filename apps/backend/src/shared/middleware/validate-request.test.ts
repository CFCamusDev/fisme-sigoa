import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { z } from 'zod';
import { apiErrorResponseSchema } from '@sigoa/shared';
import { createApp } from '../../app.js';
import { validateRequest, getValidated } from './validate-request.js';
import { createTestEnv } from '../../test/test-env.js';

describe('validateRequest middleware', () => {
  const env = createTestEnv();

  const userBodySchema = z.object({
    email: z.string().email(),
    age: z.number().int().min(18),
  });

  const idParamSchema = z.object({
    id: z.string().min(5),
  });

  const paginationQuerySchema = z.object({
    page: z.coerce.number().int().min(1),
  });

  it('passes valid body params and query to the handler', async () => {
    let capturedValidated: unknown;

    const app = createApp({
      env,
      setupRoutes: (router) => {
        router.post(
          '/users/:id',
          validateRequest({
            body: userBodySchema,
            params: idParamSchema,
            query: paginationQuerySchema,
          }),
          (req, res) => {
            capturedValidated = getValidated(res);
            res.status(200).json({ ok: true, body: req.body });
          },
        );
      },
    });

    const response = await request(app)
      .post('/users/user-123?page=2')
      .send({ email: 'test@untrm.edu.pe', age: 25 });

    expect(response.status).toBe(200);
    expect(capturedValidated).toEqual({
      body: { email: 'test@untrm.edu.pe', age: 25 },
      params: { id: 'user-123' },
      query: { page: 2 },
    });
  });

  it('responds 400 with details for invalid body and matches error schema', async () => {
    const app = createApp({
      env,
      setupRoutes: (router) => {
        router.post('/users', validateRequest({ body: userBodySchema }), (_req, res) => {
          res.status(200).json({ ok: true });
        });
      },
    });

    const response = await request(app).post('/users').send({ email: 'invalid-email', age: 15 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toHaveLength(2);

    const paths = response.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toContain('body.email');
    expect(paths).toContain('body.age');

    const parsed = apiErrorResponseSchema.safeParse(response.body);
    expect(parsed.success).toBe(true);
  });

  it('responds 400 with details for invalid params and query', async () => {
    const app = createApp({
      env,
      setupRoutes: (router) => {
        router.get(
          '/items/:id',
          validateRequest({
            params: idParamSchema,
            query: paginationQuerySchema,
          }),
          (_req, res) => {
            res.status(200).json({ ok: true });
          },
        );
      },
    });

    const response = await request(app).get('/items/a?page=-5');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');

    const paths = response.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toContain('params.id');
    expect(paths).toContain('query.page');
  });

  it('strips unknown keys from the body', async () => {
    let finalBody: unknown;

    const app = createApp({
      env,
      setupRoutes: (router) => {
        router.post('/secure-target', validateRequest({ body: userBodySchema }), (req, res) => {
          finalBody = req.body;
          res.status(200).json({ ok: true });
        });
      },
    });

    await request(app).post('/secure-target').send({
      email: 'admin@untrm.edu.pe',
      age: 30,
      role: 'SUPERADMIN_INJECTION',
    });

    expect(finalBody).toEqual({ email: 'admin@untrm.edu.pe', age: 30 });
    expect((finalBody as Record<string, unknown>)['role']).toBeUndefined();
  });

  it('reports validation messages in Spanish', async () => {
    const app = createApp({
      env,
      setupRoutes: (router) => {
        router.post('/spanish-test', validateRequest({ body: userBodySchema }), (_req, res) => {
          res.status(200).json({ ok: true });
        });
      },
    });

    const response = await request(app).post('/spanish-test').send({ email: 'not-email', age: 10 });

    expect(response.status).toBe(400);
    const messages = response.body.error.details.map((d: { message: string }) => d.message);

    // Debe contener texto en español como 'inválido' o 'caracteres' o 'esperaba'
    const hasSpanish = messages.some((msg: string) =>
      /correo|electrónico|inválido|invalido|esperaba|pequeño|grande|mayor/i.test(msg),
    );
    expect(hasSpanish).toBe(true);
  });
});
