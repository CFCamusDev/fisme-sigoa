import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
  createAuthenticate,
  getAuthenticatedPrincipal,
  type AuthenticatedPrincipal,
} from './authenticate.js';
import type { AccessTokenVerifier } from '../../domain/ports/access-token-verifier.js';
import type { UserRepository } from '../../domain/ports/user-repository.js';
import { User, type UserStatus } from '../../domain/entities/user.js';
import { errorHandler } from '../../../../shared/middleware/error-handler.js';
import { requestContextMiddleware } from '../../../../shared/middleware/request-context.js';
import { getRequestContext } from '../../../../shared/audit/request-context.js';
import { UnauthorizedError } from '../../../../shared/errors/app-error.js';

describe('createAuthenticate Middleware (T-002-04, RF-002, RS-002, RS-016, RS-041)', () => {
  const mockNow = new Date('2026-10-30T15:00:00.000Z');

  function makeUser(id: string, status: UserStatus = 'ACTIVE'): User {
    return User.restore({
      id,
      names: 'Test',
      firstSurname: 'User',
      secondSurname: null,
      email: `${id}@untrm.edu.pe`,
      dni: null,
      passwordHash: 'hash',
      status,
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: null,
      createdAt: mockNow,
      updatedAt: mockNow,
      createdBy: null,
      updatedBy: null,
    });
  }

  function setupApp(deps: {
    verifier: Partial<AccessTokenVerifier>;
    userRepository: Partial<UserRepository>;
  }) {
    const app = express();
    app.use(requestContextMiddleware);

    const authenticate = createAuthenticate({
      verifier: deps.verifier as AccessTokenVerifier,
      userRepository: deps.userRepository as UserRepository,
      clock: () => mockNow,
    });

    let capturedActor: string | undefined;
    let capturedPrincipal: AuthenticatedPrincipal | undefined;

    app.get('/protected-test', authenticate, (_req, res) => {
      capturedPrincipal = getAuthenticatedPrincipal(res);
      capturedActor = getRequestContext()?.actor;
      res.status(200).json({ success: true, principal: capturedPrincipal });
    });

    app.use(errorHandler);

    return {
      app,
      getCaptured: () => ({ principal: capturedPrincipal, actor: capturedActor }),
    };
  }

  it('responds 401 without a bearer token', async () => {
    const { app } = setupApp({
      verifier: { verify: vi.fn() },
      userRepository: { findById: vi.fn() },
    });

    const res = await request(app).get('/protected-test');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('responds 401 for a malformed authorization header', async () => {
    const { app } = setupApp({
      verifier: { verify: vi.fn() },
      userRepository: { findById: vi.fn() },
    });

    const cases = ['Basic token123', 'Bearer', 'Bearer    ', 'TokenWithoutBearer'];

    for (const header of cases) {
      const res = await request(app).get('/protected-test').set('Authorization', header);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('responds 401 for an expired token', async () => {
    const { app } = setupApp({
      verifier: {
        verify: vi.fn().mockRejectedValue(new UnauthorizedError('Token expirado')),
      },
      userRepository: { findById: vi.fn() },
    });

    const res = await request(app)
      .get('/protected-test')
      .set('Authorization', 'Bearer expired-token');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('responds 401 when the user is inactive or pending activation', async () => {
    const inactiveUser = makeUser('usr_inactive', 'INACTIVE');
    const pendingUser = makeUser('usr_pending', 'PENDING_ACTIVATION');

    const userRepository = {
      findById: vi.fn().mockResolvedValueOnce(inactiveUser).mockResolvedValueOnce(pendingUser),
    };

    const verifier = {
      verify: vi.fn().mockResolvedValue({ userId: 'usr_mock' }),
    };

    const { app } = setupApp({ verifier, userRepository });

    // Caso 1: INACTIVE
    const resInactive = await request(app)
      .get('/protected-test')
      .set('Authorization', 'Bearer valid-jwt-token');
    expect(resInactive.status).toBe(401);
    expect(resInactive.body.error.code).toBe('UNAUTHORIZED');

    // Caso 2: PENDING_ACTIVATION
    const resPending = await request(app)
      .get('/protected-test')
      .set('Authorization', 'Bearer valid-jwt-token');
    expect(resPending.status).toBe(401);
    expect(resPending.body.error.code).toBe('UNAUTHORIZED');
  });

  it('responds 401 when the user no longer exists', async () => {
    const { app } = setupApp({
      verifier: { verify: vi.fn().mockResolvedValue({ userId: 'usr_ghost' }) },
      userRepository: { findById: vi.fn().mockResolvedValue(null) },
    });

    const res = await request(app)
      .get('/protected-test')
      .set('Authorization', 'Bearer valid-jwt-token');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('loads the principal in the context and sets the request actor', async () => {
    const activeUser = makeUser('usr_active_777', 'ACTIVE');
    const { app, getCaptured } = setupApp({
      verifier: { verify: vi.fn().mockResolvedValue({ userId: 'usr_active_777' }) },
      userRepository: { findById: vi.fn().mockResolvedValue(activeUser) },
    });

    const res = await request(app)
      .get('/protected-test')
      .set('Authorization', 'Bearer valid-jwt-token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const captured = getCaptured();
    expect(captured.principal).toEqual({ userId: 'usr_active_777' });
    expect(captured.actor).toBe('usr_active_777');
  });

  it('does not leak the failure cause', async () => {
    const { app } = setupApp({
      verifier: {
        verify: vi.fn().mockRejectedValue(new Error('Sensitive internal crypto failure details')),
      },
      userRepository: { findById: vi.fn() },
    });

    const res = await request(app)
      .get('/protected-test')
      .set('Authorization', 'Bearer malicious-token');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.error.message).toBe('Credenciales inválidas');
    expect(JSON.stringify(res.body)).not.toContain('crypto');
    expect(JSON.stringify(res.body)).not.toContain('Sensitive');
  });
});
