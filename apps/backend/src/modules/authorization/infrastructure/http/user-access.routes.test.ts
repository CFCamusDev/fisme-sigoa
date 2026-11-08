import express, { type Express, type RequestHandler } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { UserAccessDto } from '@sigoa/shared';
import { runWithRequestContext } from '../../../../shared/audit/request-context.js';
import { ForbiddenError } from '../../../../shared/errors/app-error.js';
import { errorHandler } from '../../../../shared/middleware/error-handler.js';
import type { AssignUserRolesUseCase } from '../../application/assign-user-roles.js';
import { UserAccessController } from './user-access.controller.js';
import { createUserAccessRouter } from './user-access.routes.js';

describe('User Access Routes Unit Tests (HU-007, T-007-11, RF-007, RS-002, RS-020, RNF-009, RNF-017)', () => {
  const dummyActorId = 'admin-actor-uuid';

  const mockUserAccessResponse: UserAccessDto = {
    userId: 'usr-123',
    roles: [
      {
        id: 'role-teacher',
        code: 'TEACHER',
        name: 'Docente',
        status: 'ACTIVE',
      },
    ],
    directPermissions: [],
    effectivePermissions: [
      {
        permissionCode: 'academico.ver',
        scope: 'GLOBAL',
        sources: [
          {
            kind: 'ROLE',
            roleId: 'role-teacher',
            roleCode: 'TEACHER',
            roleName: 'Docente',
            scope: 'GLOBAL',
          },
        ],
      },
    ],
  };

  function setupTestApp(options?: { permissionAllowed?: boolean }): {
    app: Express;
    assignUserRolesUseCase: AssignUserRolesUseCase;
  } {
    const app = express();
    app.use(express.json());

    app.use((req, _res, next) => {
      runWithRequestContext({ requestId: 'req-test', actor: dummyActorId, ip: '127.0.0.1' }, () => {
        next();
      }).catch(next);
    });

    const authenticate: RequestHandler = (_req, _res, next) => next();

    const requirePermission = (_permission: string, _scope?: 'GLOBAL' | 'OWN') => {
      return ((_req, _res, next) => {
        if (options?.permissionAllowed === false) {
          next(new ForbiddenError('No tienes permiso para editar usuarios.'));
          return;
        }
        next();
      }) as RequestHandler;
    };

    const assignUserRolesUseCase = {
      execute: vi.fn().mockResolvedValue(mockUserAccessResponse),
    } as unknown as AssignUserRolesUseCase;

    const controller = new UserAccessController({
      assignUserRolesUseCase,
    });

    const router = createUserAccessRouter({
      controller,
      authenticate,
      requirePermission,
    });

    app.use('/users', router);
    app.use(errorHandler);

    return { app, assignUserRolesUseCase };
  }

  it('checks permission before calling use case in PUT /users/:id/roles (403 without usuario.editar)', async () => {
    const { app, assignUserRolesUseCase } = setupTestApp({ permissionAllowed: false });

    const response = await request(app)
      .put('/users/usr-123/roles')
      .send({ roleIds: ['role-teacher'] });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(assignUserRolesUseCase.execute).not.toHaveBeenCalled();
  });

  it('returns 400 when body is invalid (empty roleIds array)', async () => {
    const { app, assignUserRolesUseCase } = setupTestApp({ permissionAllowed: true });

    const response = await request(app).put('/users/usr-123/roles').send({ roleIds: [] });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(assignUserRolesUseCase.execute).not.toHaveBeenCalled();
  });

  it('returns 400 when body has duplicate roles', async () => {
    const { app, assignUserRolesUseCase } = setupTestApp({ permissionAllowed: true });

    const response = await request(app)
      .put('/users/usr-123/roles')
      .send({ roleIds: ['role-1', 'role-1'] });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(assignUserRolesUseCase.execute).not.toHaveBeenCalled();
  });

  it('returns 400 when user id in path exceeds 64 characters', async () => {
    const { app, assignUserRolesUseCase } = setupTestApp({ permissionAllowed: true });

    const longId = 'a'.repeat(65);
    const response = await request(app)
      .put(`/users/${longId}/roles`)
      .send({ roleIds: ['role-1'] });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(assignUserRolesUseCase.execute).not.toHaveBeenCalled();
  });

  it('responds 200 with Cache-Control: no-store and UserAccessDto body', async () => {
    const { app, assignUserRolesUseCase } = setupTestApp({ permissionAllowed: true });

    const response = await request(app)
      .put('/users/usr-123/roles')
      .send({ roleIds: ['role-teacher'] });

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual(mockUserAccessResponse);
    expect(assignUserRolesUseCase.execute).toHaveBeenCalledWith({
      actorId: dummyActorId,
      userId: 'usr-123',
      ip: '127.0.0.1',
      input: { roleIds: ['role-teacher'] },
    });
  });
});
