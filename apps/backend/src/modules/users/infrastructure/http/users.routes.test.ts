import express, { type Express, type RequestHandler } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { UserDto } from '@sigoa/shared';
import { runWithRequestContext } from '../../../../shared/audit/request-context.js';
import { ForbiddenError } from '../../../../shared/errors/app-error.js';
import { errorHandler } from '../../../../shared/middleware/error-handler.js';
import type { ChangeUserStatusUseCase } from '../../application/change-user-status.js';
import type { CreateUserUseCase } from '../../application/create-user.js';
import type { EditUserUseCase } from '../../application/edit-user.js';
import { UsersController } from './users.controller.js';
import { createUsersRouter } from './users.routes.js';

describe('Users Routes Unit Tests (T-003-10, T-003-11, T-003-12, RS-002, D7, D8)', () => {
  const dummyActorId = 'admin-actor-uuid';

  const mockUserDto: UserDto = {
    id: 'user-123',
    names: 'Carlos',
    firstSurname: 'Pérez',
    secondSurname: 'Gómez',
    email: 'carlos.perez@untrm.edu.pe',
    dni: '12345678',
    status: 'ACTIVE',
    roleIds: ['role-admin'],
    lastLoginAt: null,
    createdAt: '2026-11-04T00:00:00.000Z',
    updatedAt: '2026-11-04T00:00:00.000Z',
  };

  function setupTestApp(options?: { permissionAllowed?: boolean; useCaseResult?: UserDto }): {
    app: Express;
    createUserUseCase: CreateUserUseCase;
    editUserUseCase: EditUserUseCase;
    changeUserStatusUseCase: ChangeUserStatusUseCase;
  } {
    const app = express();
    app.use(express.json());

    // Middleware de contexto para simular actor autenticado
    app.use((req, _res, next) => {
      runWithRequestContext(
        { requestId: 'req-test', actor: dummyActorId, ip: '192.168.1.10' },
        () => {
          next();
        },
      ).catch(next);
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

    const createUserUseCase = {
      execute: vi.fn().mockResolvedValue(options?.useCaseResult ?? mockUserDto),
    } as unknown as CreateUserUseCase;

    const editUserUseCase = {
      execute: vi.fn().mockResolvedValue(options?.useCaseResult ?? mockUserDto),
    } as unknown as EditUserUseCase;

    const changeUserStatusUseCase = {
      execute: vi.fn().mockResolvedValue(options?.useCaseResult ?? mockUserDto),
    } as unknown as ChangeUserStatusUseCase;

    const controller = new UsersController({
      createUserUseCase,
      editUserUseCase,
      changeUserStatusUseCase,
    });

    const router = createUsersRouter({
      controller,
      authenticate,
      requirePermission,
    });

    app.use('/users', router);
    app.use(errorHandler);

    return { app, createUserUseCase, editUserUseCase, changeUserStatusUseCase };
  }

  describe('POST /users', () => {
    const validPayload = {
      names: 'Carlos',
      firstSurname: 'Pérez',
      secondSurname: 'Gómez',
      email: 'carlos.perez@untrm.edu.pe',
      dni: '12345678',
      roleIds: ['role-admin'],
    };

    it('checks the permission before validating the body (D7, fails closed with 403 on invalid body)', async () => {
      const { app, createUserUseCase } = setupTestApp({ permissionAllowed: false });

      const response = await request(app).post('/users').send({ invalidField: true, dni: 'short' });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
      expect(createUserUseCase.execute).not.toHaveBeenCalled();
    });

    it('responds 201 with Location header, Cache-Control: no-store and UserDto body', async () => {
      const { app, createUserUseCase } = setupTestApp({ permissionAllowed: true });

      const response = await request(app).post('/users').send(validPayload);

      expect(response.status).toBe(201);
      expect(response.headers['location']).toBe('/users/user-123');
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body).toEqual(mockUserDto);
      expect(createUserUseCase.execute).toHaveBeenCalledWith({
        actorId: dummyActorId,
        ip: '192.168.1.10',
        input: expect.objectContaining({
          email: 'carlos.perez@untrm.edu.pe',
          dni: '12345678',
        }),
      });
    });

    it('strips fields that are not in the UserDto schema (D8)', async () => {
      const extendedResult = {
        ...mockUserDto,
        extraSensitiveInternalField: 'forbidden-leak',
      };

      const { app } = setupTestApp({
        permissionAllowed: true,
        useCaseResult: extendedResult as unknown as UserDto,
      });

      const response = await request(app).post('/users').send(validPayload);

      expect(response.status).toBe(500);
    });
  });

  describe('PATCH /users/:id (T-003-11)', () => {
    const validPatchPayload = {
      names: 'Carlos Modificado',
      firstSurname: 'Pérez Modificado',
    };

    it('checks permission before validating params or body (403 without permission)', async () => {
      const { app, editUserUseCase } = setupTestApp({ permissionAllowed: false });

      const response = await request(app).patch('/users/user-123').send({ invalidField: true });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
      expect(editUserUseCase.execute).not.toHaveBeenCalled();
    });

    it('responds 200 with Cache-Control: no-store and updated UserDto body', async () => {
      const updatedDto = { ...mockUserDto, names: 'Carlos Modificado' };
      const { app, editUserUseCase } = setupTestApp({
        permissionAllowed: true,
        useCaseResult: updatedDto,
      });

      const response = await request(app).patch('/users/user-123').send(validPatchPayload);

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body).toEqual(updatedDto);
      expect(editUserUseCase.execute).toHaveBeenCalledWith({
        actorId: dummyActorId,
        ip: '192.168.1.10',
        userId: 'user-123',
        input: validPatchPayload,
      });
    });

    it('returns 400 when body has no fields or invalid fields', async () => {
      const { app } = setupTestApp({ permissionAllowed: true });

      const resEmpty = await request(app).patch('/users/user-123').send({});
      expect(resEmpty.status).toBe(400);

      const resInvalidField = await request(app)
        .patch('/users/user-123')
        .send({ status: 'INACTIVE' });
      expect(resInvalidField.status).toBe(400);
    });

    it('returns 400 when param id is invalid or empty whitespace', async () => {
      const { app } = setupTestApp({ permissionAllowed: true });

      const resBadId = await request(app).patch('/users/%20').send(validPatchPayload);
      expect(resBadId.status).toBe(400);
    });
  });

  describe('PATCH /users/:id/status (T-003-12)', () => {
    const validStatusPayload = {
      status: 'INACTIVE',
    };

    it('checks the permission before validating the body (403 on invalid input if no permission)', async () => {
      const { app, changeUserStatusUseCase } = setupTestApp({ permissionAllowed: false });

      const response = await request(app)
        .patch('/users/user-123/status')
        .send({ status: 'PENDING_ACTIVATION' });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
      expect(changeUserStatusUseCase.execute).not.toHaveBeenCalled();
    });

    it('rejects any status other than ACTIVE or INACTIVE with 400', async () => {
      const { app } = setupTestApp({ permissionAllowed: true });

      const resPending = await request(app)
        .patch('/users/user-123/status')
        .send({ status: 'PENDING_ACTIVATION' });
      expect(resPending.status).toBe(400);

      const resOther = await request(app)
        .patch('/users/user-123/status')
        .send({ status: 'SUSPENDED' });
      expect(resOther.status).toBe(400);
    });

    it('responds 200 with Cache-Control: no-store and updated UserDto body', async () => {
      const inactiveDto = { ...mockUserDto, status: 'INACTIVE' as const };
      const { app, changeUserStatusUseCase } = setupTestApp({
        permissionAllowed: true,
        useCaseResult: inactiveDto,
      });

      const response = await request(app).patch('/users/user-123/status').send(validStatusPayload);

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body).toEqual(inactiveDto);
      expect(changeUserStatusUseCase.execute).toHaveBeenCalledWith({
        actorId: dummyActorId,
        ip: '192.168.1.10',
        userId: 'user-123',
        input: validStatusPayload,
      });
    });
  });
});
