import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../../../shared/middleware/error-handler.js';
import type { CreateResponseScaleUseCase } from '../../application/create-response-scale.js';
import { ResponseScalesController } from './response-scales.controller.js';
import { createResponseScalesRouter } from './response-scales.routes.js';

describe('/response-scales middleware chain (T-012-11, RNF-009)', () => {
  function build(options: { allowed?: boolean } = {}) {
    const calls: string[] = [];
    const create = vi.fn().mockResolvedValue({ id: 'scale-1' });
    const controller = new ResponseScalesController({
      createResponseScaleUseCase: { execute: create } as unknown as CreateResponseScaleUseCase,
    });
    const authenticate: RequestHandler = (req, _res, next) => {
      calls.push('authenticate');
      (req as unknown as { user: { id: string } }).user = { id: 'admin_1' };
      next();
    };
    const requirePermission = (permission: string, scope?: string): RequestHandler => {
      return (_req, res, next) => {
        calls.push(`permission:${permission}:${scope}`);
        if (options.allowed === false) {
          res.status(403).json({ error: { code: 'FORBIDDEN' } });
          return;
        }
        next();
      };
    };

    const app = express();
    app.use(express.json());
    app.use(
      '/response-scales',
      createResponseScalesRouter({ controller, authenticate, requirePermission }),
    );
    app.use(errorHandler);
    return { app, calls, create };
  }

  const body = {
    code: 'EVIDENCE_4',
    name: 'Evidencia 4',
    type: 'EVIDENCE',
    levels: [
      { label: 'A', value: 1, countsAsAchievement: false },
      { label: 'B', value: 2, countsAsAchievement: true },
    ],
  };

  it('POST runs authenticate, then permission parametro.editar GLOBAL, then the controller', async () => {
    const { app, calls, create } = build();

    const response = await request(app).post('/response-scales').send(body);

    expect(response.status).toBe(201);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(calls).toEqual(['authenticate', 'permission:parametro.editar:GLOBAL']);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'admin_1', code: 'EVIDENCE_4' }),
    );
  });

  it('POST does not reach the use case without permission', async () => {
    const { app, create } = build({ allowed: false });

    const response = await request(app).post('/response-scales').send(body);

    expect(response.status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  it('POST answers 400 on an invalid body or an unknown query without reaching the use case', async () => {
    const { app, create } = build();

    const badBody = await request(app)
      .post('/response-scales')
      .send({ ...body, extra: 1 });
    const badQuery = await request(app).post('/response-scales?x=1').send(body);

    expect(badBody.status).toBe(400);
    expect(badQuery.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });
});
