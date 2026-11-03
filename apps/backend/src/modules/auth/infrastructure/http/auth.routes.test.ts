import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createAuthRouter, type AuthRouterDependencies } from './auth.routes.js';
import type { LoginUseCase } from '../../application/login.js';
import type { RefreshSessionUseCase } from '../../application/refresh-session.js';
import type { LogoutUseCase } from '../../application/logout.js';
import { errorHandler } from '../../../../shared/middleware/error-handler.js';
import {
  ForbiddenError,
  TooManyRequestsError,
  UnauthorizedError,
} from '../../../../shared/errors/app-error.js';
import {
  AccountInactiveError,
  AccountLockedError,
  AccountPendingActivationError,
  InvalidRefreshTokenError,
} from '../../domain/errors/index.js';

describe('Auth Routes (POST /auth/login) (T-001-12, RS-002, RNF-007, RNF-008)', () => {
  function setupApp(
    useCaseMock: Partial<LoginUseCase>,
    customRateLimiter?: express.RequestHandler,
    depsOverrides?: Partial<AuthRouterDependencies>,
  ) {
    const app = express();
    app.use(express.json());

    const router = createAuthRouter({
      loginUseCase: useCaseMock as LoginUseCase,
      rateLimiter: customRateLimiter,
      ...depsOverrides,
    });

    app.use('/auth', router);
    app.use(errorHandler);

    return app;
  }

  const validResponseBody = {
    accessToken: 'valid.access.jwt',
    accessTokenExpiresAt: '2026-10-30T10:15:00.000Z',
    refreshToken: 'valid.refresh.token',
    refreshTokenExpiresAt: '2026-11-06T10:00:00.000Z',
    user: {
      id: 'usr_123',
      names: 'Carlos',
      firstSurname: 'Pérez',
      secondSurname: null,
      email: 'carlos.perez@untrm.edu.pe',
    },
  };

  it('responds 200 with Cache-Control no-store and Pragma no-cache headers on success', async () => {
    const mockExecute = vi.fn().mockResolvedValue(validResponseBody);
    const app = setupApp({ execute: mockExecute });

    const response = await request(app).post('/auth/login').send({
      email: 'carlos.perez@untrm.edu.pe',
      password: 'ValidPassword123!',
    });

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['pragma']).toBe('no-cache');
    expect(response.headers['set-cookie']).toBeDefined();
    expect(response.headers['set-cookie']![0]).toContain('sigoa_refresh_token=valid.refresh.token');
    expect(response.headers['set-cookie']![0]).toContain('HttpOnly');
    expect(response.headers['set-cookie']![0]).toContain('Path=/auth');
    expect(response.body.refreshToken).toBeUndefined();
    expect(response.body.accessToken).toBe(validResponseBody.accessToken);
    expect(response.body.user).toEqual(validResponseBody.user);
  });

  it('responds 400 with validation details for an invalid body', async () => {
    const mockExecute = vi.fn();
    const app = setupApp({ execute: mockExecute });

    const response = await request(app).post('/auth/login').send({
      email: 'not-an-email',
      password: '',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toBeDefined();
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('maps UnauthorizedError to 401 UNAUTHORIZED', async () => {
    const mockExecute = vi
      .fn()
      .mockRejectedValue(new UnauthorizedError('Correo o contraseña incorrectos'));
    const app = setupApp({ execute: mockExecute });

    const response = await request(app).post('/auth/login').send({
      email: 'user@untrm.edu.pe',
      password: 'WrongPassword!',
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
    expect(response.body.error.message).toBe('Correo o contraseña incorrectos');
  });

  it('maps AccountLockedError to 429 ACCOUNT_LOCKED and sets Retry-After header', async () => {
    const mockExecute = vi.fn().mockRejectedValue(new AccountLockedError(600));
    const app = setupApp({ execute: mockExecute });

    const response = await request(app).post('/auth/login').send({
      email: 'user@untrm.edu.pe',
      password: 'Password123!',
    });

    expect(response.status).toBe(429);
    expect(response.headers['retry-after']).toBe('600');
    expect(response.body.error.code).toBe('ACCOUNT_LOCKED');
    expect(response.body.error.retryAfterSeconds).toBe(600);
  });

  it('maps AccountInactiveError and AccountPendingActivationError to 403', async () => {
    const mockExecuteInactive = vi.fn().mockRejectedValue(new AccountInactiveError());
    const appInactive = setupApp({ execute: mockExecuteInactive });

    const resInactive = await request(appInactive)
      .post('/auth/login')
      .send({ email: 'inactive@untrm.edu.pe', password: 'Password123!' });

    expect(resInactive.status).toBe(403);
    expect(resInactive.body.error.code).toBe('ACCOUNT_INACTIVE');

    const mockExecutePending = vi.fn().mockRejectedValue(new AccountPendingActivationError());
    const appPending = setupApp({ execute: mockExecutePending });

    const resPending = await request(appPending)
      .post('/auth/login')
      .send({ email: 'pending@untrm.edu.pe', password: 'Password123!' });

    expect(resPending.status).toBe(403);
    expect(resPending.body.error.code).toBe('ACCOUNT_PENDING_ACTIVATION');
  });

  it('applies the rate limit before validation so malformed requests count towards limit', async () => {
    const rateLimiterCalled = vi.fn((_req, _res, next) => next());
    const app = setupApp({ execute: vi.fn() }, rateLimiterCalled);

    await request(app).post('/auth/login').send({ email: 'invalid-email', password: '' });

    expect(rateLimiterCalled).toHaveBeenCalled();
  });
});

describe('Auth Routes (POST /auth/refresh) (HU-002, T-002-06, RF-002, RS-016, RNF-004, RNF-007, RNF-008)', () => {
  const validRefreshResponseBody = {
    accessToken: 'new.access.jwt',
    accessTokenExpiresAt: '2026-10-30T10:30:00.000Z',
    refreshToken: 'new.refresh.token',
    refreshTokenExpiresAt: '2026-11-06T10:15:00.000Z',
    user: {
      id: 'usr_123',
      names: 'Carlos',
      firstSurname: 'Pérez',
      secondSurname: null,
      email: 'carlos.perez@untrm.edu.pe',
    },
  };

  function setupRefreshApp(
    refreshUseCaseMock: Partial<RefreshSessionUseCase>,
    sessionRateLimiter?: express.RequestHandler,
  ) {
    const app = express();
    app.use(express.json());

    const router = createAuthRouter({
      loginUseCase: { execute: vi.fn() } as unknown as LoginUseCase,
      refreshSessionUseCase: refreshUseCaseMock as RefreshSessionUseCase,
      sessionRateLimiter,
    });

    app.use('/auth', router);
    app.use(errorHandler);

    return app;
  }

  it('refresh responds 200 with no-store headers, sets rotated cookie and returns parsed body without refreshToken', async () => {
    const mockExecute = vi.fn().mockResolvedValue(validRefreshResponseBody);
    const app = setupRefreshApp({ execute: mockExecute });

    const response = await request(app)
      .post('/auth/refresh')
      .set('Cookie', 'sigoa_refresh_token=valid-refresh-token-1234567890');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['pragma']).toBe('no-cache');
    expect(response.headers['set-cookie']).toBeDefined();
    expect(response.headers['set-cookie']![0]).toContain('sigoa_refresh_token=new.refresh.token');
    expect(response.headers['set-cookie']![0]).toContain('HttpOnly');
    expect(response.body.refreshToken).toBeUndefined();
    expect(response.body.accessToken).toBe(validRefreshResponseBody.accessToken);
    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({ refreshToken: 'valid-refresh-token-1234567890' }),
    );
  });

  it('refresh responds 401 without calling the use case when refresh cookie is missing', async () => {
    const mockExecute = vi.fn();
    const app = setupRefreshApp({ execute: mockExecute });

    const response = await request(app).post('/auth/refresh');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
    expect(response.body.error.message).toContain('La sesión expiró o ya no es válida');
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('refresh maps InvalidRefreshTokenError to 401 and clears the cookie', async () => {
    const mockExecute = vi.fn().mockRejectedValue(new InvalidRefreshTokenError());
    const app = setupRefreshApp({ execute: mockExecute });

    const response = await request(app)
      .post('/auth/refresh')
      .set('Cookie', 'sigoa_refresh_token=revoked-or-expired-token');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
    expect(response.body.error.message).toContain('La sesión expiró o ya no es válida');
    expect(response.headers['set-cookie']).toBeDefined();
    expect(response.headers['set-cookie']![0]).toMatch(
      /sigoa_refresh_token=;.*(Expires|Max-Age=0)/i,
    );
  });

  it('refresh responds 429 when the rate limiter rejects', async () => {
    const rejectingLimiter: express.RequestHandler = (_req, _res, next) => {
      next(new TooManyRequestsError());
    };
    const mockExecute = vi.fn();
    const app = setupRefreshApp({ execute: mockExecute }, rejectingLimiter);

    const response = await request(app)
      .post('/auth/refresh')
      .set('Cookie', 'sigoa_refresh_token=some-token');

    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe('RATE_LIMITED');
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('refresh does not leak fields outside the response schema', async () => {
    const rawResultWithLeak = {
      ...validRefreshResponseBody,
      sensitiveInternalSalt: 'internal-salt-should-never-be-sent',
    };
    const mockExecute = vi.fn().mockResolvedValue(rawResultWithLeak);
    const app = setupRefreshApp({ execute: mockExecute });

    const response = await request(app)
      .post('/auth/refresh')
      .set('Cookie', 'sigoa_refresh_token=valid-refresh-token');

    // Esquema strict: ante cualquier campo inesperado falla cerrado (500) y jamás expone datos al cliente
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
    expect(response.body.sensitiveInternalSalt).toBeUndefined();
  });
});

describe('Auth Routes (POST /auth/logout) (HU-002, T-002-07, RF-002, RS-016, RNF-007, RNF-009)', () => {
  function setupLogoutApp(
    logoutUseCaseMock: Partial<LogoutUseCase>,
    authenticateMiddleware?: express.RequestHandler,
    sessionRateLimiter?: express.RequestHandler,
  ) {
    const app = express();
    app.use(express.json());

    const defaultAuth: express.RequestHandler = (_req, res, next) => {
      res.locals['auth'] = { userId: 'usr_authenticated_123' };
      next();
    };

    const router = createAuthRouter({
      loginUseCase: { execute: vi.fn() } as unknown as LoginUseCase,
      logoutUseCase: logoutUseCaseMock as LogoutUseCase,
      authenticate: authenticateMiddleware ?? defaultAuth,
      sessionRateLimiter,
    });

    app.use('/auth', router);
    app.use(errorHandler);

    return app;
  }

  it('logout reads token from cookie, responds 204 without a body, passes the principal user id and clears the cookie', async () => {
    const mockExecute = vi.fn().mockResolvedValue(undefined);
    const app = setupLogoutApp({ execute: mockExecute });

    const response = await request(app)
      .post('/auth/logout')
      .set('Cookie', 'sigoa_refresh_token=valid-refresh-token-to-revoke');

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    expect(response.headers['set-cookie']).toBeDefined();
    expect(response.headers['set-cookie']![0]).toMatch(
      /sigoa_refresh_token=;.*(Expires|Max-Age=0)/i,
    );
    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        refreshToken: 'valid-refresh-token-to-revoke',
        userId: 'usr_authenticated_123',
      }),
    );
  });

  it('logout without cookie still responds 204 and clears the cookie without calling the use case', async () => {
    const mockExecute = vi.fn().mockResolvedValue(undefined);
    const app = setupLogoutApp({ execute: mockExecute });

    const response = await request(app).post('/auth/logout');

    expect(response.status).toBe(204);
    expect(response.headers['set-cookie']).toBeDefined();
    expect(response.headers['set-cookie']![0]).toMatch(
      /sigoa_refresh_token=;.*(Expires|Max-Age=0)/i,
    );
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('logout responds 401 without calling the use case when authenticate rejects', async () => {
    const rejectingAuth: express.RequestHandler = (_req, _res, next) => {
      next(new UnauthorizedError('Acceso no autorizado'));
    };
    const mockExecute = vi.fn();
    const app = setupLogoutApp({ execute: mockExecute }, rejectingAuth);

    const response = await request(app)
      .post('/auth/logout')
      .set('Cookie', 'sigoa_refresh_token=valid-refresh-token');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('logout maps ForbiddenError to 403', async () => {
    const mockExecute = vi
      .fn()
      .mockRejectedValue(new ForbiddenError('No tienes permiso para revocar una sesión ajena.'));
    const app = setupLogoutApp({ execute: mockExecute });

    const response = await request(app)
      .post('/auth/logout')
      .set('Cookie', 'sigoa_refresh_token=token-owned-by-other-user');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(response.body.error.message).toContain('No tienes permiso');
  });
});
