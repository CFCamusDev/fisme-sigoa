import express, { type Express, type RequestHandler } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { UserAccessDto } from '@sigoa/shared';
import { runWithRequestContext } from '../../../../shared/audit/request-context.js';
import { ForbiddenError } from '../../../../shared/errors/app-error.js';
import { errorHandler } from '../../../../shared/middleware/error-handler.js';
import type { AssignUserRolesUseCase } from '../../application/assign-user-roles.js';
import type { AssignUserPermissionsUseCase } from '../../application/assign-user-permissions.js';
import type { GetUserEffectiveAccessUseCase } from '../../application/get-user-effective-access.js';
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
    assignUserPermissionsUseCase: AssignUserPermissionsUseCase;
    getUserEffectiveAccessUseCase: GetUserEffectiveAccessUseCase;
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
          next(new ForbiddenError('No tienes permiso para realizar esta acción.'));
          return;
        }
        next();
      }) as RequestHandler;
    };

    const assignUserRolesUseCase = {
      execute: vi.fn().mockResolvedValue(mockUserAccessResponse),
    } as unknown as AssignUserRolesUseCase;

    const assignUserPermissionsUseCase = {
      execute: vi.fn().mockResolvedValue(mockUserAccessResponse),
    } as unknown as AssignUserPermissionsUseCase;

    const getUserEffectiveAccessUseCase = {
      execute: vi.fn().mockResolvedValue(mockUserAccessResponse),
    } as unknown as GetUserEffectiveAccessUseCase;

    const controller = new UserAccessController({
      assignUserRolesUseCase,
      assignUserPermissionsUseCase,
      getUserEffectiveAccessUseCase,
    });

    const router = createUserAccessRouter({
      controller,
      authenticate,
      requirePermission,
    });

    app.use('/users', router);
    app.use(errorHandler);

    return {
      app,
      assignUserRolesUseCase,
      assignUserPermissionsUseCase,
      getUserEffectiveAccessUseCase,
    };
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

  describe('PUT /users/:id/permissions (HU-007, T-007-12, RS-002, RS-020, RNF-009, RNF-017)', () => {
    it('checks permission before calling use case (403 without permiso.asignar)', async () => {
      const { app, assignUserPermissionsUseCase } = setupTestApp({ permissionAllowed: false });

      const response = await request(app)
        .put('/users/usr-123/permissions')
        .send({ permissions: [{ permissionCode: 'curso.editar', scope: 'GLOBAL' }] });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
      expect(assignUserPermissionsUseCase.execute).not.toHaveBeenCalled();
    });

    it('returns 400 when body has duplicate permissions', async () => {
      const { app, assignUserPermissionsUseCase } = setupTestApp({ permissionAllowed: true });

      const response = await request(app)
        .put('/users/usr-123/permissions')
        .send({
          permissions: [
            { permissionCode: 'curso.editar', scope: 'GLOBAL' },
            { permissionCode: 'curso.editar', scope: 'OWN' },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(assignUserPermissionsUseCase.execute).not.toHaveBeenCalled();
    });

    it('returns 400 when permission item has invalid scope', async () => {
      const { app, assignUserPermissionsUseCase } = setupTestApp({ permissionAllowed: true });

      const response = await request(app)
        .put('/users/usr-123/permissions')
        .send({
          permissions: [{ permissionCode: 'curso.editar', scope: 'INVALID_SCOPE' }],
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(assignUserPermissionsUseCase.execute).not.toHaveBeenCalled();
    });

    it('returns 400 when user id in path exceeds 64 characters', async () => {
      const { app, assignUserPermissionsUseCase } = setupTestApp({ permissionAllowed: true });

      const longId = 'a'.repeat(65);
      const response = await request(app)
        .put(`/users/${longId}/permissions`)
        .send({ permissions: [] });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(assignUserPermissionsUseCase.execute).not.toHaveBeenCalled();
    });

    it('responds 200 with Cache-Control: no-store and calls use case with empty list', async () => {
      const { app, assignUserPermissionsUseCase } = setupTestApp({ permissionAllowed: true });

      const response = await request(app)
        .put('/users/usr-123/permissions')
        .send({ permissions: [] });

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body).toEqual(mockUserAccessResponse);
      expect(assignUserPermissionsUseCase.execute).toHaveBeenCalledWith({
        actorId: dummyActorId,
        userId: 'usr-123',
        ip: '127.0.0.1',
        input: { permissions: [] },
      });
    });

    it('responds 200 with valid permissions list', async () => {
      const { app, assignUserPermissionsUseCase } = setupTestApp({ permissionAllowed: true });

      const response = await request(app)
        .put('/users/usr-123/permissions')
        .send({ permissions: [{ permissionCode: 'curso.editar', scope: 'GLOBAL' }] });

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body).toEqual(mockUserAccessResponse);
      expect(assignUserPermissionsUseCase.execute).toHaveBeenCalledWith({
        actorId: dummyActorId,
        userId: 'usr-123',
        ip: '127.0.0.1',
        input: { permissions: [{ permissionCode: 'curso.editar', scope: 'GLOBAL' }] },
      });
    });
  });

  describe('GET /users/:id/effective-permissions (HU-007, T-007-13, RS-002, RNF-009, RNF-017, D1, D6)', () => {
    it('checks permission before calling use case (403 without usuario.ver)', async () => {
      const { app, getUserEffectiveAccessUseCase } = setupTestApp({ permissionAllowed: false });

      const response = await request(app).get('/users/usr-123/effective-permissions');

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
      expect(getUserEffectiveAccessUseCase.execute).not.toHaveBeenCalled();
    });

    it('returns 400 when user id in path exceeds 64 characters', async () => {
      const { app, getUserEffectiveAccessUseCase } = setupTestApp({ permissionAllowed: true });

      const longId = 'z'.repeat(65);
      const response = await request(app).get(`/users/${longId}/effective-permissions`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(getUserEffectiveAccessUseCase.execute).not.toHaveBeenCalled();
    });

    it('returns 400 when query params are provided (noQuerySchema violation)', async () => {
      const { app, getUserEffectiveAccessUseCase } = setupTestApp({ permissionAllowed: true });

      const response = await request(app).get(
        '/users/usr-123/effective-permissions?unexpected=true',
      );

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(getUserEffectiveAccessUseCase.execute).not.toHaveBeenCalled();
    });

    it('responds 200 with Cache-Control: no-store and UserAccessDto', async () => {
      const { app, getUserEffectiveAccessUseCase } = setupTestApp({ permissionAllowed: true });

      const response = await request(app).get('/users/usr-123/effective-permissions');

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body).toEqual(mockUserAccessResponse);
      expect(getUserEffectiveAccessUseCase.execute).toHaveBeenCalledWith({
        actorId: dummyActorId,
        userId: 'usr-123',
      });
    });
  });
});
