import express, { type Express } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import {
  runWithRequestContext,
  setRequestActor,
} from '../../../../shared/audit/request-context.js';
import { errorHandler } from '../../../../shared/middleware/error-handler.js';
import { PermissionAuthorizer } from '../../application/permission-authorizer.js';
import type { GrantReader } from '../../domain/index.js';
import { createRequirePermission } from './require-permission.js';

describe('requirePermission Middleware Unit Tests (F4, RS-002, RNF-009)', () => {
  function createApp(authorizer: PermissionAuthorizer): Express {
    const app = express();
    app.use(express.json());

    // Middleware simulado para proveer request context
    app.use((req, _res, next) => {
      const actorHeader = req.headers['x-test-actor'];
      const actor = typeof actorHeader === 'string' ? actorHeader : undefined;
      runWithRequestContext({ requestId: 'req-1', actor }, () => {
        if (actor) {
          setRequestActor(actor);
        }
        next();
      }).catch(next);
    });

    const requirePermission = createRequirePermission(authorizer);

    // Ruta de sonda protegida con usuario.ver (GLOBAL)
    app.get('/probe/users', requirePermission('usuario.ver', 'GLOBAL'), (_req, res) => {
      res.status(200).json({ ok: true, data: 'probe-data' });
    });

    app.use(errorHandler);
    return app;
  }

  it('responds 401 without an authenticated actor', async () => {
    const grantReader: GrantReader = { findGrantsByUserId: vi.fn() };
    const authorizer = new PermissionAuthorizer(grantReader);
    const app = createApp(authorizer);

    const response = await request(app).get('/probe/users');
    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe('No autenticado');
  });

  it('responds 403 without the permission', async () => {
    const grantReader: GrantReader = {
      findGrantsByUserId: vi.fn().mockResolvedValue([]),
    };
    const authorizer = new PermissionAuthorizer(grantReader);
    const app = createApp(authorizer);

    const response = await request(app)
      .get('/probe/users')
      .set('x-test-actor', 'unprivileged-user-uuid');

    expect(response.status).toBe(403);
    expect(response.body.error.message).toBe('No tienes permiso para realizar esta acción.');
    // No debe revelar el código del permiso que falta
    expect(JSON.stringify(response.body)).not.toContain('usuario.ver');
  });

  it('lets the request through with the permission', async () => {
    const grantReader: GrantReader = {
      findGrantsByUserId: vi
        .fn()
        .mockResolvedValue([{ permission: 'usuario.ver', scope: 'GLOBAL' }]),
    };
    const authorizer = new PermissionAuthorizer(grantReader);
    const app = createApp(authorizer);

    const response = await request(app)
      .get('/probe/users')
      .set('x-test-actor', 'privileged-admin-uuid');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, data: 'probe-data' });
  });

  it('responds 500 and never lets the request through when the reader fails', async () => {
    const grantReader: GrantReader = {
      findGrantsByUserId: vi.fn().mockRejectedValue(new Error('Prisma disconnect crash')),
    };
    const authorizer = new PermissionAuthorizer(grantReader);
    const app = createApp(authorizer);

    const response = await request(app)
      .get('/probe/users')
      .set('x-test-actor', 'privileged-admin-uuid');

    expect(response.status).toBe(500);
    expect(response.body.data).toBeUndefined();
  });
});
