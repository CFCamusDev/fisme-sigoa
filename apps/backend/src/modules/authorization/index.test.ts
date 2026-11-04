import { describe, expect, it } from 'vitest';
import { createAuthorizationServices } from './index.js';
import type { DbProvider } from '../../shared/prisma/prisma-unit-of-work.js';

describe('Authorization Module Entrypoint', () => {
  it('instantiates authorization services factory', () => {
    const dummyDbProvider: DbProvider = {
      get: () => ({}) as unknown as ReturnType<DbProvider['get']>,
    };
    const services = createAuthorizationServices({ dbProvider: dummyDbProvider });
    expect(services).toBeDefined();
    expect(services.grantReader).toBeDefined();
    expect(services.userRoleGateway).toBeDefined();
    expect(services.authorizer).toBeDefined();
    expect(services.requirePermission).toBeDefined();
  });
});
