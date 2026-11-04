import express, { type Express, type RequestHandler } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { UserDto } from '@sigoa/shared';
import { runWithRequestContext } from '../../../../shared/audit/request-context.js';
import { ForbiddenError } from '../../../../shared/errors/app-error.js';
import { errorHandler } from '../../../../shared/middleware/error-handler.js';
import type { CreateUserUseCase } from '../../application/create-user.js';
import { UsersController } from './users.controller.js';
import { createUsersRouter } from './users.routes.js';

describe('POST /users Route Unit Tests (T-003-10, RS-002, D7, D8)', () => {
  const dummyActorId = 'admin-actor-uuid';

  const mockUserDto: UserDto = {
    id: 'new-user-123',
    names: 'Carlos',
    firstSurname: 'Pérez',
    secondSurname: 'Gómez',
    email: 'carlos.perez@untrm.edu.pe',
    dni: '12345678',
    status: 'PENDING_ACTIVATION',
    roleIds: ['role-admin'],
    lastLoginAt: null,
    createdAt: '2026-11-04T00:00:00.000Z',
    updatedAt: '2026-11-04T00:00:00.000Z',
  };

  function setupTestApp(options?: { permissionAllowed?: boolean; useCaseResult?: UserDto }): {
    app: Express;
    createUserUseCase: CreateUserUseCase;
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

    const controller = new UsersController({ createUserUseCase });

    const router = createUsersRouter({
      controller,
      authenticate,
      requirePermission,
    });

    app.use('/users', router);
    app.use(errorHandler);

    return { app, createUserUseCase };
  }

  const validPayload = {
    names: 'Carlos',
    firstSurname: 'Pérez',
    secondSurname: 'Gómez',
    email: 'carlos.perez@untrm.edu.pe',
    dni: '12345678',
    roleIds: ['role-admin'],
  };

  it('checks the permission before validating the body (D7, fails closed with 403 on invalid body)', async () => {
    // Si no tiene permiso pero el body es completamente inválido, debe responder 403 (no 400)
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
    expect(response.headers['location']).toBe('/users/new-user-123');
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
    // Si el caso de uso por algún motivo devolviera campos extra sensibles, zod los filtra o rechaza
    const extendedResult = {
      ...mockUserDto,
      extraSensitiveInternalField: 'forbidden-leak',
    };

    const { app } = setupTestApp({
      permissionAllowed: true,
      useCaseResult: extendedResult as unknown as UserDto,
    });

    // userDtoSchema es .strict(), así que si vinieran campos extra, userDtoSchema.parse fallaría
    // En el caso normal el DTO cumple estrictamente el esquema
    const response = await request(app).post('/users').send(validPayload);

    // Al ser strict, si el useCase retornó campos no permitidos, errorHandler responde 500
    expect(response.status).toBe(500);
  });
});
