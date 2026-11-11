import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../../../shared/middleware/error-handler.js';
import type { CreateResponseScaleUseCase } from '../../application/create-response-scale.js';
import type { DuplicateResponseScaleUseCase } from '../../application/duplicate-response-scale.js';
import type { EditResponseScaleUseCase } from '../../application/edit-response-scale.js';
import type { ListResponseScalesUseCase } from '../../application/list-response-scales.js';
import { ResponseScalesController } from './response-scales.controller.js';
import { createResponseScalesRouter } from './response-scales.routes.js';

describe('/response-scales middleware chain (T-012-11, RNF-009)', () => {
  function build(options: { allowed?: boolean } = {}) {
    const calls: string[] = [];
    const create = vi.fn().mockResolvedValue({ id: 'scale-1' });
    const edit = vi.fn().mockResolvedValue({ id: 'scale-1' });
    const list = vi.fn().mockResolvedValue({ items: [] });
    const duplicate = vi.fn().mockResolvedValue({ id: 'scale-2' });
    const controller = new ResponseScalesController({
      createResponseScaleUseCase: { execute: create } as unknown as CreateResponseScaleUseCase,
      editResponseScaleUseCase: { execute: edit } as unknown as EditResponseScaleUseCase,
      listResponseScalesUseCase: { execute: list } as unknown as ListResponseScalesUseCase,
      duplicateResponseScaleUseCase: {
        execute: duplicate,
      } as unknown as DuplicateResponseScaleUseCase,
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
    return { app, calls, create, edit, list, duplicate };
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

  it('PATCH runs authenticate, then permission parametro.editar GLOBAL, then the controller', async () => {
    const { app, calls, edit } = build();

    const response = await request(app).patch('/response-scales/scale-1').send({ name: 'Nuevo' });

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(calls).toEqual(['authenticate', 'permission:parametro.editar:GLOBAL']);
    expect(edit).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'admin_1', id: 'scale-1', name: 'Nuevo' }),
    );
  });

  it('PATCH does not reach the use case without permission', async () => {
    const { app, edit } = build({ allowed: false });

    const response = await request(app).patch('/response-scales/scale-1').send({ name: 'Nuevo' });

    expect(response.status).toBe(403);
    expect(edit).not.toHaveBeenCalled();
  });

  it('PATCH answers 400 on an empty body, code or type in the body, unknown query or long id', async () => {
    const { app, edit } = build();

    const responses = await Promise.all([
      request(app).patch('/response-scales/scale-1').send({}),
      request(app).patch('/response-scales/scale-1').send({ name: 'X', code: 'OTRO_CODIGO' }),
      request(app).patch('/response-scales/scale-1').send({ name: 'X', type: 'LIKERT' }),
      request(app).patch('/response-scales/scale-1?x=1').send({ name: 'X' }),
      request(app)
        .patch('/response-scales/' + 'a'.repeat(5000))
        .send({ name: 'X' }),
    ]);

    expect(responses.map((r) => r.status)).toEqual([400, 400, 400, 400, 400]);
    expect(edit).not.toHaveBeenCalled();
  });

  it('GET runs authenticate, then permission parametro.ver GLOBAL, and forbids caching', async () => {
    const { app, calls, list } = build();

    const response = await request(app).get('/response-scales?type=LIKERT');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(calls).toEqual(['authenticate', 'permission:parametro.ver:GLOBAL']);
    expect(list).toHaveBeenCalledWith({ actorId: 'admin_1', type: 'LIKERT' });
  });

  it('GET answers 400 on an invalid or repeated type, a long type and an unknown query', async () => {
    const { app, list } = build();

    const responses = await Promise.all([
      request(app).get('/response-scales?type=OTHER'),
      request(app).get('/response-scales?type=LIKERT&type=NUMERIC'),
      request(app).get('/response-scales?type=' + 'a'.repeat(5000)),
      request(app).get('/response-scales?foo=1'),
    ]);

    expect(responses.map((r) => r.status)).toEqual([400, 400, 400, 400]);
    expect(list).not.toHaveBeenCalled();
  });

  it('GET does not reach the use case without permission', async () => {
    const { app, list } = build({ allowed: false });

    const response = await request(app).get('/response-scales');

    expect(response.status).toBe(403);
    expect(list).not.toHaveBeenCalled();
  });

  it('POST duplicate runs authenticate, then permission parametro.editar GLOBAL, then the controller', async () => {
    const { app, calls, duplicate } = build();

    const response = await request(app)
      .post('/response-scales/scale-1/duplicate')
      .send({ code: 'COPIA_1', name: 'Copia' });

    expect(response.status).toBe(201);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(calls).toEqual(['authenticate', 'permission:parametro.editar:GLOBAL']);
    expect(duplicate).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'admin_1', sourceId: 'scale-1', code: 'COPIA_1' }),
    );
  });

  it('POST duplicate does not reach the use case without permission', async () => {
    const { app, duplicate } = build({ allowed: false });

    const response = await request(app)
      .post('/response-scales/scale-1/duplicate')
      .send({ code: 'COPIA_1', name: 'Copia' });

    expect(response.status).toBe(403);
    expect(duplicate).not.toHaveBeenCalled();
  });

  it('POST duplicate answers 400 on a bad body, unknown query or long id', async () => {
    const { app, duplicate } = build();

    const responses = await Promise.all([
      request(app).post('/response-scales/scale-1/duplicate').send({ name: 'Copia' }),
      request(app)
        .post('/response-scales/scale-1/duplicate')
        .send({ code: 'COPIA_1', name: 'Copia', extra: 1 }),
      request(app)
        .post('/response-scales/scale-1/duplicate?x=1')
        .send({ code: 'COPIA_1', name: 'C' }),
      request(app)
        .post('/response-scales/' + 'a'.repeat(5000) + '/duplicate')
        .send({ code: 'COPIA_1', name: 'C' }),
    ]);

    expect(responses.map((r) => r.status)).toEqual([400, 400, 400, 400]);
    expect(duplicate).not.toHaveBeenCalled();
  });
});
