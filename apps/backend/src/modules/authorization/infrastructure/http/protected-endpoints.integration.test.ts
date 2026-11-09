import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { createTestEnv } from '../../../../test/test-env.js';
import { createApp } from '../../../../app.js';
import { setupAppRoutes } from '../../../../routes.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { InMemoryEmailSender } from '../../../../shared/email/in-memory-email-sender.js';
import { seedAuthorization } from '../../../../test/factories/authorization.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';
import {
  expectForbiddenWithoutPermission,
  type HttpMethod,
} from '../../../../test/http/expect-forbidden-without-permission.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const openApiPath = path.resolve(__dirname, '../../../../../openapi/openapi.json');

interface ProtectedEndpointSpec {
  readonly method: HttpMethod;
  readonly openApiPath: string;
  readonly requestPath: string;
  readonly requiredPermission: string;
  readonly sampleBody?: Record<string, unknown>;
}

/**
 * Operaciones con bearerAuth que solo exigen estar autenticado (actúan sobre la propia
 * sesión o los propios permisos del actor) y no requieren un código de permiso del catálogo (D11).
 */
const SELF_AUTHENTICATED_OPERATIONS = new Set<string>(['POST /auth/logout', 'GET /me/permissions']);

const PROTECTED_ENDPOINTS: readonly ProtectedEndpointSpec[] = [
  {
    method: 'get',
    openApiPath: '/users',
    requestPath: '/users',
    requiredPermission: 'usuario.ver',
  },
  {
    method: 'post',
    openApiPath: '/users',
    requestPath: '/users',
    requiredPermission: 'usuario.crear',
    sampleBody: {
      names: 'Nuevo',
      firstSurname: 'Usuario',
      email: 'nuevo.usuario@untrm.edu.pe',
      roleIds: ['role-1'],
    },
  },
  {
    method: 'get',
    openApiPath: '/users/{id}',
    requestPath: '/users/usr_target_1',
    requiredPermission: 'usuario.ver',
  },
  {
    method: 'patch',
    openApiPath: '/users/{id}',
    requestPath: '/users/usr_target_1',
    requiredPermission: 'usuario.editar',
    sampleBody: {
      names: 'Nombre Editado',
    },
  },
  {
    method: 'patch',
    openApiPath: '/users/{id}/status',
    requestPath: '/users/usr_target_1/status',
    requiredPermission: 'usuario.editar',
    sampleBody: {
      status: 'INACTIVE',
    },
  },
  {
    method: 'put',
    openApiPath: '/users/{id}/roles',
    requestPath: '/users/usr_target_1/roles',
    requiredPermission: 'usuario.editar',
    sampleBody: {
      roleIds: ['role-1'],
    },
  },
  {
    method: 'put',
    openApiPath: '/users/{id}/permissions',
    requestPath: '/users/usr_target_1/permissions',
    requiredPermission: 'permiso.asignar',
    sampleBody: {
      permissions: [{ code: 'usuario.ver', scope: 'GLOBAL' }],
    },
  },
  {
    method: 'get',
    openApiPath: '/users/{id}/effective-permissions',
    requestPath: '/users/usr_target_1/effective-permissions',
    requiredPermission: 'usuario.ver',
  },
  {
    method: 'get',
    openApiPath: '/roles',
    requestPath: '/roles',
    requiredPermission: 'rol.ver',
  },
  {
    method: 'post',
    openApiPath: '/roles',
    requestPath: '/roles',
    requiredPermission: 'rol.editar',
    sampleBody: {
      name: 'Rol de Prueba',
    },
  },
  {
    method: 'patch',
    openApiPath: '/roles/{id}',
    requestPath: '/roles/role_target_1',
    requiredPermission: 'rol.editar',
    sampleBody: {
      name: 'Rol Renombrado',
    },
  },
  {
    method: 'patch',
    openApiPath: '/roles/{id}/status',
    requestPath: '/roles/role_target_1/status',
    requiredPermission: 'rol.editar',
    sampleBody: {
      status: 'INACTIVE',
    },
  },
  {
    method: 'put',
    openApiPath: '/roles/{id}/permissions',
    requestPath: '/roles/role_target_1/permissions',
    requiredPermission: 'rol.editar',
    sampleBody: {
      permissions: [{ code: 'rol.ver', scope: 'GLOBAL' }],
    },
  },
  {
    method: 'get',
    openApiPath: '/permissions',
    requestPath: '/permissions',
    requiredPermission: 'rol.ver',
  },
  {
    method: 'get',
    openApiPath: '/program',
    requestPath: '/program',
    requiredPermission: 'parametro.ver',
  },
  {
    method: 'patch',
    openApiPath: '/program',
    requestPath: '/program',
    requiredPermission: 'parametro.editar',
    sampleBody: {
      name: 'Ingeniería de Sistemas',
    },
  },
];

describe('Protected Endpoints 403 Coverage & OpenAPI Drift Guard (PostgreSQL real, HU-008, T-008-06, CA1, RF-008, RNF-009, D11)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const env = createTestEnv({
    AUTH_JWT_SECRET: 'test-secret-at-least-32-chars-long-protected-endpoints',
  });

  const emailSender = new InMemoryEmailSender();
  const uow = new PrismaUnitOfWork(prisma);
  const auditServices = createPrismaAuditServices(uow);

  const app = createApp({
    env,
    setupRoutes: (instance) => {
      setupAppRoutes(instance, {
        unitOfWork: uow,
        auditLogger: auditServices.auditLogger,
        dbProvider: uow,
        env,
        emailSender,
      });
    },
  });

  beforeEach(async () => {
    emailSender.clear();
    await seedAuthorization(prisma);
  });

  it('covers every bearerAuth operation in openapi.json (drift guard, D11)', () => {
    const raw = fs.readFileSync(openApiPath, 'utf8');
    const spec = JSON.parse(raw) as {
      paths: Record<string, Record<string, { security?: Array<Record<string, unknown>> }>>;
    };

    const bearerOperationsInSpec: string[] = [];
    for (const [pathKey, pathItem] of Object.entries(spec.paths)) {
      for (const [methodKey, op] of Object.entries(pathItem)) {
        const hasBearer = op.security?.some((sec) =>
          Object.prototype.hasOwnProperty.call(sec, 'bearerAuth'),
        );
        if (hasBearer) {
          const key = `${methodKey.toUpperCase()} ${pathKey}`;
          if (!SELF_AUTHENTICATED_OPERATIONS.has(key)) {
            bearerOperationsInSpec.push(key);
          }
        }
      }
    }

    const coveredOperations = PROTECTED_ENDPOINTS.map(
      (ep) => `${ep.method.toUpperCase()} ${ep.openApiPath}`,
    );

    expect(coveredOperations.sort()).toEqual(bearerOperationsInSpec.sort());
  });

  it('forbids every protected endpoint for an actor without grants and records ACCESS_DENIED (CA1)', async () => {
    const actorWithoutGrants = await createAuthenticatedActor({
      prisma,
      jwtSecret: env.AUTH_JWT_SECRET,
      roles: [],
    });

    for (const endpoint of PROTECTED_ENDPOINTS) {
      await expectForbiddenWithoutPermission({
        app,
        prisma,
        method: endpoint.method,
        path: endpoint.requestPath,
        authHeader: actorWithoutGrants.authHeader,
        actorId: actorWithoutGrants.user.id,
        expectedPermission: endpoint.requiredPermission,
        ...(endpoint.sampleBody !== undefined ? { body: endpoint.sampleBody } : {}),
      });
    }

    const verification = await auditServices.chainVerifier.verify();
    expect(verification).toEqual({
      valid: true,
      checked: PROTECTED_ENDPOINTS.length,
    });
  }, 30_000);
});
