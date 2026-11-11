import { describe, it, expect } from 'vitest';
import type { AuditLogger } from '../../shared/audit/audit-logger.js';
import type { DbProvider } from '../../shared/prisma/prisma-unit-of-work.js';
import type { UnitOfWork } from '../../shared/unit-of-work/unit-of-work.js';
import {
  createParametersModule,
  createResponseScalesModule,
  createSemestersModule,
} from './index.js';

describe('parameters module', () => {
  it('creates an express router without dependencies', () => {
    const router = createParametersModule();
    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
    expect(typeof router.use).toBe('function');
  });

  it('creates an express router with dependencies injected', () => {
    const dummyDbProvider: DbProvider = {
      get: () => ({}) as unknown as ReturnType<DbProvider['get']>,
    };
    const router = createParametersModule({
      dbProvider: dummyDbProvider,
      unitOfWork: {} as unknown as UnitOfWork,
      auditLogger: {} as unknown as AuditLogger,
      authenticate: (_req, _res, next) => next(),
      requirePermission: () => (_req, _res, next) => next(),
      permissionChecker: {
        assertAllowed: async () => {},
      },
    });
    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
  });

  describe('semesters submodule', () => {
    it('creates an express router without dependencies', () => {
      const router = createSemestersModule();
      expect(router).toBeDefined();
      expect(typeof router).toBe('function');
      expect(typeof router.use).toBe('function');
    });

    it('creates an express router with dependencies injected', () => {
      const dummyDbProvider: DbProvider = {
        get: () => ({}) as unknown as ReturnType<DbProvider['get']>,
      };
      const router = createSemestersModule({
        dbProvider: dummyDbProvider,
        unitOfWork: {} as unknown as UnitOfWork,
        auditLogger: {} as unknown as AuditLogger,
        authenticate: (_req, _res, next) => next(),
        requirePermission: () => (_req, _res, next) => next(),
        permissionChecker: {
          assertAllowed: async () => {},
        },
      });
      expect(router).toBeDefined();
      expect(typeof router).toBe('function');
    });
  });

  describe('response scales submodule', () => {
    it('creates an express router without dependencies', () => {
      const router = createResponseScalesModule();
      expect(router).toBeDefined();
      expect(typeof router).toBe('function');
      expect(typeof router.use).toBe('function');
    });

    it('creates an express router with dependencies injected', () => {
      const dummyDbProvider: DbProvider = {
        get: () => ({}) as unknown as ReturnType<DbProvider['get']>,
      };
      const router = createResponseScalesModule({
        dbProvider: dummyDbProvider,
        unitOfWork: {} as unknown as UnitOfWork,
        auditLogger: {} as unknown as AuditLogger,
        authenticate: (_req, _res, next) => next(),
        requirePermission: () => (_req, _res, next) => next(),
        permissionChecker: {
          assertAllowed: async () => {},
        },
      });
      expect(router).toBeDefined();
      expect(typeof router).toBe('function');
    });
  });
});
