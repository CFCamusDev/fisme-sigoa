import express, { type Express, type RequestHandler } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { ListPermissionsResponse } from '@sigoa/shared';
import { runWithRequestContext } from '../../../../shared/audit/request-context.js';
import { ForbiddenError } from '../../../../shared/errors/app-error.js';
import { errorHandler } from '../../../../shared/middleware/error-handler.js';
import type { ListPermissionsUseCase } from '../../application/list-permissions.js';
import { PermissionsController } from './permissions.controller.js';
import { createPermissionsRouter } from './permissions.routes.js';

describe('Permissions Routes Unit Tests (T-006-18, RS-002, LS 3.3, D3, D5, D6)', () => {
  const dummyActorId = 'admin-actor-uuid';

  const mockPermissionsResponse: ListPermissionsResponse = {
    items: [
      {
        code: 'catalogo.ver',
        description: 'Ver catálogos del programa',
        module: 'CATALOGO',
      },
      {
        code: 'rol.ver',
        description: 'Ver roles y permisos',
        module: 'ROLES',
      },
    ],
  };

  function setupTestApp(options?: { permissionAllowed?: boolean }): {
    app: Express;
    listPermissionsUseCase: ListPermissionsUseCase;
  } {
    const app = express();
    app.use(express.json());

    app.use((req, _res, next) => {
      runWithRequestContext({ requestId: 'req-test', actor: dummyActorId, ip: '127.0.0.1' }, () => {
        next();
      }).catch(next);
    });

    const authenticate: RequestHandler = (_req, _res, next) => next();

    const requirePermission = (_permission: string) => {
      return ((_req, _res, next) => {
        if (options?.permissionAllowed === false) {
          next(new ForbiddenError('No tienes permiso para ver los roles.'));
          return;
        }
        next();
      }) as RequestHandler;
    };

    const listPermissionsUseCase = {
      execute: vi.fn().mockResolvedValue(mockPermissionsResponse),
    } as unknown as ListPermissionsUseCase;

    const controller = new PermissionsController({
      listPermissionsUseCase,
    });

    const router = createPermissionsRouter({
      controller,
      authenticate,
      requirePermission,
    });

    app.use('/permissions', router);
    app.use(errorHandler);

    return { app, listPermissionsUseCase };
  }

  it('checks permission before reading in GET /permissions (403 without rol.ver)', async () => {
    const { app, listPermissionsUseCase } = setupTestApp({ permissionAllowed: false });

    const response = await request(app).get('/permissions');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(listPermissionsUseCase.execute).not.toHaveBeenCalled();
  });

  it('returns 400 when query parameters are supplied in GET /permissions (D6)', async () => {
    const { app, listPermissionsUseCase } = setupTestApp({ permissionAllowed: true });

    const response = await request(app).get('/permissions?extra=query');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(listPermissionsUseCase.execute).not.toHaveBeenCalled();
  });

  it('responds 200 with Cache-Control: no-store and ListPermissionsResponse body', async () => {
    const { app, listPermissionsUseCase } = setupTestApp({ permissionAllowed: true });

    const response = await request(app).get('/permissions');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual(mockPermissionsResponse);
    expect(listPermissionsUseCase.execute).toHaveBeenCalledWith({
      actorId: dummyActorId,
    });
  });
});
