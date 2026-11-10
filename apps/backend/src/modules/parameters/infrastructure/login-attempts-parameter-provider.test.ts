import { describe, expect, it, vi } from 'vitest';
import type { ResolvedParameters } from '../domain/services/parameter-resolver.js';
import { LoginAttemptsParameterProvider } from './login-attempts-parameter-provider.js';

const ALL: ResolvedParameters = {
  UMBRAL_LOGRADO: 14,
  META_AG: 70,
  PESO_DIRECTA: 70,
  PESO_INDIRECTA: 30,
  MIN_PARTICIPACION: 3,
  TOKEN_DIAS: 7,
  LOGIN_INTENTOS: 8,
};

describe('LoginAttemptsParameterProvider (HU-011, RF-011)', () => {
  it('returns LOGIN_INTENTOS resolved for the current day', async () => {
    const resolveAt = vi.fn().mockResolvedValue(ALL);
    const provider = new LoginAttemptsParameterProvider({
      resolver: { resolveAt },
      fallbackMaxFailedAttempts: 5,
      clock: () => new Date('2027-04-10T15:00:00.000Z'),
    });

    await expect(provider.getMaxFailedAttempts()).resolves.toBe(8);
    expect(resolveAt).toHaveBeenCalledWith('2027-04-10');
  });

  it('falls back to the configured value and logs when the parameter cannot be resolved', async () => {
    const error = vi.fn();
    const provider = new LoginAttemptsParameterProvider({
      resolver: { resolveAt: vi.fn().mockRejectedValue(new Error('not seeded')) },
      fallbackMaxFailedAttempts: 5,
      logger: { error },
    });

    await expect(provider.getMaxFailedAttempts()).resolves.toBe(5);
    expect(error).toHaveBeenCalledTimes(1);
  });
});
