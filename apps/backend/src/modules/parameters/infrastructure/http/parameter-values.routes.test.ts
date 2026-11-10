import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../../../shared/middleware/error-handler.js';
import type { DefineParametersUseCase } from '../../application/define-parameters.js';
import { ParameterValuesController } from './parameter-values.controller.js';
import { createParameterValuesRouter } from './parameter-values.routes.js';

describe('POST /parameters middleware chain (T-011-09, RNF-009)', () => {
  function build(options: { allowed?: boolean } = {}) {
    const calls: string[] = [];
    const execute = vi.fn().mockResolvedValue({ semesterCode: '2027-I', items: [] });
    const controller = new ParameterValuesController({
      defineParametersUseCase: { execute } as unknown as DefineParametersUseCase,
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
      '/parameters',
      createParameterValuesRouter({ controller, authenticate, requirePermission }),
    );
    app.use(errorHandler);
    return { app, calls, execute };
  }

  const body = { semesterCode: '2027-I', values: [{ key: 'UMBRAL_LOGRADO', value: 15 }] };

  it('runs authenticate, then permission parametro.editar GLOBAL, then the controller', async () => {
    const { app, calls, execute } = build();

    const response = await request(app).post('/parameters').send(body);

    expect(response.status).toBe(201);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(calls).toEqual(['authenticate', 'permission:parametro.editar:GLOBAL']);
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'admin_1', semesterCode: '2027-I' }),
    );
  });

  it('does not reach the use case without permission', async () => {
    const { app, execute } = build({ allowed: false });

    const response = await request(app).post('/parameters').send(body);

    expect(response.status).toBe(403);
    expect(execute).not.toHaveBeenCalled();
  });

  it('answers 400 on an invalid body or an unknown query without reaching the use case', async () => {
    const { app, execute } = build();

    const badBody = await request(app)
      .post('/parameters')
      .send({ ...body, extra: 1 });
    const badQuery = await request(app).post('/parameters?x=1').send(body);

    expect(badBody.status).toBe(400);
    expect(badQuery.status).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });
});
