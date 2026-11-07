import express, { type Express, type RequestHandler } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { ListRolesResponse, RoleDto } from '@sigoa/shared';
import { runWithRequestContext } from '../../../../shared/audit/request-context.js';
import { ForbiddenError } from '../../../../shared/errors/app-error.js';
import { errorHandler } from '../../../../shared/middleware/error-handler.js';
import type { CreateRoleUseCase } from '../../application/create-role.js';
import type { ListRolesUseCase } from '../../application/list-roles.js';
import { RolesController } from './roles.controller.js';
import { createRolesRouter } from './roles.routes.js';

describe('Roles Routes Unit Tests (A2.2, HU-003, T-003-15, HU-006, T-006-15, RS-002, LS 3.2, D5)', () => {
  const dummyActorId = 'admin-actor-uuid';

  const mockCreatedRole: RoleDto = {
    id: 'role-new',
    code: 'AUDITOR_DE_CALIDAD',
    name: 'Auditor de Calidad',
    description: 'Auditor de calidad de procesos',
    isPredefined: false,
    status: 'ACTIVE',
    deactivatedAt: null,
    userCount: 0,
    permissions: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }],
    updatedAt: '2026-11-06T19:00:00.000Z',
  };

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
    createRoleUseCase: CreateRoleUseCase;
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
          next(new ForbiddenError('No tienes permiso para realizar esta acción.'));
          return;
        }
        next();
      }) as RequestHandler;
    };

    const listRolesUseCase = {
      execute: vi.fn().mockResolvedValue(mockListResponse),
    } as unknown as ListRolesUseCase;

    const createRoleUseCase = {
      execute: vi.fn().mockResolvedValue(mockCreatedRole),
    } as unknown as CreateRoleUseCase;

    const controller = new RolesController({
      listRolesUseCase,
      createRoleUseCase,
    });

    const router = createRolesRouter({
      controller,
      authenticate,
      requirePermission,
    });

    app.use('/roles', router);
    app.use(errorHandler);

    return { app, listRolesUseCase, createRoleUseCase };
  }

  it('checks the permission before reading in GET /roles (403 without rol.ver)', async () => {
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

  it('checks permission before validating body in POST /roles (D5, 403 on invalid body without permission)', async () => {
    const { app, createRoleUseCase } = setupTestApp({ permissionAllowed: false });

    // Enviar body inválido; el permiso se comprueba primero y debe responder 403
    const response = await request(app).post('/roles').send({ invalid: 'field' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(createRoleUseCase.execute).not.toHaveBeenCalled();
  });

  it('returns 400 when body is invalid in POST /roles (name shorter than 3 characters)', async () => {
    const { app, createRoleUseCase } = setupTestApp({ permissionAllowed: true });

    const response = await request(app).post('/roles').send({ name: 'ab' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(createRoleUseCase.execute).not.toHaveBeenCalled();
  });

  it('returns 400 when body contains unknown properties in POST /roles', async () => {
    const { app, createRoleUseCase } = setupTestApp({ permissionAllowed: true });

    const response = await request(app).post('/roles').send({
      name: 'Auditor de Calidad',
      unknownField: 'malicious',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(createRoleUseCase.execute).not.toHaveBeenCalled();
  });

  it('responds 201 with Cache-Control: no-store and RoleDto on valid POST /roles', async () => {
    const { app, createRoleUseCase } = setupTestApp({ permissionAllowed: true });

    const payload = {
      name: 'Auditor de Calidad',
      description: 'Auditor de calidad de procesos',
      permissions: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }],
    };

    const response = await request(app).post('/roles').send(payload);

    expect(response.status).toBe(201);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual(mockCreatedRole);
    expect(createRoleUseCase.execute).toHaveBeenCalledWith({
      actorId: dummyActorId,
      ip: '127.0.0.1',
      input: payload,
    });
  });
});
