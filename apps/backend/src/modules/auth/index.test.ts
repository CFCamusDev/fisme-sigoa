import { describe, expect, it } from 'vitest';
import { createAuthServices } from './index.js';
import type { DbProvider } from '../../shared/prisma/prisma-unit-of-work.js';

describe('Auth Module Entrypoint & Factory (F5)', () => {
  it('instantiates auth services factory exposing authenticate and activationTokenIssuer', () => {
    const dummyDbProvider: DbProvider = {
      get: () => ({}) as unknown as ReturnType<DbProvider['get']>,
    };

    const dummyEnv = {
      AUTH_JWT_SECRET: 'test-secret-at-least-32-characters-long-12345',
      AUTH_ACCESS_TTL_SECONDS: 900,
      AUTH_REFRESH_TTL_DAYS: 7,
      AUTH_MAX_FAILED_ATTEMPTS: 5,
      AUTH_LOCKOUT_MINUTES: 15,
    };

    const services = createAuthServices({
      dbProvider: dummyDbProvider,
      env: dummyEnv,
    });

    expect(services).toBeDefined();
    expect(services.userRepository).toBeDefined();
    expect(services.refreshTokenRepository).toBeDefined();
    expect(services.activationTokenRepository).toBeDefined();
    expect(services.activationTokenIssuer).toBeDefined();
    expect(services.authenticate).toBeDefined();
    expect(services.passwordHasher).toBeDefined();
    expect(services.accessTokenSigner).toBeDefined();
    expect(services.accessTokenVerifier).toBeDefined();
    expect(services.refreshTokenGenerator).toBeDefined();
    expect(services.loginPolicy).toBeDefined();
  });
});
