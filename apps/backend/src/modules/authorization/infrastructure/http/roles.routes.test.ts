import express, { type Express, type RequestHandler } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { ListRolesResponse } from '@sigoa/shared';
import { runWithRequestContext } from '../../../../shared/audit/request-context.js';
import { ForbiddenError } from '../../../../shared/errors/app-error.js';
import { errorHandler } from '../../../../shared/middleware/error-handler.js';
import type { ListRolesUseCase } from '../../application/list-roles.js';
import { RolesController } from './roles.controller.js';
import { createRolesRouter } from './roles.routes.js';

describe('Roles Routes Unit Tests (A2.2, HU-003, T-003-15, RS-002, LS 3.2)', () => {
  const dummyActorId = 'admin-actor-uuid';

  const mockListResponse: ListRolesResponse = {
    items: [
      {
        id: 'role-1',
        code: 'ADMINISTRATOR',
        name: 'Administrador',
        description: 'Acceso total',
        isPredefined: true,
        status: 'ACTIVE',
        deactivatedAt: null,
        userCount: 0,
        permissions: [],
        updatedAt: '2026-11-06T15:00:00.000Z',
      },
      {
        id: 'role-2',
        code: 'TEACHER',
        name: 'Docente',
        description: null,
        isPredefined: true,
        status: 'ACTIVE',
        deactivatedAt: null,
        userCount: 0,
        permissions: [],
        updatedAt: '2026-11-06T15:00:00.000Z',
      },
    ],
  };

  function setupTestApp(options?: { permissionAllowed?: boolean }): {
    app: Express;
    listRolesUseCase: ListRolesUseCase;
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

    const listRolesUseCase = {
      execute: vi.fn().mockResolvedValue(mockListResponse),
    } as unknown as ListRolesUseCase;

    const controller = new RolesController({
      listRolesUseCase,
    });

    const router = createRolesRouter({
      controller,
      authenticate,
      requirePermission,
    });

    app.use('/roles', router);
    app.use(errorHandler);

    return { app, listRolesUseCase };
  }

  it('checks the permission before reading (403 without rol.ver)', async () => {
    const { app, listRolesUseCase } = setupTestApp({ permissionAllowed: false });

    const response = await request(app).get('/roles');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(listRolesUseCase.execute).not.toHaveBeenCalled();
  });

  it('responds 200 with Cache-Control: no-store and ListRolesResponse body', async () => {
    const { app, listRolesUseCase } = setupTestApp({ permissionAllowed: true });

    const response = await request(app).get('/roles');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual(mockListResponse);
    expect(listRolesUseCase.execute).toHaveBeenCalledWith({
      actorId: dummyActorId,
    });
  });
});
