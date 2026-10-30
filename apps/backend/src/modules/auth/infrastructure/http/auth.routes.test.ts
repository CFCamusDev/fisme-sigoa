import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createAuthRouter } from './auth.routes.js';
import type { LoginUseCase } from '../../application/login.js';
import { errorHandler } from '../../../../shared/middleware/error-handler.js';
import { UnauthorizedError } from '../../../../shared/errors/app-error.js';
import {
  AccountInactiveError,
  AccountLockedError,
  AccountPendingActivationError,
} from '../../domain/errors/index.js';

describe('Auth Routes (POST /auth/login) (T-001-12, RS-002, RNF-007, RNF-008)', () => {
  function setupApp(
    useCaseMock: Partial<LoginUseCase>,
    customRateLimiter?: express.RequestHandler,
  ) {
    const app = express();
    app.use(express.json());

    const router = createAuthRouter({
      loginUseCase: useCaseMock as LoginUseCase,
      rateLimiter: customRateLimiter,
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
    expect(response.body).toEqual(validResponseBody);
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
