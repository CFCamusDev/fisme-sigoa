import { describe, expect, it } from 'vitest';
import {
  AccountInactiveError,
  AccountLockedError,
  AccountPendingActivationError,
} from './index.js';
import { UnauthorizedError } from '../../../../shared/errors/app-error.js';

describe('Auth Domain Errors (T-001-11, RS-016, CA3, CA4)', () => {
  it('instantiates AccountLockedError with 429 status, ACCOUNT_LOCKED code and retry seconds', () => {
    const error = new AccountLockedError(900);

    expect(error.httpStatus).toBe(429);
    expect(error.code).toBe('ACCOUNT_LOCKED');
    expect(error.retryAfterSeconds).toBe(900);
    expect(error.message).toContain('15 minutos');
    expect(error.name).toBe('AccountLockedError');
  });

  it('instantiates AccountInactiveError with 403 status and ACCOUNT_INACTIVE code', () => {
    const error = new AccountInactiveError();

    expect(error.httpStatus).toBe(403);
    expect(error.code).toBe('ACCOUNT_INACTIVE');
    expect(error.message).toContain('inactiva');
    expect(error.name).toBe('AccountInactiveError');
  });

  it('instantiates AccountPendingActivationError with 403 status and ACCOUNT_PENDING_ACTIVATION code', () => {
    const error = new AccountPendingActivationError();

    expect(error.httpStatus).toBe(403);
    expect(error.code).toBe('ACCOUNT_PENDING_ACTIVATION');
    expect(error.message).toContain('pendiente de activación');
    expect(error.name).toBe('AccountPendingActivationError');
  });

  it('instantiates UnauthorizedError with 401 status and UNAUTHORIZED code', () => {
    const error = new UnauthorizedError();

    expect(error.httpStatus).toBe(401);
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.message).toBe('Credenciales inválidas');
    expect(error.name).toBe('UnauthorizedError');
  });
});
