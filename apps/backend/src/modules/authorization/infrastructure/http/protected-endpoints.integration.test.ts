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
import { seedAuthorizationFast } from '../../../../test/factories/authorization.js';
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
  {
    method: 'get',
    openApiPath: '/semesters',
    requestPath: '/semesters',
    requiredPermission: 'parametro.ver',
  },
  {
    method: 'post',
    openApiPath: '/semesters',
    requestPath: '/semesters',
    requiredPermission: 'parametro.editar',
    sampleBody: {
      code: '2027-I',
      startDate: '2027-03-01',
      endDate: '2027-07-31',
    },
  },
  {
    method: 'get',
    openApiPath: '/parameters',
    requestPath: '/parameters',
    requiredPermission: 'parametro.ver',
  },
  {
    method: 'post',
    openApiPath: '/parameters',
    requestPath: '/parameters',
    requiredPermission: 'parametro.editar',
    sampleBody: {
      semesterCode: '2027-I',
      values: [{ key: 'UMBRAL_LOGRADO', value: 15 }],
    },
  },
  {
    method: 'get',
    openApiPath: '/response-scales',
    requestPath: '/response-scales',
    requiredPermission: 'parametro.ver',
  },
  {
    method: 'post',
    openApiPath: '/response-scales',
    requestPath: '/response-scales',
    requiredPermission: 'parametro.editar',
    sampleBody: {
      code: 'EVIDENCE_4_V2',
      name: 'Evidencia 4 (v2)',
      type: 'EVIDENCE',
      levels: [
        { label: 'No se evidencia', value: 1, countsAsAchievement: false },
        { label: 'Se evidencia totalmente', value: 4, countsAsAchievement: true },
      ],
    },
  },
  {
    method: 'patch',
    openApiPath: '/response-scales/{id}',
    requestPath: '/response-scales/scale_target_1',
    requiredPermission: 'parametro.editar',
    sampleBody: { name: 'Nombre editado' },
  },
  {
    method: 'post',
    openApiPath: '/response-scales/{id}/duplicate',
    requestPath: '/response-scales/scale_target_1/duplicate',
    requiredPermission: 'parametro.editar',
    sampleBody: { code: 'COPIA_1', name: 'Copia' },
  },
  {
    method: 'get',
    openApiPath: '/catalog-versions',
    requestPath: '/catalog-versions',
    requiredPermission: 'catalogo.ver',
  },
  {
    method: 'post',
    openApiPath: '/catalog-versions',
    requestPath: '/catalog-versions',
    requiredPermission: 'catalogo.editar',
    sampleBody: {},
  },
  {
    method: 'get',
    openApiPath: '/catalog-versions/{id}',
    requestPath: '/catalog-versions/version_target_1',
    requiredPermission: 'catalogo.ver',
  },
  {
    method: 'get',
    openApiPath: '/catalog-versions/{baseId}/compare/{targetId}',
    requestPath: '/catalog-versions/version_base_1/compare/version_target_1',
    requiredPermission: 'catalogo.ver',
  },
  {
    method: 'put',
    openApiPath: '/catalog-versions/{id}/objectives',
    requestPath: '/catalog-versions/version_target_1/objectives',
    requiredPermission: 'catalogo.editar',
    sampleBody: { operation: 'REORDER', orderedIds: ['objective_1'] },
  },
  {
    method: 'put',
    openApiPath: '/catalog-versions/{id}/attributes',
    requestPath: '/catalog-versions/version_target_1/attributes',
    requiredPermission: 'catalogo.editar',
    sampleBody: { operation: 'REORDER', orderedIds: ['attribute_1'] },
  },
  {
    method: 'post',
    openApiPath: '/catalog-versions/{id}/validation',
    requestPath: '/catalog-versions/version_target_1/validation',
    requiredPermission: 'catalogo.editar',
    sampleBody: {},
  },
  {
    method: 'get',
    openApiPath: '/resolutions',
    requestPath: '/resolutions',
    requiredPermission: 'resolucion.ver',
  },
  {
    method: 'post',
    openApiPath: '/resolutions',
    requestPath: '/resolutions',
    requiredPermission: 'resolucion.registrar',
    sampleBody: {
      type: 'EDUCATIONAL_OBJECTIVE',
      number: 'RD-001/2027',
      issuedOn: '2026-11-10',
      catalogVersionId: 'version_target_1',
    },
  },
  {
    method: 'post',
    openApiPath: '/resolutions/{id}/approve',
    requestPath: '/resolutions/resolution_target_1/approve',
    requiredPermission: 'resolucion.aprobar',
  },
  {
    method: 'get',
    openApiPath: '/templates',
    requestPath: '/templates',
    requiredPermission: 'plantilla.ver',
  },
  {
    method: 'get',
    openApiPath: '/templates/{id}',
    requestPath: '/templates/template_target_1',
    requiredPermission: 'plantilla.ver',
  },
  {
    method: 'put',
    openApiPath: '/templates/{id}/draft',
    requestPath: '/templates/template_target_1/draft',
    requiredPermission: 'plantilla.editar',
    sampleBody: { content: '<p>Contenido de muestra</p>' },
  },
  {
    method: 'post',
    openApiPath: '/templates/{id}/publish',
    requestPath: '/templates/template_target_1/publish',
    requiredPermission: 'plantilla.publicar',
    sampleBody: { versionId: 'version_target_1', expectedUpdatedAt: '2026-11-05T10:00:00.000Z' },
  },
  {
    method: 'post',
    openApiPath: '/templates/{id}/preview',
    requestPath: '/templates/template_target_1/preview',
    requiredPermission: 'plantilla.editar',
    sampleBody: { content: '<p>Contenido de muestra</p>' },
  },
  {
    method: 'get',
    openApiPath: '/stakeholders',
    requestPath: '/stakeholders',
    requiredPermission: 'constituyente.ver',
  },
  {
    method: 'post',
    openApiPath: '/stakeholders',
    requestPath: '/stakeholders',
    requiredPermission: 'constituyente.editar',
    sampleBody: {
      kind: 'PERSON',
      fullName: 'Constituyente de Muestra',
      dni: '45678912',
    },
  },
  {
    method: 'patch',
    openApiPath: '/stakeholders/{id}',
    requestPath: '/stakeholders/stakeholder_target_1',
    requiredPermission: 'constituyente.editar',
    sampleBody: { position: 'Cargo de muestra' },
  },
  {
    method: 'post',
    openApiPath: '/stakeholders/{id}/void',
    requestPath: '/stakeholders/stakeholder_target_1/void',
    requiredPermission: 'constituyente.editar',
    sampleBody: { reason: 'Motivo de muestra para prueba de permiso' },
  },
  {
    method: 'get',
    openApiPath: '/stakeholder-lists',
    requestPath: '/stakeholder-lists',
    requiredPermission: 'constituyente.ver',
  },
  {
    method: 'post',
    openApiPath: '/stakeholder-lists',
    requestPath: '/stakeholder-lists',
    requiredPermission: 'constituyente.editar',
    sampleBody: {
      type: 'EMPLOYER',
      year: 2027,
    },
  },
  {
    method: 'post',
    openApiPath: '/stakeholder-lists/{id}/members',
    requestPath: '/stakeholder-lists/stakeholder_list_target_1/members',
    requiredPermission: 'constituyente.editar',
    sampleBody: {
      stakeholderId: 'stakeholder_target_1',
    },
  },
  {
    method: 'post',
    openApiPath: '/stakeholder-lists/{id}/copy',
    requestPath: '/stakeholder-lists/stakeholder_list_target_1/copy',
    requiredPermission: 'constituyente.editar',
    sampleBody: {
      year: 2028,
    },
  },
  {
    method: 'post',
    openApiPath: '/stakeholder-lists/{id}/import/preview',
    requestPath: '/stakeholder-lists/stakeholder_list_target_1/import/preview',
    requiredPermission: 'constituyente.importar',
  },
  {
    method: 'post',
    openApiPath: '/stakeholder-lists/{id}/import/confirm',
    requestPath: '/stakeholder-lists/stakeholder_list_target_1/import/confirm',
    requiredPermission: 'constituyente.importar',
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
    await seedAuthorizationFast(prisma);
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
