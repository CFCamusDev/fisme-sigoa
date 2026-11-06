import { describe, expect, it } from 'vitest';
import type { RequestHandler } from 'express';
import { createAuthorizationServices, createRolesModule } from './index.js';
import type { DbProvider } from '../../shared/prisma/prisma-unit-of-work.js';

describe('Authorization Module Entrypoint', () => {
  it('instantiates authorization services factory', () => {
    const dummyDbProvider: DbProvider = {
      get: () => ({}) as unknown as ReturnType<DbProvider['get']>,
    };
    const services = createAuthorizationServices({ dbProvider: dummyDbProvider });
    expect(services).toBeDefined();
    expect(services.grantReader).toBeDefined();
    expect(services.roleReader).toBeDefined();
    expect(services.userRoleGateway).toBeDefined();
    expect(services.authorizer).toBeDefined();
    expect(services.listRolesUseCase).toBeDefined();
    expect(services.requirePermission).toBeDefined();
  });

  it('creates the roles router with dependencies wired', () => {
    const dummyDbProvider: DbProvider = {
      get: () => ({}) as unknown as ReturnType<DbProvider['get']>,
    };
    const services = createAuthorizationServices({ dbProvider: dummyDbProvider });
    const dummyAuth: RequestHandler = (_req, _res, next) => next();

    const router = createRolesModule({
      authenticate: dummyAuth,
      services,
    });

    expect(typeof router).toBe('function');
    expect(router.stack).toBeDefined();
    expect(Array.isArray(router.stack)).toBe(true);
    expect(router.stack.length).toBeGreaterThan(0);
  });
});
