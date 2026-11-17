import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  activateAccountRequestSchema,
  activateAccountResponseSchema,
  apiErrorResponseSchema,
  changeUserStatusRequestSchema,
  createRoleRequestSchema,
  createUserRequestSchema,
  errorCodeSchema,
  forgotPasswordRequestSchema,
  forgotPasswordResponseSchema,
  listPermissionsResponseSchema,
  listRolesResponseSchema,
  listUsersResponseSchema,
  loginRequestSchema,
  loginResponseSchema,
  permissionDtoSchema,
  refreshResponseSchema,
  resetPasswordRequestSchema,
  resetPasswordResponseSchema,
  roleDtoSchema,
  roleGrantSchema,
  updateRolePermissionsRequestSchema,
  updateRoleRequestSchema,
  changeRoleStatusRequestSchema,
  updateUserRequestSchema,
  userDtoSchema,
  assignUserRolesRequestSchema,
  assignUserPermissionsRequestSchema,
  userAccessSchema,
  myPermissionGrantSchema,
  myPermissionsResponseSchema,
  programDtoSchema,
  updateProgramRequestSchema,
  semesterDtoSchema,
  createSemesterRequestSchema,
  listSemestersResponseSchema,
  defineParametersRequestSchema,
  parametersResponseSchema,
  parameterDtoSchema,
  parameterVersionDtoSchema,
  createResponseScaleRequestSchema,
  updateResponseScaleRequestSchema,
  duplicateResponseScaleRequestSchema,
  responseScaleDtoSchema,
  responseScalesResponseSchema,
  scaleLevelDtoSchema,
  catalogVersionDtoSchema,
  sendCatalogVersionToValidationRequestSchema,
  listCatalogVersionsResponseSchema,
  createCatalogVersionRequestSchema,
  catalogObjectivesRequestSchema,
  catalogAttributesRequestSchema,
  catalogObjectivesResponseSchema,
  catalogAttributesResponseSchema,
  catalogComparisonDtoSchema,
  catalogVersionDetailDtoSchema,
  listResolutionsResponseSchema,
  registerResolutionRequestSchema,
  resolutionDtoSchema,
  listTemplatesResponseSchema,
  previewTemplateRequestSchema,
  previewTemplateResponseSchema,
  publishTemplateRequestSchema,
  saveTemplateDraftRequestSchema,
  templateDetailDtoSchema,
  templatePreviewWarningSchema,
  templateSummaryDtoSchema,
  templateVariableSchema,
  templateVersionDtoSchema,
  templateVersionSummaryDtoSchema,
  editStakeholderRequestSchema,
  listStakeholdersResponseSchema,
  registerStakeholderRequestSchema,
  stakeholderDtoSchema,
  voidStakeholderRequestSchema,
  addStakeholderListMemberRequestSchema,
  copyStakeholderListRequestSchema,
  copyStakeholderListResponseSchema,
  createStakeholderListRequestSchema,
  listStakeholderListsResponseSchema,
  stakeholderListDtoSchema,
  stakeholderListMemberDtoSchema,
} from '@sigoa/shared';
import { createAuthRouter } from '../src/modules/auth/infrastructure/http/auth.routes.js';
import { createUsersRouter } from '../src/modules/users/infrastructure/http/users.routes.js';
import type { UsersController } from '../src/modules/users/infrastructure/http/users.controller.js';
import { createRolesRouter } from '../src/modules/authorization/infrastructure/http/roles.routes.js';
import type { RolesController } from '../src/modules/authorization/infrastructure/http/roles.controller.js';
import { createPermissionsRouter } from '../src/modules/authorization/infrastructure/http/permissions.routes.js';
import type { PermissionsController } from '../src/modules/authorization/infrastructure/http/permissions.controller.js';
import { createUserAccessRouter } from '../src/modules/authorization/infrastructure/http/user-access.routes.js';
import type { UserAccessController } from '../src/modules/authorization/infrastructure/http/user-access.controller.js';
import { createMePermissionsRouter } from '../src/modules/authorization/infrastructure/http/me-permissions.routes.js';
import type { MePermissionsController } from '../src/modules/authorization/infrastructure/http/me-permissions.controller.js';
import { createParametersRouter } from '../src/modules/parameters/infrastructure/http/parameters.routes.js';
import type { ParametersController } from '../src/modules/parameters/infrastructure/http/parameters.controller.js';
import { createParameterValuesRouter } from '../src/modules/parameters/infrastructure/http/parameter-values.routes.js';
import type { ParameterValuesController } from '../src/modules/parameters/infrastructure/http/parameter-values.controller.js';
import { createResponseScalesRouter } from '../src/modules/parameters/infrastructure/http/response-scales.routes.js';
import type { ResponseScalesController } from '../src/modules/parameters/infrastructure/http/response-scales.controller.js';
import { createCatalogVersionsRouter } from '../src/modules/catalog/infrastructure/http/catalog-versions.routes.js';
import type { CatalogVersionsController } from '../src/modules/catalog/infrastructure/http/catalog-versions.controller.js';
import type { CatalogVersionItemsController } from '../src/modules/catalog/infrastructure/http/catalog-version-items.controller.js';
import { createResolutionsRouter } from '../src/modules/resolutions/infrastructure/http/resolutions.routes.js';
import type { ResolutionsController } from '../src/modules/resolutions/infrastructure/http/resolutions.controller.js';
import { createTemplatesRouter } from '../src/modules/templates/infrastructure/http/templates.routes.js';
import type { TemplatesController } from '../src/modules/templates/infrastructure/http/templates.controller.js';
import { createSemestersRouter } from '../src/modules/parameters/infrastructure/http/semesters.routes.js';
import type { SemestersController } from '../src/modules/parameters/infrastructure/http/semesters.controller.js';
import { createStakeholdersRouter } from '../src/modules/stakeholders/infrastructure/http/stakeholders.routes.js';
import type { StakeholdersController } from '../src/modules/stakeholders/infrastructure/http/stakeholders.controller.js';
import { createStakeholderListsRouter } from '../src/modules/stakeholders/infrastructure/http/stakeholder-lists.routes.js';
import type { StakeholderListsController } from '../src/modules/stakeholders/infrastructure/http/stakeholder-lists.controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const openApiPath = path.resolve(__dirname, 'openapi.json');

describe('OpenAPI Specification for Auth (T-001-13, T-002-08, RNF-032)', () => {
  const content = fs.readFileSync(openApiPath, 'utf-8');
  const spec = JSON.parse(content);

  it('is a valid OpenAPI 3.1.0 document with /auth/login defined', () => {
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.info).toBeDefined();
    expect(spec.paths).toBeDefined();
    expect(spec.paths['/auth/login']).toBeDefined();
    expect(spec.paths['/auth/login'].post).toBeDefined();
  });

  it('documents refresh and logout endpoints with cookie scheme (T-002-08, HU-002)', () => {
    expect(spec.paths['/auth/refresh']).toBeDefined();
    expect(spec.paths['/auth/refresh'].post).toBeDefined();
    expect(spec.paths['/auth/logout']).toBeDefined();
    expect(spec.paths['/auth/logout'].post).toBeDefined();

    expect(spec.components.schemas.RefreshResponse).toBeDefined();
    expect(spec.components.securitySchemes.bearerAuth).toBeDefined();
    expect(spec.components.securitySchemes.refreshCookie).toBeDefined();
    expect(spec.components.securitySchemes.refreshCookie.type).toBe('apiKey');
    expect(spec.components.securitySchemes.refreshCookie.in).toBe('cookie');
    expect(spec.components.securitySchemes.refreshCookie.name).toBe('sigoa_refresh_token');
  });

  it('documents refresh and logout without request bodies and Set-Cookie headers', () => {
    expect(spec.paths['/auth/refresh'].post.requestBody).toBeUndefined();
    expect(spec.paths['/auth/logout'].post.requestBody).toBeUndefined();

    expect(spec.paths['/auth/login'].post.responses['200'].headers['Set-Cookie']).toBeDefined();
    expect(spec.paths['/auth/refresh'].post.responses['200'].headers['Set-Cookie']).toBeDefined();
    expect(spec.paths['/auth/logout'].post.responses['204'].headers['Set-Cookie']).toBeDefined();
  });

  it('keeps every request and response example valid against the shared schemas (T-002-08)', () => {
    // 1. /auth/login
    const loginReq = spec.paths['/auth/login'].post.requestBody.content['application/json'].example;
    expect(loginRequestSchema.safeParse(loginReq).success).toBe(true);

    const loginRes =
      spec.paths['/auth/login'].post.responses['200'].content['application/json'].example;
    expect(loginResponseSchema.safeParse(loginRes).success).toBe(true);
    expect(loginRes.refreshToken).toBeUndefined();

    // 2. /auth/refresh
    const refreshRes =
      spec.paths['/auth/refresh'].post.responses['200'].content['application/json'].example;
    expect(refreshResponseSchema.safeParse(refreshRes).success).toBe(true);
    expect(refreshRes.refreshToken).toBeUndefined();
  });

  it('declares refreshCookie on refresh and bearerAuth + refreshCookie on logout', () => {
    const refreshPost = spec.paths['/auth/refresh'].post;
    expect(refreshPost.security).toEqual([{ refreshCookie: [] }]);

    const logoutPost = spec.paths['/auth/logout'].post;
    expect(logoutPost.security).toEqual([{ bearerAuth: [] }, { refreshCookie: [] }]);
  });

  it('documents logout success as 204 without content (T-002-08)', () => {
    const logoutResponses = spec.paths['/auth/logout'].post.responses;
    expect(logoutResponses['204']).toBeDefined();
    expect(logoutResponses['204'].content).toBeUndefined();
  });

  it('lists every error status each endpoint can return (T-002-08)', () => {
    const refreshResponses = spec.paths['/auth/refresh'].post.responses;
    expect(refreshResponses['401']).toBeDefined();
    expect(refreshResponses['403']).toBeDefined();
    expect(refreshResponses['429']).toBeDefined();
    expect(refreshResponses['500']).toBeDefined();

    expect(
      apiErrorResponseSchema.safeParse(refreshResponses['401'].content['application/json'].example)
        .success,
    ).toBe(true);
    expect(
      apiErrorResponseSchema.safeParse(refreshResponses['403'].content['application/json'].example)
        .success,
    ).toBe(true);
    expect(
      apiErrorResponseSchema.safeParse(refreshResponses['429'].content['application/json'].example)
        .success,
    ).toBe(true);
    expect(
      apiErrorResponseSchema.safeParse(refreshResponses['500'].content['application/json'].example)
        .success,
    ).toBe(true);

    const logoutResponses = spec.paths['/auth/logout'].post.responses;
    expect(logoutResponses['401']).toBeDefined();
    expect(logoutResponses['403']).toBeDefined();
    expect(logoutResponses['429']).toBeDefined();
    expect(logoutResponses['500']).toBeDefined();

    expect(
      apiErrorResponseSchema.safeParse(logoutResponses['401'].content['application/json'].example)
        .success,
    ).toBe(true);
    expect(
      apiErrorResponseSchema.safeParse(logoutResponses['403'].content['application/json'].example)
        .success,
    ).toBe(true);
    expect(
      apiErrorResponseSchema.safeParse(logoutResponses['429'].content['application/json'].example)
        .success,
    ).toBe(true);
    expect(
      apiErrorResponseSchema.safeParse(logoutResponses['500'].content['application/json'].example)
        .success,
    ).toBe(true);
  });

  it('keeps unique operation ids (T-002-08)', () => {
    const operationIds: string[] = [];
    for (const pathItem of Object.values(
      spec.paths as Record<string, Record<string, { operationId?: string }>>,
    )) {
      for (const operation of Object.values(pathItem)) {
        if (operation.operationId) {
          operationIds.push(operation.operationId);
        }
      }
    }

    const uniqueIds = new Set(operationIds);
    expect(operationIds.length).toBe(uniqueIds.size);
    expect(operationIds).toContain('login');
    expect(operationIds).toContain('refreshSession');
    expect(operationIds).toContain('logout');
    expect(operationIds).toContain('createUser');
    expect(operationIds).toContain('listUsers');
    expect(operationIds).toContain('updateUser');
    expect(operationIds).toContain('changeUserStatus');
    expect(operationIds).toContain('listRoles');
    expect(operationIds).toContain('listPermissions');
    expect(operationIds).toContain('getUser');
  });

  it('documents every login response with a valid example matching its schema', () => {
    const responses = spec.paths['/auth/login'].post.responses;

    // 200 OK
    expect(responses['200']).toBeDefined();
    const successExample = responses['200'].content['application/json'].example;
    const parsedSuccess = loginResponseSchema.safeParse(successExample);
    expect(parsedSuccess.success).toBe(true);

    // 400 Bad Request
    expect(responses['400']).toBeDefined();
    const error400 = responses['400'].content['application/json'].example;
    expect(apiErrorResponseSchema.safeParse(error400).success).toBe(true);

    // 401 Unauthorized
    expect(responses['401']).toBeDefined();
    const error401 = responses['401'].content['application/json'].example;
    expect(apiErrorResponseSchema.safeParse(error401).success).toBe(true);

    // 403 Forbidden (examples: accountInactive, accountPendingActivation)
    expect(responses['403']).toBeDefined();
    const examples403 = responses['403'].content['application/json'].examples;
    expect(apiErrorResponseSchema.safeParse(examples403.accountInactive.value).success).toBe(true);
    expect(
      apiErrorResponseSchema.safeParse(examples403.accountPendingActivation.value).success,
    ).toBe(true);

    // 429 Too Many Requests (examples: accountLocked, rateLimited)
    expect(responses['429']).toBeDefined();
    const examples429 = responses['429'].content['application/json'].examples;
    expect(apiErrorResponseSchema.safeParse(examples429.accountLocked.value).success).toBe(true);
    expect(apiErrorResponseSchema.safeParse(examples429.rateLimited.value).success).toBe(true);

    // 500 Internal Error
    expect(responses['500']).toBeDefined();
    const error500 = responses['500'].content['application/json'].example;
    expect(apiErrorResponseSchema.safeParse(error500).success).toBe(true);
  });

  it('does not expose sensitive fields such as passwordHash, dni or internal counters', () => {
    const rawString = JSON.stringify(spec);

    // Comprobar que en schemas y examples de respuesta no aparezcan datos restringidos
    const schemas = spec.components.schemas;
    expect(schemas.AuthUser.properties).not.toHaveProperty('passwordHash');
    expect(schemas.AuthUser.properties).not.toHaveProperty('dni');
    expect(schemas.AuthUser.properties).not.toHaveProperty('failedLoginAttempts');
    expect(schemas.AuthUser.properties).not.toHaveProperty('lockedUntil');

    expect(schemas.LoginResponse.properties).not.toHaveProperty('passwordHash');
    expect(schemas.LoginResponse.properties).not.toHaveProperty('dni');

    expect(rawString).not.toContain('passwordHash');
    expect(rawString).not.toContain('$argon2id');
  });

  describe('OpenAPI Specification for Users (T-003-14, CA1-CA4, D9, D10, RNF-032)', () => {
    const userPaths = ['/users', '/users/{id}', '/users/{id}/status'];

    it('documents the user endpoints with bearer security', () => {
      expect(spec.paths['/users']).toBeDefined();
      expect(spec.paths['/users'].get).toBeDefined();
      expect(spec.paths['/users'].post).toBeDefined();

      expect(spec.paths['/users/{id}']).toBeDefined();
      expect(spec.paths['/users/{id}'].get).toBeDefined();
      expect(spec.paths['/users/{id}'].patch).toBeDefined();

      expect(spec.paths['/users/{id}/status']).toBeDefined();
      expect(spec.paths['/users/{id}/status'].patch).toBeDefined();

      // Verificar que todos exigen bearerAuth y tienen tag Users
      const operations = [
        spec.paths['/users'].get,
        spec.paths['/users'].post,
        spec.paths['/users/{id}'].get,
        spec.paths['/users/{id}'].patch,
        spec.paths['/users/{id}/status'].patch,
      ];

      for (const op of operations) {
        expect(op.tags).toContain('Users');
        expect(op.security).toEqual([{ bearerAuth: [] }]);
        expect(op.operationId).toBeDefined();
      }
    });

    it('keeps every users request and response example valid against the shared schemas', () => {
      // 1. POST /users
      const postReq = spec.paths['/users'].post.requestBody.content['application/json'].example;
      expect(createUserRequestSchema.safeParse(postReq).success).toBe(true);

      const postRes =
        spec.paths['/users'].post.responses['201'].content['application/json'].example;
      expect(userDtoSchema.safeParse(postRes).success).toBe(true);
      expect(spec.paths['/users'].post.responses['201'].headers['Location']).toBeDefined();
      expect(spec.paths['/users'].post.responses['201'].headers['Cache-Control']).toBeDefined();

      // 2. GET /users
      const getRes = spec.paths['/users'].get.responses['200'].content['application/json'].example;
      expect(listUsersResponseSchema.safeParse(getRes).success).toBe(true);
      expect(spec.paths['/users'].get.responses['200'].headers['Cache-Control']).toBeDefined();

      // 3. PATCH /users/{id}
      const patchReq =
        spec.paths['/users/{id}'].patch.requestBody.content['application/json'].example;
      expect(updateUserRequestSchema.safeParse(patchReq).success).toBe(true);

      const patchRes =
        spec.paths['/users/{id}'].patch.responses['200'].content['application/json'].example;
      expect(userDtoSchema.safeParse(patchRes).success).toBe(true);
      expect(
        spec.paths['/users/{id}'].patch.responses['200'].headers['Cache-Control'],
      ).toBeDefined();

      // 4. PATCH /users/{id}/status
      const patchStatusReq =
        spec.paths['/users/{id}/status'].patch.requestBody.content['application/json'].example;
      expect(changeUserStatusRequestSchema.safeParse(patchStatusReq).success).toBe(true);

      const patchStatusRes =
        spec.paths['/users/{id}/status'].patch.responses['200'].content['application/json'].example;
      expect(userDtoSchema.safeParse(patchStatusRes).success).toBe(true);
      expect(
        spec.paths['/users/{id}/status'].patch.responses['200'].headers['Cache-Control'],
      ).toBeDefined();

      // 5. GET /users/{id}
      const getUserRes =
        spec.paths['/users/{id}'].get.responses['200'].content['application/json'].example;
      expect(userDtoSchema.safeParse(getUserRes).success).toBe(true);
      expect(spec.paths['/users/{id}'].get.responses['200'].headers['Cache-Control']).toBeDefined();
    });

    it('documents the null dni in User schema and update schema', () => {
      const userSchema = spec.components.schemas.User;
      expect(userSchema).toBeDefined();
      expect(userSchema.properties.dni.type).toContain('null');
      expect(userSchema.properties.dni.type).toContain('string');

      const updateSchema = spec.components.schemas.UpdateUserRequest;
      expect(updateSchema).toBeDefined();
      expect(updateSchema.properties.dni.type).toContain('null');
      expect(updateSchema.properties.dni.type).toContain('string');
    });

    it('documents 400, 401, 403, 404 and 409 with the shared error contract', () => {
      const operations = [
        spec.paths['/users'].get,
        spec.paths['/users'].post,
        spec.paths['/users/{id}'].get,
        spec.paths['/users/{id}'].patch,
        spec.paths['/users/{id}/status'].patch,
      ];

      for (const op of operations) {
        expect(op.responses['400']).toBeDefined();
        expect(op.responses['401']).toBeDefined();
        expect(op.responses['403']).toBeDefined();

        for (const code of ['400', '401', '403']) {
          const example = op.responses[code].content['application/json'].example;
          expect(apiErrorResponseSchema.safeParse(example).success).toBe(true);
        }

        if (op.responses['404']) {
          const example = op.responses['404'].content['application/json'].example;
          expect(apiErrorResponseSchema.safeParse(example).success).toBe(true);
        }

        if (op.responses['409']) {
          const example = op.responses['409'].content['application/json'].example;
          expect(apiErrorResponseSchema.safeParse(example).success).toBe(true);
        }
      }
    });

    it('documents every route of the users router and nothing else (guard against drift, D9)', () => {
      const dummyController = {
        create: () => {},
        update: () => {},
        changeStatus: () => {},
        list: () => {},
        get: () => {},
      } as unknown as UsersController;

      const dummyAuth = () => {};
      const dummyRequirePermission = () => () => {};

      const router = createUsersRouter({
        controller: dummyController,
        authenticate: dummyAuth as never,
        requirePermission: dummyRequirePermission as never,
      });

      // Extraer pares { method, path } del router de Express
      const routerEndpoints: { method: string; path: string }[] = [];
      for (const layer of router.stack) {
        if (layer.route) {
          const routePath = layer.route.path;
          const methods = Object.keys(layer.route.methods);
          for (const method of methods) {
            const normalizedPath = ('/users' + (routePath === '/' ? '' : routePath)).replace(
              /:([a-zA-Z0-9_]+)/g,
              '{$1}',
            );
            routerEndpoints.push({ method: method.toLowerCase(), path: normalizedPath });
          }
        }
      }

      expect(routerEndpoints.length).toBe(5);

      // Comprobar que cada ruta del router está en OpenAPI
      for (const endpoint of routerEndpoints) {
        const specPath = spec.paths[endpoint.path];
        expect(specPath, `Path ${endpoint.path} must exist in openapi.json`).toBeDefined();
        expect(
          specPath[endpoint.method],
          `Method ${endpoint.method.toUpperCase()} ${endpoint.path} must exist in openapi.json`,
        ).toBeDefined();
      }

      // Comprobar que en OpenAPI no haya rutas de /users que no existan en el router
      for (const pathKey of userPaths) {
        const specPath = spec.paths[pathKey];
        for (const method of Object.keys(specPath)) {
          const matching = routerEndpoints.find(
            (ep) => ep.path === pathKey && ep.method === method.toLowerCase(),
          );
          expect(
            matching,
            `OpenAPI has ${method.toUpperCase()} ${pathKey} which is not in usersRouter`,
          ).toBeDefined();
        }
      }
    });
  });

  describe('OpenAPI Specification for Roles (HU-003, T-003-15, HU-006, T-006-15, A2, A4, D1)', () => {
    it('documents GET /roles endpoint with bearer security and Roles tag', () => {
      expect(spec.paths['/roles']).toBeDefined();
      expect(spec.paths['/roles'].get).toBeDefined();

      const op = spec.paths['/roles'].get;
      expect(op.tags).toContain('Roles');
      expect(op.security).toEqual([{ bearerAuth: [] }]);
      expect(op.operationId).toBe('listRoles');
      expect(op.description).toContain('rol.ver');
    });

    it('documents POST /roles endpoint with bearer security and Roles tag (T-006-15)', () => {
      expect(spec.paths['/roles'].post).toBeDefined();

      const op = spec.paths['/roles'].post;
      expect(op.tags).toContain('Roles');
      expect(op.security).toEqual([{ bearerAuth: [] }]);
      expect(op.operationId).toBe('createRole');
      expect(op.description).toContain('rol.editar');
    });

    it('documents RoleDto, ListRolesResponse and CreateRoleRequest components', () => {
      expect(spec.components.schemas.RoleDto).toBeDefined();
      expect(spec.components.schemas.ListRolesResponse).toBeDefined();
      expect(spec.components.schemas.CreateRoleRequest).toBeDefined();

      const roleDto = spec.components.schemas.RoleDto;
      expect(roleDto.properties.id).toBeDefined();
      expect(roleDto.properties.code).toBeDefined();
      expect(roleDto.properties.name).toBeDefined();
      expect(roleDto.properties.description).toBeDefined();
      expect(roleDto.properties.isPredefined).toBeDefined();

      const createReq = spec.components.schemas.CreateRoleRequest;
      expect(createReq.properties.name).toBeDefined();
      expect(createReq.required).toContain('name');
    });

    it('keeps GET /roles response example valid against listRolesResponseSchema', () => {
      const getRolesRes =
        spec.paths['/roles'].get.responses['200'].content['application/json'].example;
      expect(listRolesResponseSchema.safeParse(getRolesRes).success).toBe(true);
      expect(spec.paths['/roles'].get.responses['200'].headers['Cache-Control']).toBeDefined();

      for (const item of getRolesRes.items) {
        expect(roleDtoSchema.safeParse(item).success).toBe(true);
      }
    });

    it('keeps POST /roles request and response examples valid against shared schemas (T-006-15)', () => {
      const op = spec.paths['/roles'].post;
      const reqExample = op.requestBody.content['application/json'].example;
      expect(createRoleRequestSchema.safeParse(reqExample).success).toBe(true);

      const res201 = op.responses['201'];
      expect(res201).toBeDefined();
      expect(res201.headers['Cache-Control'].example).toBe('no-store');
      const res201Example = res201.content['application/json'].example;
      expect(roleDtoSchema.safeParse(res201Example).success).toBe(true);

      const err400 = op.responses['400'].content['application/json'].example;
      expect(apiErrorResponseSchema.safeParse(err400).success).toBe(true);
      expect(err400.error.code).toBe('VALIDATION_ERROR');

      const err401 = op.responses['401'].content['application/json'].example;
      expect(apiErrorResponseSchema.safeParse(err401).success).toBe(true);
      expect(err401.error.code).toBe('UNAUTHORIZED');

      const err403 = op.responses['403'].content['application/json'].example;
      expect(apiErrorResponseSchema.safeParse(err403).success).toBe(true);
      expect(err403.error.code).toBe('FORBIDDEN');

      const err409 = op.responses['409'].content['application/json'].example;
      expect(apiErrorResponseSchema.safeParse(err409).success).toBe(true);
      expect(err409.error.code).toBe('CONFLICT');
    });

    it('documents 400, 401 and 403 error responses with the shared error contract (T-006-17)', () => {
      const op = spec.paths['/roles'].get;
      expect(op.responses['400']).toBeDefined();
      expect(op.responses['401']).toBeDefined();
      expect(op.responses['403']).toBeDefined();

      const err400 = op.responses['400'].content['application/json'].example;
      expect(apiErrorResponseSchema.safeParse(err400).success).toBe(true);
      expect(err400.error.code).toBe('VALIDATION_ERROR');

      const err401 = op.responses['401'].content['application/json'].example;
      expect(apiErrorResponseSchema.safeParse(err401).success).toBe(true);

      const err403 = op.responses['403'].content['application/json'].example;
      expect(apiErrorResponseSchema.safeParse(err403).success).toBe(true);
    });

    it('documents PUT /roles/{id}/permissions endpoint with bearer security and Roles tag (T-006-16)', () => {
      expect(spec.paths['/roles/{id}/permissions']).toBeDefined();
      expect(spec.paths['/roles/{id}/permissions'].put).toBeDefined();

      const op = spec.paths['/roles/{id}/permissions'].put;
      expect(op.tags).toContain('Roles');
      expect(op.security).toEqual([{ bearerAuth: [] }]);
      expect(op.operationId).toBe('updateRolePermissions');
      expect(op.description).toContain('rol.editar');
    });

    it('documents UpdateRolePermissionsRequest component (T-006-16)', () => {
      expect(spec.components.schemas.UpdateRolePermissionsRequest).toBeDefined();
      const updateReq = spec.components.schemas.UpdateRolePermissionsRequest;
      expect(updateReq.properties.permissions).toBeDefined();
      expect(updateReq.required).toContain('permissions');
    });

    it('keeps PUT /roles/{id}/permissions request and response examples valid against shared schemas (T-006-16)', () => {
      const op = spec.paths['/roles/{id}/permissions'].put;
      const reqExample = op.requestBody.content['application/json'].example;
      expect(updateRolePermissionsRequestSchema.safeParse(reqExample).success).toBe(true);

      const res200 = op.responses['200'];
      expect(res200).toBeDefined();
      expect(res200.headers['Cache-Control'].example).toBe('no-store');
      const res200Example = res200.content['application/json'].example;
      expect(roleDtoSchema.safeParse(res200Example).success).toBe(true);

      const err400 = op.responses['400'].content['application/json'].example;
      expect(apiErrorResponseSchema.safeParse(err400).success).toBe(true);
      expect(err400.error.code).toBe('VALIDATION_ERROR');

      const err401 = op.responses['401'].content['application/json'].example;
      expect(apiErrorResponseSchema.safeParse(err401).success).toBe(true);
      expect(err401.error.code).toBe('UNAUTHORIZED');

      const err403 = op.responses['403'].content['application/json'].example;
      expect(apiErrorResponseSchema.safeParse(err403).success).toBe(true);
      expect(err403.error.code).toBe('FORBIDDEN');

      const err404 = op.responses['404'].content['application/json'].example;
      expect(apiErrorResponseSchema.safeParse(err404).success).toBe(true);
      expect(err404.error.code).toBe('NOT_FOUND');

      const err409 = op.responses['409'].content['application/json'].example;
      expect(apiErrorResponseSchema.safeParse(err409).success).toBe(true);
      expect(err409.error.code).toBe('CONFLICT');
    });

    it('documents PATCH /roles/{id} endpoint with bearer security and Roles tag (T-006-15)', () => {
      expect(spec.paths['/roles/{id}']).toBeDefined();
      expect(spec.paths['/roles/{id}'].patch).toBeDefined();

      const op = spec.paths['/roles/{id}'].patch;
      expect(op.tags).toContain('Roles');
      expect(op.security).toEqual([{ bearerAuth: [] }]);
      expect(op.operationId).toBe('updateRole');
      expect(op.description).toContain('rol.editar');

      const reqExample = op.requestBody.content['application/json'].example;
      expect(updateRoleRequestSchema.safeParse(reqExample).success).toBe(true);

      const res200 = op.responses['200'];
      expect(res200.headers['Cache-Control'].example).toBe('no-store');
      expect(roleDtoSchema.safeParse(res200.content['application/json'].example).success).toBe(
        true,
      );
    });

    it('documents PATCH /roles/{id}/status endpoint with bearer security and Roles tag (T-006-16, CA3)', () => {
      expect(spec.paths['/roles/{id}/status']).toBeDefined();
      expect(spec.paths['/roles/{id}/status'].patch).toBeDefined();

      const op = spec.paths['/roles/{id}/status'].patch;
      expect(op.tags).toContain('Roles');
      expect(op.security).toEqual([{ bearerAuth: [] }]);
      expect(op.operationId).toBe('changeRoleStatus');
      expect(op.description).toContain('rol.editar');

      const reqExample = op.requestBody.content['application/json'].example;
      expect(changeRoleStatusRequestSchema.safeParse(reqExample).success).toBe(true);

      const res200 = op.responses['200'];
      expect(res200.headers['Cache-Control'].example).toBe('no-store');
      expect(roleDtoSchema.safeParse(res200.content['application/json'].example).success).toBe(
        true,
      );

      const err409 = op.responses['409'].content['application/json'].example;
      expect(apiErrorResponseSchema.safeParse(err409).success).toBe(true);
      expect(err409.error.code).toBe('CONFLICT');
    });

    it('documents every route of the roles router and nothing else (guard against drift, A4, generalized D1)', () => {
      const dummyController = {
        list: () => {},
        create: () => {},
        updatePermissions: () => {},
        update: () => {},
        changeStatus: () => {},
      } as unknown as RolesController;

      const dummyAuth = () => {};
      const dummyRequirePermission = () => () => {};

      const router = createRolesRouter({
        controller: dummyController,
        authenticate: dummyAuth as never,
        requirePermission: dummyRequirePermission as never,
      });

      const routerEndpoints: { method: string; path: string }[] = [];
      for (const layer of router.stack) {
        if (layer.route) {
          const routePath = layer.route.path;
          const methods = Object.keys(layer.route.methods);
          for (const method of methods) {
            const normalizedPath = ('/roles' + (routePath === '/' ? '' : routePath)).replace(
              /:([a-zA-Z0-9_]+)/g,
              '{$1}',
            );
            routerEndpoints.push({ method: method.toLowerCase(), path: normalizedPath });
          }
        }
      }

      expect(routerEndpoints.length).toBeGreaterThan(0);

      for (const endpoint of routerEndpoints) {
        const specPath = spec.paths[endpoint.path];
        expect(specPath, `Path ${endpoint.path} must exist in openapi.json`).toBeDefined();
        expect(
          specPath[endpoint.method],
          `Method ${endpoint.method.toUpperCase()} ${endpoint.path} must exist in openapi.json`,
        ).toBeDefined();
      }

      const rolePathsInSpec = Object.keys(spec.paths).filter((p) => p.startsWith('/roles'));
      for (const pathKey of rolePathsInSpec) {
        const specPath = spec.paths[pathKey];
        for (const method of Object.keys(specPath)) {
          const matching = routerEndpoints.find(
            (ep) => ep.path === pathKey && ep.method === method.toLowerCase(),
          );
          expect(
            matching,
            `OpenAPI has ${method.toUpperCase()} ${pathKey} which is not in rolesRouter`,
          ).toBeDefined();
        }
      }
    });

    it('fails when a route in roles router is missing from openapi spec (negative test against drift)', () => {
      const rogueRouterEndpoints = [{ method: 'delete', path: '/roles/rogue-endpoint' }];
      const specPath = spec.paths[rogueRouterEndpoints[0].path];
      expect(specPath).toBeUndefined();
    });
  });

  describe('OpenAPI Specification for Permissions (HU-006, T-006-18, A4, D1, D3)', () => {
    it('documents GET /permissions endpoint with bearer security and Roles tag', () => {
      expect(spec.paths['/permissions']).toBeDefined();
      expect(spec.paths['/permissions'].get).toBeDefined();

      const op = spec.paths['/permissions'].get;
      expect(op.tags).toContain('Roles');
      expect(op.security).toEqual([{ bearerAuth: [] }]);
      expect(op.operationId).toBe('listPermissions');
      expect(op.description).toContain('rol.ver');
    });

    it('documents PermissionDto and ListPermissionsResponse components', () => {
      expect(spec.components.schemas.PermissionDto).toBeDefined();
      expect(spec.components.schemas.ListPermissionsResponse).toBeDefined();

      const permDto = spec.components.schemas.PermissionDto;
      expect(permDto.properties.code).toBeDefined();
      expect(permDto.properties.description).toBeDefined();
      expect(permDto.properties.module).toBeDefined();
    });

    it('keeps GET /permissions response example valid against listPermissionsResponseSchema', () => {
      const getPermsRes =
        spec.paths['/permissions'].get.responses['200'].content['application/json'].example;
      expect(listPermissionsResponseSchema.safeParse(getPermsRes).success).toBe(true);
      expect(
        spec.paths['/permissions'].get.responses['200'].headers['Cache-Control'],
      ).toBeDefined();

      for (const item of getPermsRes.items) {
        expect(permissionDtoSchema.safeParse(item).success).toBe(true);
      }
    });

    it('documents 400, 401 and 403 error responses for GET /permissions', () => {
      const op = spec.paths['/permissions'].get;
      expect(op.responses['400']).toBeDefined();
      expect(op.responses['401']).toBeDefined();
      expect(op.responses['403']).toBeDefined();

      const err400 = op.responses['400'].content['application/json'].example;
      expect(apiErrorResponseSchema.safeParse(err400).success).toBe(true);
      expect(err400.error.code).toBe('VALIDATION_ERROR');

      const err401 = op.responses['401'].content['application/json'].example;
      expect(apiErrorResponseSchema.safeParse(err401).success).toBe(true);

      const err403 = op.responses['403'].content['application/json'].example;
      expect(apiErrorResponseSchema.safeParse(err403).success).toBe(true);
    });

    it('documents every route of the permissions router and nothing else (guard against drift, A4, generalized D1)', () => {
      const dummyController = {
        list: () => {},
      } as unknown as PermissionsController;

      const dummyAuth = () => {};
      const dummyRequirePermission = () => () => {};

      const router = createPermissionsRouter({
        controller: dummyController,
        authenticate: dummyAuth as never,
        requirePermission: dummyRequirePermission as never,
      });

      const routerEndpoints: { method: string; path: string }[] = [];
      for (const layer of router.stack) {
        if (layer.route) {
          const routePath = layer.route.path;
          const methods = Object.keys(layer.route.methods);
          for (const method of methods) {
            const normalizedPath = ('/permissions' + (routePath === '/' ? '' : routePath)).replace(
              /:([a-zA-Z0-9_]+)/g,
              '{$1}',
            );
            routerEndpoints.push({ method: method.toLowerCase(), path: normalizedPath });
          }
        }
      }

      expect(routerEndpoints.length).toBeGreaterThan(0);

      for (const endpoint of routerEndpoints) {
        const specPath = spec.paths[endpoint.path];
        expect(specPath, `Path ${endpoint.path} must exist in openapi.json`).toBeDefined();
        expect(
          specPath[endpoint.method],
          `Method ${endpoint.method.toUpperCase()} ${endpoint.path} must exist in openapi.json`,
        ).toBeDefined();
      }

      const permPathsInSpec = Object.keys(spec.paths).filter((p) => p.startsWith('/permissions'));
      for (const pathKey of permPathsInSpec) {
        const specPath = spec.paths[pathKey];
        for (const method of Object.keys(specPath)) {
          const matching = routerEndpoints.find(
            (ep) => ep.path === pathKey && ep.method === method.toLowerCase(),
          );
          expect(
            matching,
            `OpenAPI has ${method.toUpperCase()} ${pathKey} which is not in permissionsRouter`,
          ).toBeDefined();
        }
      }
    });

    it('fails when a route in permissions router is missing from openapi spec (negative test against drift)', () => {
      const rogueRouterEndpoints = [{ method: 'delete', path: '/permissions/rogue-endpoint' }];
      const specPath = spec.paths[rogueRouterEndpoints[0].path];
      expect(specPath).toBeUndefined();
    });
  });

  describe('OpenAPI Specification for Account Activation (HU-004, T-004-08, D6)', () => {
    it('documents POST /auth/activate endpoint without security and with Auth tag', () => {
      expect(spec.paths['/auth/activate']).toBeDefined();
      expect(spec.paths['/auth/activate'].post).toBeDefined();

      const op = spec.paths['/auth/activate'].post;
      expect(op.tags).toContain('Auth');
      expect(op.security).toEqual([]);
      expect(op.operationId).toBe('activateAccount');
      expect(op.description).toBeDefined();
    });

    it('documents ActivateAccountRequest and ActivateAccountResponse components', () => {
      expect(spec.components.schemas.ActivateAccountRequest).toBeDefined();
      expect(spec.components.schemas.ActivateAccountResponse).toBeDefined();

      const req = spec.components.schemas.ActivateAccountRequest;
      expect(req.properties.token).toBeDefined();
      expect(req.properties.password).toBeDefined();
      expect(req.required).toEqual(['token', 'password']);

      const res = spec.components.schemas.ActivateAccountResponse;
      expect(res.properties.status).toBeDefined();
      expect(res.required).toEqual(['status']);
    });

    it('keeps POST /auth/activate request and response examples valid against the shared schemas', () => {
      const op = spec.paths['/auth/activate'].post;
      const reqExample = op.requestBody.content['application/json'].example;
      expect(activateAccountRequestSchema.safeParse(reqExample).success).toBe(true);

      const resExample = op.responses['200'].content['application/json'].example;
      expect(activateAccountResponseSchema.safeParse(resExample).success).toBe(true);
      expect(op.responses['200'].headers['Cache-Control']).toBeDefined();
    });

    it('documents 400 (validation & invalid token), 429, and 500 error responses with the shared error contract', () => {
      const op = spec.paths['/auth/activate'].post;
      expect(op.responses['400']).toBeDefined();
      expect(op.responses['429']).toBeDefined();
      expect(op.responses['500']).toBeDefined();

      const err400Examples = op.responses['400'].content['application/json'].examples;
      expect(err400Examples.validationError).toBeDefined();
      expect(apiErrorResponseSchema.safeParse(err400Examples.validationError.value).success).toBe(
        true,
      );
      expect(err400Examples.validationError.value.error.code).toBe('VALIDATION_ERROR');

      expect(err400Examples.invalidTokenError).toBeDefined();
      expect(apiErrorResponseSchema.safeParse(err400Examples.invalidTokenError.value).success).toBe(
        true,
      );
      expect(err400Examples.invalidTokenError.value.error.code).toBe('INVALID_ACTIVATION_TOKEN');

      const err429 = op.responses['429'].content['application/json'].example;
      expect(apiErrorResponseSchema.safeParse(err429).success).toBe(true);
      expect(err429.error.code).toBe('RATE_LIMITED');

      const err500 = op.responses['500'].content['application/json'].example;
      expect(apiErrorResponseSchema.safeParse(err500).success).toBe(true);
      expect(err500.error.code).toBe('INTERNAL_ERROR');
    });

    it('documents POST /auth/forgot-password without security and with the Auth tag (T-005-08)', () => {
      const pathItem = spec.paths['/auth/forgot-password'];
      expect(pathItem).toBeDefined();

      const op = pathItem.post;
      expect(op).toBeDefined();
      expect(op.tags).toEqual(['Auth']);
      expect(op.operationId).toBe('requestPasswordRecovery');
      expect(op.security).toEqual([]);

      // Valida esquema de request y su ejemplo contra Zod
      const reqExample = op.requestBody.content['application/json'].example;
      expect(forgotPasswordRequestSchema.safeParse(reqExample).success).toBe(true);

      // Valida esquema de respuesta 202 y su ejemplo contra Zod
      const res202 = op.responses['202'];
      expect(res202).toBeDefined();
      expect(res202.headers['Cache-Control'].example).toBe('no-store');
      expect(res202.headers['Pragma'].example).toBe('no-cache');
      const res202Example = res202.content['application/json'].example;
      expect(forgotPasswordResponseSchema.safeParse(res202Example).success).toBe(true);
      expect(res202Example.status).toBe('RECEIVED');

      // Valida respuestas de error 400, 429 y 500 contra apiErrorResponseSchema
      const err400 = op.responses['400'].content['application/json'].example;
      expect(apiErrorResponseSchema.safeParse(err400).success).toBe(true);
      expect(err400.error.code).toBe('VALIDATION_ERROR');

      const err429 = op.responses['429'].content['application/json'].example;
      expect(apiErrorResponseSchema.safeParse(err429).success).toBe(true);
      expect(err429.error.code).toBe('RATE_LIMITED');

      const err500 = op.responses['500'].content['application/json'].example;
      expect(apiErrorResponseSchema.safeParse(err500).success).toBe(true);
      expect(err500.error.code).toBe('INTERNAL_ERROR');
    });

    it('documents POST /auth/reset-password without security and with the Auth tag (T-005-08)', () => {
      const pathItem = spec.paths['/auth/reset-password'];
      expect(pathItem).toBeDefined();

      const op = pathItem.post;
      expect(op).toBeDefined();
      expect(op.tags).toEqual(['Auth']);
      expect(op.operationId).toBe('resetPassword');
      expect(op.security).toEqual([]);

      // Valida esquema de request y su ejemplo contra Zod
      const reqExample = op.requestBody.content['application/json'].example;
      expect(resetPasswordRequestSchema.safeParse(reqExample).success).toBe(true);

      // Valida esquema de respuesta 200 y su ejemplo contra Zod
      const res200 = op.responses['200'];
      expect(res200).toBeDefined();
      expect(res200.headers['Cache-Control'].example).toBe('no-store');
      expect(res200.headers['Pragma'].example).toBe('no-cache');
      const res200Example = res200.content['application/json'].example;
      expect(resetPasswordResponseSchema.safeParse(res200Example).success).toBe(true);
      expect(res200Example.status).toBe('PASSWORD_RESET');

      // Valida respuestas de error 400 (validationError e invalidTokenError), 429 y 500
      const err400Examples = op.responses['400'].content['application/json'].examples;
      expect(err400Examples.validationError).toBeDefined();
      expect(apiErrorResponseSchema.safeParse(err400Examples.validationError.value).success).toBe(
        true,
      );
      expect(err400Examples.validationError.value.error.code).toBe('VALIDATION_ERROR');

      expect(err400Examples.invalidTokenError).toBeDefined();
      expect(apiErrorResponseSchema.safeParse(err400Examples.invalidTokenError.value).success).toBe(
        true,
      );
      expect(err400Examples.invalidTokenError.value.error.code).toBe(
        'INVALID_PASSWORD_RESET_TOKEN',
      );

      const err429 = op.responses['429'].content['application/json'].example;
      expect(apiErrorResponseSchema.safeParse(err429).success).toBe(true);
      expect(err429.error.code).toBe('RATE_LIMITED');

      const err500 = op.responses['500'].content['application/json'].example;
      expect(apiErrorResponseSchema.safeParse(err500).success).toBe(true);
      expect(err500.error.code).toBe('INTERNAL_ERROR');
    });

    it('keeps the ApiError code enum strictly identical to errorCodeSchema.options (drift guard)', () => {
      const apiErrorCodeEnum =
        spec.components.schemas.ApiError.properties.error.properties.code.enum;
      const expectedCodes = errorCodeSchema.options;

      expect(apiErrorCodeEnum).toEqual(expectedCodes);
    });

    it('documents every route of the auth router and nothing else (guard against drift, D6)', () => {
      const dummyUseCase = {} as never;
      const dummyAuth = () => {};

      const router = createAuthRouter({
        loginUseCase: dummyUseCase,
        refreshSessionUseCase: dummyUseCase,
        logoutUseCase: dummyUseCase,
        activateAccountUseCase: dummyUseCase,
        requestPasswordRecoveryUseCase: dummyUseCase,
        resetPasswordUseCase: dummyUseCase,
        authenticate: dummyAuth as never,
      });

      const routerEndpoints: { method: string; path: string }[] = [];
      for (const layer of router.stack) {
        if (layer.route) {
          const routePath = layer.route.path;
          const methods = Object.keys(layer.route.methods);
          for (const method of methods) {
            const normalizedPath = ('/auth' + (routePath === '/' ? '' : routePath)).replace(
              /:([a-zA-Z0-9_]+)/g,
              '{$1}',
            );
            routerEndpoints.push({ method: method.toLowerCase(), path: normalizedPath });
          }
        }
      }

      // Debe haber exactamente 6 rutas: /auth/login, /auth/refresh, /auth/logout, /auth/activate, /auth/forgot-password, /auth/reset-password
      expect(routerEndpoints.length).toBe(6);

      for (const endpoint of routerEndpoints) {
        const specPath = spec.paths[endpoint.path];
        expect(specPath, `Path ${endpoint.path} must exist in openapi.json`).toBeDefined();
        expect(
          specPath[endpoint.method],
          `Method ${endpoint.method.toUpperCase()} ${endpoint.path} must exist in openapi.json`,
        ).toBeDefined();
      }

      const authPathsInSpec = Object.keys(spec.paths).filter((p) => p.startsWith('/auth'));
      for (const pathKey of authPathsInSpec) {
        const specPath = spec.paths[pathKey];
        for (const method of Object.keys(specPath)) {
          const matching = routerEndpoints.find(
            (ep) => ep.path === pathKey && ep.method === method.toLowerCase(),
          );
          expect(
            matching,
            `OpenAPI has ${method.toUpperCase()} ${pathKey} which is not in authRouter`,
          ).toBeDefined();
        }
      }
    });
  });

  describe('OpenAPI Specification for Authorization & Drift Guard (HU-006, T-006-19, RNF-032)', () => {
    function getZodRequiredKeys(schema: {
      shape: Record<string, { isOptional?: () => boolean }>;
    }): string[] {
      const required: string[] = [];
      for (const [key, prop] of Object.entries(schema.shape)) {
        if (typeof prop.isOptional === 'function') {
          if (!prop.isOptional()) {
            required.push(key);
          }
        } else {
          required.push(key);
        }
      }
      return required.sort();
    }

    function compareComponentProperties(
      schemaName: string,
      zodSchema: { shape: Record<string, unknown> },
    ): { missingInSpec: string[]; missingInZod: string[] } {
      const specSchema = spec.components.schemas[schemaName];
      if (!specSchema) {
        throw new Error(`Schema ${schemaName} not found in openapi.json`);
      }
      const specProps = Object.keys(specSchema.properties || {}).sort();
      const zodProps = Object.keys(zodSchema.shape).sort();

      const missingInSpec = zodProps.filter((p) => !specProps.includes(p));
      const missingInZod = specProps.filter((p) => !zodProps.includes(p));

      return { missingInSpec, missingInZod };
    }

    it('role and permission components match the shared schemas property by property (T-006-19)', () => {
      const componentsToTest = [
        { name: 'RoleDto', schema: roleDtoSchema },
        { name: 'RoleGrant', schema: roleGrantSchema },
        { name: 'PermissionDto', schema: permissionDtoSchema },
        { name: 'CreateRoleRequest', schema: createRoleRequestSchema },
        { name: 'UpdateRoleRequest', schema: updateRoleRequestSchema },
        { name: 'ChangeRoleStatusRequest', schema: changeRoleStatusRequestSchema },
        { name: 'UpdateRolePermissionsRequest', schema: updateRolePermissionsRequestSchema },
      ];

      for (const { name, schema } of componentsToTest) {
        const { missingInSpec, missingInZod } = compareComponentProperties(name, schema);
        expect(
          missingInSpec,
          `Schema ${name} in openapi.json is missing properties defined in Zod: ${missingInSpec.join(', ')}`,
        ).toEqual([]);
        expect(
          missingInZod,
          `Schema ${name} in openapi.json has extra properties not in Zod: ${missingInZod.join(', ')}`,
        ).toEqual([]);

        // Validate required properties
        const expectedRequired = getZodRequiredKeys(schema as never);
        const actualRequired = [...(spec.components.schemas[name].required || [])].sort();
        expect(
          actualRequired,
          `Schema ${name} in openapi.json required fields do not match Zod non-optional fields`,
        ).toEqual(expectedRequired);
      }

      // Enums verification
      expect(spec.components.schemas.RoleDto.properties.status.enum).toEqual(
        roleDtoSchema.shape.status.options,
      );
      expect(spec.components.schemas.RoleGrant.properties.scope.enum).toEqual(
        roleGrantSchema.shape.scope.options,
      );
      expect(spec.components.schemas.ChangeRoleStatusRequest.properties.status.enum).toEqual(
        changeRoleStatusRequestSchema.shape.status.options,
      );
    });

    interface OpenApiOperationDoc {
      operationId: string;
      description?: string;
      security?: unknown[];
      responses: Record<
        string,
        {
          content?: Record<
            string,
            { example?: unknown; examples?: Record<string, { value: unknown }> }
          >;
        }
      >;
    }

    it('every operation under /roles and /permissions has a unique operationId, bearer security and its error responses (T-006-19)', () => {
      const operations: { method: string; path: string; op: OpenApiOperationDoc }[] = [
        { method: 'get', path: '/roles', op: spec.paths['/roles'].get },
        { method: 'post', path: '/roles', op: spec.paths['/roles'].post },
        {
          method: 'put',
          path: '/roles/{id}/permissions',
          op: spec.paths['/roles/{id}/permissions'].put,
        },
        { method: 'patch', path: '/roles/{id}', op: spec.paths['/roles/{id}'].patch },
        { method: 'patch', path: '/roles/{id}/status', op: spec.paths['/roles/{id}/status'].patch },
        { method: 'get', path: '/permissions', op: spec.paths['/permissions'].get },
      ];

      const operationIds = operations.map((o) => o.op.operationId);
      const uniqueOperationIds = new Set(operationIds);
      expect(uniqueOperationIds.size).toBe(operations.length);

      for (const { method, path, op } of operations) {
        expect(
          op.security,
          `${method.toUpperCase()} ${path} must declare bearerAuth security`,
        ).toEqual([{ bearerAuth: [] }]);

        // Error responses checks
        expect(
          op.responses['400'],
          `${method.toUpperCase()} ${path} must declare 400 response`,
        ).toBeDefined();
        expect(
          op.responses['401'],
          `${method.toUpperCase()} ${path} must declare 401 response`,
        ).toBeDefined();
        expect(
          op.responses['403'],
          `${method.toUpperCase()} ${path} must declare 403 response`,
        ).toBeDefined();
        expect(
          op.responses['500'],
          `${method.toUpperCase()} ${path} must declare 500 response`,
        ).toBeDefined();

        if (['put', 'patch'].includes(method)) {
          expect(
            op.responses['404'],
            `${method.toUpperCase()} ${path} must declare 404 response`,
          ).toBeDefined();
        }
        if (
          ['post', 'put'].includes(method) ||
          path.includes('/status') ||
          path === '/roles/{id}'
        ) {
          if (method !== 'get') {
            expect(
              op.responses['409'],
              `${method.toUpperCase()} ${path} must declare 409 response`,
            ).toBeDefined();
          }
        }
      }
    });

    it('error examples validate against the shared error contract (T-006-19)', () => {
      const operations = [
        spec.paths['/roles'].get,
        spec.paths['/roles'].post,
        spec.paths['/roles/{id}/permissions'].put,
        spec.paths['/roles/{id}'].patch,
        spec.paths['/roles/{id}/status'].patch,
        spec.paths['/permissions'].get,
      ];

      for (const op of operations) {
        for (const statusCode of ['400', '401', '403', '404', '409', '500']) {
          const res = op.responses[statusCode];
          if (!res || !res.content || !res.content['application/json']) continue;

          const content = res.content['application/json'];
          if (content.example) {
            const parsed = apiErrorResponseSchema.safeParse(content.example);
            expect(
              parsed.success,
              `Example for ${statusCode} in ${op.operationId} must match apiErrorResponseSchema`,
            ).toBe(true);
          }
          if (content.examples) {
            for (const [key, ex] of Object.entries(
              content.examples as Record<string, { value: unknown }>,
            )) {
              const parsed = apiErrorResponseSchema.safeParse(ex.value);
              expect(
                parsed.success,
                `Named example ${key} for ${statusCode} in ${op.operationId} must match apiErrorResponseSchema`,
              ).toBe(true);
            }
          }
        }
      }
    });

    it('descriptions name the required permission and the audit action (T-006-19)', () => {
      // Descriptions must name required permissions
      expect(spec.paths['/roles'].get.description).toContain('rol.ver');
      expect(spec.paths['/permissions'].get.description).toContain('rol.ver');

      expect(spec.paths['/roles'].post.description).toContain('rol.editar');
      expect(spec.paths['/roles'].post.description).toContain('CREATE');

      expect(spec.paths['/roles/{id}/permissions'].put.description).toContain('rol.editar');
      expect(spec.paths['/roles/{id}/permissions'].put.description).toContain('PERMISSION_CHANGE');

      expect(spec.paths['/roles/{id}'].patch.description).toContain('rol.editar');
      expect(spec.paths['/roles/{id}'].patch.description).toContain('UPDATE');

      expect(spec.paths['/roles/{id}/status'].patch.description).toContain('rol.editar');
      expect(spec.paths['/roles/{id}/status'].patch.description).toContain('STATE_CHANGE');
    });

    it('fails when a zod field is not documented (negative test against drift) (T-006-19)', () => {
      const mockZodSchemaWithExtra = {
        shape: {
          ...roleDtoSchema.shape,
          undocumentedField: true,
        },
      };

      const result = compareComponentProperties('RoleDto', mockZodSchemaWithExtra as never);
      expect(result.missingInSpec).toContain('undocumentedField');
    });
  });

  describe('OpenAPI Specification for User Access (HU-007, T-007-11, T-007-12, T-007-13, RNF-032, A4, D1, D9, D14)', () => {
    it('documents PUT /users/{id}/roles endpoint with bearer security, 200, 400, 401, 403, 404, 409 responses and valid examples', () => {
      expect(spec.paths['/users/{id}/roles']).toBeDefined();
      expect(spec.paths['/users/{id}/roles'].put).toBeDefined();

      const op = spec.paths['/users/{id}/roles'].put;
      expect(op.operationId).toBe('assignUserRoles');
      expect(op.tags).toContain('Users');
      expect(op.security).toEqual([{ bearerAuth: [] }]);

      // Parámetros
      const idParam = op.parameters?.find(
        (p: { name: string; in: string }) => p.name === 'id' && p.in === 'path',
      );
      expect(idParam).toBeDefined();
      expect(idParam.required).toBe(true);

      // Request body
      expect(op.requestBody).toBeDefined();
      expect(op.requestBody.required).toBe(true);
      const reqSchemaRef = op.requestBody.content['application/json'].schema.$ref;
      expect(reqSchemaRef).toBe('#/components/schemas/AssignUserRolesRequest');

      const reqExample = op.requestBody.content['application/json'].example;
      expect(assignUserRolesRequestSchema.safeParse(reqExample).success).toBe(true);

      // Responses
      expect(op.responses['200']).toBeDefined();
      expect(op.responses['200'].headers['Cache-Control']).toBeDefined();
      const resSchemaRef = op.responses['200'].content['application/json'].schema.$ref;
      expect(resSchemaRef).toBe('#/components/schemas/UserAccess');

      const resExample = op.responses['200'].content['application/json'].example;
      expect(userAccessSchema.safeParse(resExample).success).toBe(true);

      expect(op.responses['400']).toBeDefined();
      expect(op.responses['401']).toBeDefined();
      expect(op.responses['403']).toBeDefined();
      expect(op.responses['404']).toBeDefined();
      expect(op.responses['409']).toBeDefined();
    });

    it('documents PUT /users/{id}/permissions endpoint with bearer security, 200, 400, 401, 403, 404 responses and valid examples', () => {
      expect(spec.paths['/users/{id}/permissions']).toBeDefined();
      expect(spec.paths['/users/{id}/permissions'].put).toBeDefined();

      const op = spec.paths['/users/{id}/permissions'].put;
      expect(op.operationId).toBe('assignUserPermissions');
      expect(op.tags).toContain('Users');
      expect(op.security).toEqual([{ bearerAuth: [] }]);

      // Parámetros
      const idParam = op.parameters?.find(
        (p: { name: string; in: string }) => p.name === 'id' && p.in === 'path',
      );
      expect(idParam).toBeDefined();
      expect(idParam.required).toBe(true);

      // Request body
      expect(op.requestBody).toBeDefined();
      expect(op.requestBody.required).toBe(true);
      const reqSchemaRef = op.requestBody.content['application/json'].schema.$ref;
      expect(reqSchemaRef).toBe('#/components/schemas/AssignUserPermissionsRequest');

      const reqExample = op.requestBody.content['application/json'].example;
      expect(assignUserPermissionsRequestSchema.safeParse(reqExample).success).toBe(true);

      // Responses
      expect(op.responses['200']).toBeDefined();
      expect(op.responses['200'].headers['Cache-Control']).toBeDefined();
      const resSchemaRef = op.responses['200'].content['application/json'].schema.$ref;
      expect(resSchemaRef).toBe('#/components/schemas/UserAccess');

      const resExample = op.responses['200'].content['application/json'].example;
      expect(userAccessSchema.safeParse(resExample).success).toBe(true);

      expect(op.responses['400']).toBeDefined();
      expect(op.responses['401']).toBeDefined();
      expect(op.responses['403']).toBeDefined();
      expect(op.responses['404']).toBeDefined();
    });

    it('documents GET /users/{id}/effective-permissions endpoint with bearer security, 200, 400, 401, 403, 404 responses and valid examples', () => {
      expect(spec.paths['/users/{id}/effective-permissions']).toBeDefined();
      expect(spec.paths['/users/{id}/effective-permissions'].get).toBeDefined();

      const op = spec.paths['/users/{id}/effective-permissions'].get;
      expect(op.operationId).toBe('getUserEffectiveAccess');
      expect(op.tags).toContain('Users');
      expect(op.security).toEqual([{ bearerAuth: [] }]);

      // Parámetros
      const idParam = op.parameters?.find(
        (p: { name: string; in: string }) => p.name === 'id' && p.in === 'path',
      );
      expect(idParam).toBeDefined();
      expect(idParam.required).toBe(true);

      // Responses
      expect(op.responses['200']).toBeDefined();
      expect(op.responses['200'].headers['Cache-Control']).toBeDefined();
      const resSchemaRef = op.responses['200'].content['application/json'].schema.$ref;
      expect(resSchemaRef).toBe('#/components/schemas/UserAccess');

      const resExample = op.responses['200'].content['application/json'].example;
      expect(userAccessSchema.safeParse(resExample).success).toBe(true);

      expect(op.responses['400']).toBeDefined();
      expect(op.responses['401']).toBeDefined();
      expect(op.responses['403']).toBeDefined();
      expect(op.responses['404']).toBeDefined();
    });

    it('enforces bidirectional parity between user-access router and openapi spec (anti-drift guard)', () => {
      const mockController = {
        assignRoles: vi.fn(),
        assignPermissions: vi.fn(),
        getEffectiveAccess: vi.fn(),
      } as unknown as UserAccessController;

      const dummyAuth = vi.fn();
      const dummyRequirePermission = vi.fn().mockReturnValue(vi.fn());

      const router = createUserAccessRouter({
        controller: mockController,
        authenticate: dummyAuth,
        requirePermission: dummyRequirePermission,
      });

      const routerEndpoints: { method: string; path: string }[] = [];
      for (const layer of router.stack) {
        if (layer.route) {
          const routePath = layer.route.path;
          const methods = Object.keys(layer.route.methods);
          for (const method of methods) {
            const normalizedPath = ('/users' + (routePath === '/' ? '' : routePath)).replace(
              /:([a-zA-Z0-9_]+)/g,
              '{$1}',
            );
            routerEndpoints.push({ method: method.toLowerCase(), path: normalizedPath });
          }
        }
      }

      expect(routerEndpoints.length).toBeGreaterThan(0);

      // Comprobar que cada ruta del router está en OpenAPI
      for (const endpoint of routerEndpoints) {
        const specPath = spec.paths[endpoint.path];
        expect(specPath, `Path ${endpoint.path} must exist in openapi.json`).toBeDefined();
        expect(
          specPath[endpoint.method],
          `Method ${endpoint.method.toUpperCase()} ${endpoint.path} must exist in openapi.json`,
        ).toBeDefined();
      }

      // Comprobar que las rutas documentadas en OpenAPI para user-access existen en el router
      for (const endpoint of routerEndpoints) {
        const specPath = spec.paths[endpoint.path];
        for (const method of Object.keys(specPath)) {
          const matching = routerEndpoints.find(
            (ep) => ep.path === endpoint.path && ep.method === method.toLowerCase(),
          );
          expect(
            matching,
            `OpenAPI has ${method.toUpperCase()} ${endpoint.path} which is not in userAccessRouter`,
          ).toBeDefined();
        }
      }
    });

    it('fails when a route in user-access router is missing from openapi spec (negative test against drift)', () => {
      const rogueRouterEndpoints = [{ method: 'put', path: '/users/{id}/rogue-access' }];
      const specPath = spec.paths[rogueRouterEndpoints[0].path];
      expect(specPath).toBeUndefined();
    });

    it('documents that role and permission changes apply on the next request (T-007-14)', () => {
      const rolesOp = spec.paths['/users/{id}/roles'].put;
      expect(rolesOp.description).toContain('siguiente petición');
      expect(rolesOp.description).toContain('invalidación');

      const permsOp = spec.paths['/users/{id}/permissions'].put;
      expect(permsOp.description).toContain('siguiente petición');
      expect(permsOp.description).toContain('invalidación');

      const conflictDesc = rolesOp.responses['409'].description;
      expect(conflictDesc).toContain('revierte');
    });

    it('documents for each endpoint exactly the status codes its integration test exercises (T-007-14)', () => {
      const rolesCodes = Object.keys(spec.paths['/users/{id}/roles'].put.responses).sort();
      expect(rolesCodes).toEqual(['200', '400', '401', '403', '404', '409']);

      const permsCodes = Object.keys(spec.paths['/users/{id}/permissions'].put.responses).sort();
      expect(permsCodes).toEqual(['200', '400', '401', '403', '404']);

      const effCodes = Object.keys(
        spec.paths['/users/{id}/effective-permissions'].get.responses,
      ).sort();
      expect(effCodes).toEqual(['200', '400', '401', '403', '404']);
    });

    it('documents GET /me/permissions with bearerAuth, 200/400/401 responses and parity with mePermissionsRouter (HU-008, T-008-04)', () => {
      expect(spec.paths['/me/permissions']).toBeDefined();
      expect(spec.paths['/me/permissions'].get).toBeDefined();

      const op = spec.paths['/me/permissions'].get;
      expect(op.operationId).toBe('getMyPermissions');
      expect(op.security).toEqual([{ bearerAuth: [] }]);

      const res200 = op.responses['200'];
      expect(res200.headers['Cache-Control'].example).toBe('no-store');
      expect(
        myPermissionsResponseSchema.safeParse(res200.content['application/json'].example).success,
      ).toBe(true);

      expect(
        apiErrorResponseSchema.safeParse(op.responses['400'].content['application/json'].example)
          .success,
      ).toBe(true);
      expect(
        apiErrorResponseSchema.safeParse(op.responses['401'].content['application/json'].example)
          .success,
      ).toBe(true);

      const grantComp = spec.components.schemas.MyPermissionGrant;
      expect(grantComp).toBeDefined();
      expect(Object.keys(grantComp.properties).sort()).toEqual(
        Object.keys(myPermissionGrantSchema.shape).sort(),
      );

      const router = createMePermissionsRouter({
        controller: { getMyPermissions: vi.fn() } as unknown as MePermissionsController,
        authenticate: vi.fn(),
      });

      const routerEndpoints: { method: string; path: string }[] = [];
      for (const layer of router.stack) {
        if (layer.route) {
          const routePath = layer.route.path;
          const methods = Object.keys(layer.route.methods);
          for (const method of methods) {
            const normalizedPath = '/me' + (routePath === '/' ? '' : routePath);
            routerEndpoints.push({ method: method.toLowerCase(), path: normalizedPath });
          }
        }
      }

      expect(routerEndpoints).toEqual([{ method: 'get', path: '/me/permissions' }]);
    });
  });

  describe('OpenAPI Specification for Parameters (HU-009, T-009-10, RF-014)', () => {
    it('documents GET /program and PATCH /program with bearerAuth and proper status codes', () => {
      expect(spec.paths['/program']).toBeDefined();
      expect(spec.paths['/program'].get).toBeDefined();
      expect(spec.paths['/program'].patch).toBeDefined();

      const getOp = spec.paths['/program'].get;
      expect(getOp.tags).toContain('Parameters');
      expect(getOp.operationId).toBe('getProgram');
      expect(getOp.security).toEqual([{ bearerAuth: [] }]);
      expect(Object.keys(getOp.responses).sort()).toEqual(['200', '400', '401', '403', '404']);

      const patchOp = spec.paths['/program'].patch;
      expect(patchOp.tags).toContain('Parameters');
      expect(patchOp.operationId).toBe('updateProgram');
      expect(patchOp.security).toEqual([{ bearerAuth: [] }]);
      expect(Object.keys(patchOp.responses).sort()).toEqual([
        '200',
        '400',
        '401',
        '403',
        '404',
        '409',
      ]);
    });

    it('validates 200 responses and request bodies against schemas from @sigoa/shared', () => {
      const getOp = spec.paths['/program'].get;
      const res200Get = getOp.responses['200'];
      expect(res200Get.headers['Cache-Control'].example).toBe('no-store');
      expect(
        programDtoSchema.safeParse(res200Get.content['application/json'].example).success,
      ).toBe(true);

      const patchOp = spec.paths['/program'].patch;
      const res200Patch = patchOp.responses['200'];
      expect(res200Patch.headers['Cache-Control'].example).toBe('no-store');
      expect(
        programDtoSchema.safeParse(res200Patch.content['application/json'].example).success,
      ).toBe(true);

      const reqBody = patchOp.requestBody;
      expect(reqBody.required).toBe(true);
      expect(
        updateProgramRequestSchema.safeParse(reqBody.content['application/json'].example).success,
      ).toBe(true);
    });

    it('matches components.schemas properties with Zod schemas shape', () => {
      const programDtoComp = spec.components.schemas.ProgramDto;
      expect(programDtoComp).toBeDefined();
      expect(Object.keys(programDtoComp.properties).sort()).toEqual(
        Object.keys(programDtoSchema.shape).sort(),
      );

      const updateReqComp = spec.components.schemas.UpdateProgramRequest;
      expect(updateReqComp).toBeDefined();
      expect(Object.keys(updateReqComp.properties).sort()).toEqual(
        Object.keys(updateProgramRequestSchema.shape).sort(),
      );
    });

    it('has bidirectional parity between openapi spec and createParametersRouter', () => {
      const router = createParametersRouter({
        controller: {
          getProgram: vi.fn(),
          updateProgram: vi.fn(),
        } as unknown as ParametersController,
        authenticate: vi.fn(),
        requirePermission: vi.fn(() => vi.fn()),
      });

      const routerEndpoints: { method: string; path: string }[] = [];
      for (const layer of router.stack) {
        if (layer.route) {
          const routePath = layer.route.path;
          const methods = Object.keys(layer.route.methods);
          for (const method of methods) {
            const normalizedPath = '/program' + (routePath === '/' ? '' : routePath);
            routerEndpoints.push({ method: method.toLowerCase(), path: normalizedPath });
          }
        }
      }

      expect(routerEndpoints.sort((a, b) => a.method.localeCompare(b.method))).toEqual([
        { method: 'get', path: '/program' },
        { method: 'patch', path: '/program' },
      ]);
    });
  });

  describe('OpenAPI Specification for Semesters (HU-010, T-010-09, RF-010, RNF-032)', () => {
    it('documents GET /semesters and POST /semesters with bearerAuth and proper status codes', () => {
      expect(spec.paths['/semesters']).toBeDefined();
      expect(spec.paths['/semesters'].get).toBeDefined();
      expect(spec.paths['/semesters'].post).toBeDefined();

      const getOp = spec.paths['/semesters'].get;
      expect(getOp.tags).toContain('Parameters');
      expect(getOp.operationId).toBe('listSemesters');
      expect(getOp.security).toEqual([{ bearerAuth: [] }]);
      expect(Object.keys(getOp.responses).sort()).toEqual(['200', '400', '401', '403']);

      const postOp = spec.paths['/semesters'].post;
      expect(postOp.tags).toContain('Parameters');
      expect(postOp.operationId).toBe('createSemester');
      expect(postOp.security).toEqual([{ bearerAuth: [] }]);
      expect(Object.keys(postOp.responses).sort()).toEqual(['201', '400', '401', '403', '409']);
    });

    it('validates 200/201 responses and request bodies against schemas from @sigoa/shared', () => {
      const getOp = spec.paths['/semesters'].get;
      const res200Get = getOp.responses['200'];
      expect(res200Get.headers['Cache-Control'].example).toBe('no-store');
      expect(
        listSemestersResponseSchema.safeParse(res200Get.content['application/json'].example)
          .success,
      ).toBe(true);

      const postOp = spec.paths['/semesters'].post;
      const res201Post = postOp.responses['201'];
      expect(res201Post.headers['Cache-Control'].example).toBe('no-store');
      expect(
        semesterDtoSchema.safeParse(res201Post.content['application/json'].example).success,
      ).toBe(true);

      const reqBody = postOp.requestBody;
      expect(reqBody.required).toBe(true);
      expect(
        createSemesterRequestSchema.safeParse(reqBody.content['application/json'].example).success,
      ).toBe(true);
    });

    it('matches components.schemas properties with Zod schemas shape', () => {
      const semesterDtoComp = spec.components.schemas.SemesterDto;
      expect(semesterDtoComp).toBeDefined();
      expect(Object.keys(semesterDtoComp.properties).sort()).toEqual(
        Object.keys(semesterDtoSchema.shape).sort(),
      );

      const createReqComp = spec.components.schemas.CreateSemesterRequest;
      expect(createReqComp).toBeDefined();
      expect(Object.keys(createReqComp.properties).sort()).toEqual(
        Object.keys(createSemesterRequestSchema.shape).sort(),
      );

      const listResComp = spec.components.schemas.ListSemestersResponse;
      expect(listResComp).toBeDefined();
      expect(Object.keys(listResComp.properties).sort()).toEqual(
        Object.keys(listSemestersResponseSchema.shape).sort(),
      );
    });

    it('has bidirectional parity between openapi spec and createSemestersRouter', () => {
      const router = createSemestersRouter({
        controller: {
          createSemester: vi.fn(),
          listSemesters: vi.fn(),
        } as unknown as SemestersController,
        authenticate: vi.fn(),
        requirePermission: vi.fn(() => vi.fn()),
      });

      const routerEndpoints: { method: string; path: string }[] = [];
      for (const layer of router.stack) {
        if (layer.route) {
          const routePath = layer.route.path;
          const methods = Object.keys(layer.route.methods);
          for (const method of methods) {
            const normalizedPath = '/semesters' + (routePath === '/' ? '' : routePath);
            routerEndpoints.push({ method: method.toLowerCase(), path: normalizedPath });
          }
        }
      }

      expect(routerEndpoints.sort((a, b) => a.method.localeCompare(b.method))).toEqual([
        { method: 'get', path: '/semesters' },
        { method: 'post', path: '/semesters' },
      ]);
    });
  });

  describe('OpenAPI Specification for Parameters (HU-011, T-011-11, RF-011, RNF-032)', () => {
    it('documents GET /parameters and POST /parameters with bearerAuth and proper status codes', () => {
      const getOp = spec.paths['/parameters'].get;
      expect(getOp.tags).toContain('Parameters');
      expect(getOp.operationId).toBe('listParameters');
      expect(getOp.security).toEqual([{ bearerAuth: [] }]);
      expect(Object.keys(getOp.responses).sort()).toEqual(['200', '400', '401', '403', '404']);

      const postOp = spec.paths['/parameters'].post;
      expect(postOp.tags).toContain('Parameters');
      expect(postOp.operationId).toBe('defineParameters');
      expect(postOp.security).toEqual([{ bearerAuth: [] }]);
      expect(Object.keys(postOp.responses).sort()).toEqual([
        '201',
        '400',
        '401',
        '403',
        '404',
        '409',
      ]);
    });

    it('validates 200/201 examples and the request body against schemas from @sigoa/shared', () => {
      const getOp = spec.paths['/parameters'].get;
      const res200 = getOp.responses['200'];
      expect(res200.headers['Cache-Control'].example).toBe('no-store');
      expect(
        parametersResponseSchema.safeParse(res200.content['application/json'].example).success,
      ).toBe(true);

      const postOp = spec.paths['/parameters'].post;
      const res201 = postOp.responses['201'];
      expect(res201.headers['Cache-Control'].example).toBe('no-store');
      expect(
        parametersResponseSchema.safeParse(res201.content['application/json'].example).success,
      ).toBe(true);

      const reqBody = postOp.requestBody;
      expect(reqBody.required).toBe(true);
      expect(
        defineParametersRequestSchema.safeParse(reqBody.content['application/json'].example)
          .success,
      ).toBe(true);
    });

    it('matches components.schemas properties with Zod schemas shape', () => {
      const expectations: [string, string[]][] = [
        ['ParametersResponse', Object.keys(parametersResponseSchema.shape)],
        ['ParameterDto', Object.keys(parameterDtoSchema.shape)],
        ['ParameterVersionDto', Object.keys(parameterVersionDtoSchema.shape)],
      ];
      for (const [name, keys] of expectations) {
        const component = spec.components.schemas[name];
        expect(component, name).toBeDefined();
        expect(Object.keys(component.properties).sort(), name).toEqual([...keys].sort());
      }
      expect(
        Object.keys(spec.components.schemas.DefineParametersRequest.properties).sort(),
      ).toEqual(['semesterCode', 'values']);
    });

    it('has bidirectional parity between openapi spec and createParameterValuesRouter', () => {
      const router = createParameterValuesRouter({
        controller: {
          defineParameters: vi.fn(),
          listParameters: vi.fn(),
        } as unknown as ParameterValuesController,
        authenticate: vi.fn(),
        requirePermission: vi.fn(() => vi.fn()),
      });

      const routerEndpoints: { method: string; path: string }[] = [];
      for (const layer of router.stack) {
        if (layer.route) {
          const routePath = layer.route.path;
          for (const method of Object.keys(layer.route.methods)) {
            const normalizedPath = '/parameters' + (routePath === '/' ? '' : routePath);
            routerEndpoints.push({ method: method.toLowerCase(), path: normalizedPath });
          }
        }
      }

      expect(routerEndpoints.sort((a, b) => a.method.localeCompare(b.method))).toEqual([
        { method: 'get', path: '/parameters' },
        { method: 'post', path: '/parameters' },
      ]);
    });
  });

  describe('OpenAPI Specification for Response Scales (HU-012, T-012-15, RF-012, RNF-032)', () => {
    const base = spec.paths['/response-scales'];
    const byId = spec.paths['/response-scales/{id}'];
    const duplicate = spec.paths['/response-scales/{id}/duplicate'];

    it('documents the four operations with bearerAuth and proper status codes', () => {
      const expectations: [string, string, string[]][] = [
        ['listResponseScales', 'get', ['200', '400', '401', '403']],
        ['createResponseScale', 'post', ['201', '400', '401', '403', '409']],
      ];
      for (const [operationId, method, codes] of expectations) {
        const op = base[method];
        expect(op.operationId).toBe(operationId);
        expect(op.tags).toContain('ResponseScales');
        expect(op.security).toEqual([{ bearerAuth: [] }]);
        expect(Object.keys(op.responses).sort()).toEqual(codes);
      }

      expect(byId.patch.operationId).toBe('editResponseScale');
      expect(byId.patch.security).toEqual([{ bearerAuth: [] }]);
      expect(Object.keys(byId.patch.responses).sort()).toEqual([
        '200',
        '400',
        '401',
        '403',
        '404',
        '409',
      ]);

      expect(duplicate.post.operationId).toBe('duplicateResponseScale');
      expect(duplicate.post.security).toEqual([{ bearerAuth: [] }]);
      expect(Object.keys(duplicate.post.responses).sort()).toEqual([
        '201',
        '400',
        '401',
        '403',
        '404',
        '409',
      ]);
    });

    it('proposes duplicating in the 409 of the edit operation (CA3)', () => {
      const example = byId.patch.responses['409'].content['application/json'].example;
      expect(example.error.code).toBe('CONFLICT');
      expect(example.error.message).toContain('Duplícala');
    });

    it('validates the response and request examples against the shared schemas', () => {
      const list200 = base.get.responses['200'];
      expect(list200.headers['Cache-Control'].example).toBe('no-store');
      expect(
        responseScalesResponseSchema.safeParse(list200.content['application/json'].example).success,
      ).toBe(true);

      for (const res of [
        base.post.responses['201'],
        byId.patch.responses['200'],
        duplicate.post.responses['201'],
      ]) {
        expect(res.headers['Cache-Control'].example).toBe('no-store');
        expect(
          responseScaleDtoSchema.safeParse(res.content['application/json'].example).success,
        ).toBe(true);
      }

      expect(
        createResponseScaleRequestSchema.safeParse(
          base.post.requestBody.content['application/json'].example,
        ).success,
      ).toBe(true);
      expect(
        updateResponseScaleRequestSchema.safeParse(
          byId.patch.requestBody.content['application/json'].example,
        ).success,
      ).toBe(true);
      expect(
        duplicateResponseScaleRequestSchema.safeParse(
          duplicate.post.requestBody.content['application/json'].example,
        ).success,
      ).toBe(true);
    });

    it('documents the id path parameter and the type query parameter', () => {
      expect(byId.patch.parameters[0]).toMatchObject({ name: 'id', in: 'path', required: true });
      expect(duplicate.post.parameters[0]).toMatchObject({
        name: 'id',
        in: 'path',
        required: true,
      });
      expect(base.get.parameters[0]).toMatchObject({ name: 'type', in: 'query', required: false });
      expect(base.get.parameters[0].schema.enum).toEqual(['LIKERT', 'NUMERIC', 'EVIDENCE']);
    });

    it('matches components.schemas properties with Zod schemas shape', () => {
      const expectations: [string, string[]][] = [
        ['ResponseScaleDto', Object.keys(responseScaleDtoSchema.shape)],
        ['ScaleLevelDto', Object.keys(scaleLevelDtoSchema.shape)],
        ['ResponseScalesResponse', Object.keys(responseScalesResponseSchema.shape)],
        ['CreateResponseScaleRequest', Object.keys(createResponseScaleRequestSchema.shape)],
        ['UpdateResponseScaleRequest', Object.keys(updateResponseScaleRequestSchema.shape)],
        ['DuplicateResponseScaleRequest', Object.keys(duplicateResponseScaleRequestSchema.shape)],
      ];
      for (const [name, keys] of expectations) {
        const component = spec.components.schemas[name];
        expect(component, name).toBeDefined();
        expect(Object.keys(component.properties).sort(), name).toEqual([...keys].sort());
      }
    });

    it('has bidirectional parity between openapi spec and createResponseScalesRouter', () => {
      const router = createResponseScalesRouter({
        controller: {
          listResponseScales: vi.fn(),
          createResponseScale: vi.fn(),
          editResponseScale: vi.fn(),
          duplicateResponseScale: vi.fn(),
        } as unknown as ResponseScalesController,
        authenticate: vi.fn(),
        requirePermission: vi.fn(() => vi.fn()),
      });

      const routerEndpoints: { method: string; path: string }[] = [];
      for (const layer of router.stack) {
        if (layer.route) {
          const routePath = layer.route.path.replace(':id', '{id}');
          for (const method of Object.keys(layer.route.methods)) {
            const normalizedPath = '/response-scales' + (routePath === '/' ? '' : routePath);
            routerEndpoints.push({ method: method.toLowerCase(), path: normalizedPath });
          }
        }
      }

      const key = (e: { method: string; path: string }) => e.method + ' ' + e.path;
      expect(routerEndpoints.map(key).sort()).toEqual([
        'get /response-scales',
        'patch /response-scales/{id}',
        'post /response-scales',
        'post /response-scales/{id}/duplicate',
      ]);
    });
  });

  describe('OpenAPI Specification for Catalog Versions (HU-013, T-013-14, RF-013, RNF-032)', () => {
    const base = spec.paths['/catalog-versions'];

    it('documents both operations with bearerAuth and proper status codes', () => {
      const expectations: [string, string, string[]][] = [
        ['listCatalogVersions', 'get', ['200', '400', '401', '403', '404']],
        ['createCatalogVersion', 'post', ['201', '400', '401', '403', '404', '409']],
      ];
      for (const [operationId, method, codes] of expectations) {
        const op = base[method];
        expect(op.operationId).toBe(operationId);
        expect(op.tags).toContain('CatalogVersions');
        expect(op.security).toEqual([{ bearerAuth: [] }]);
        expect(Object.keys(op.responses).sort()).toEqual(codes);
      }
    });

    it('validates the response and request examples against the shared schemas', () => {
      const list200 = base.get.responses['200'];
      expect(list200.headers['Cache-Control'].example).toBe('no-store');
      const listExample = list200.content['application/json'].example;
      expect(listCatalogVersionsResponseSchema.safeParse(listExample).success).toBe(true);
      expect(listExample.items.length).toBeGreaterThan(1);

      const created = base.post.responses['201'];
      expect(created.headers['Cache-Control'].example).toBe('no-store');
      const createdExample = created.content['application/json'].example;
      expect(catalogVersionDtoSchema.safeParse(createdExample).success).toBe(true);
      expect(createdExample.status).toBe('DRAFT');

      const requestExample = base.post.requestBody.content['application/json'].example;
      expect(createCatalogVersionRequestSchema.safeParse(requestExample).success).toBe(true);
      expect(base.post.requestBody.required).toBe(false);
    });

    it('explains the open version conflict in the 409 of the create operation (CA2)', () => {
      const example = base.post.responses['409'].content['application/json'].example;
      expect(example.error.code).toBe('CONFLICT');
      expect(example.error.message).toContain('Borrador o En validación');
    });

    it('matches components.schemas properties with Zod schemas shape', () => {
      const dto = spec.components.schemas['CatalogVersionDto'];
      expect(Object.keys(dto.properties).sort()).toEqual(
        Object.keys(catalogVersionDtoSchema.shape).sort(),
      );
      expect([...dto.required].sort()).toEqual(Object.keys(catalogVersionDtoSchema.shape).sort());
      expect(dto.properties.basedOnVersionId.type).toEqual(['string', 'null']);
      expect(dto.properties.status.enum).toEqual([
        'DRAFT',
        'IN_VALIDATION',
        'APPROVED',
        'HISTORICAL',
      ]);

      const list = spec.components.schemas['ListCatalogVersionsResponse'];
      expect(Object.keys(list.properties).sort()).toEqual(
        Object.keys(listCatalogVersionsResponseSchema.shape).sort(),
      );
      expect(spec.components.schemas['CreateCatalogVersionRequest'].additionalProperties).toBe(
        false,
      );
    });

    it('documents the item edit and detail operations with bearerAuth and status codes (HU-014, T-014-08)', () => {
      const expectations: [string, string, string, string[]][] = [
        [
          '/catalog-versions/{id}',
          'get',
          'getCatalogVersionDetail',
          ['200', '400', '401', '403', '404'],
        ],
        [
          '/catalog-versions/{id}/objectives',
          'put',
          'editCatalogObjectives',
          ['200', '400', '401', '403', '404', '409'],
        ],
        [
          '/catalog-versions/{id}/attributes',
          'put',
          'editCatalogAttributes',
          ['200', '400', '401', '403', '404', '409'],
        ],
      ];
      for (const [route, method, operationId, codes] of expectations) {
        const op = spec.paths[route][method];
        expect(op.operationId).toBe(operationId);
        expect(op.tags).toContain('CatalogVersions');
        expect(op.security).toEqual([{ bearerAuth: [] }]);
        expect(op.parameters[0]).toMatchObject({ name: 'id', in: 'path', required: true });
        expect(Object.keys(op.responses).sort()).toEqual(codes);
        expect(op.responses['200'].headers['Cache-Control'].example).toBe('no-store');
      }
    });

    it('documents the send to validation operation with bearerAuth and status codes (HU-015, T-015-04)', () => {
      const op = spec.paths['/catalog-versions/{id}/validation'].post;
      expect(op.operationId).toBe('sendCatalogVersionToValidation');
      expect(op.tags).toContain('CatalogVersions');
      expect(op.security).toEqual([{ bearerAuth: [] }]);
      expect(op.parameters[0]).toMatchObject({ name: 'id', in: 'path', required: true });
      expect(Object.keys(op.responses).sort()).toEqual(['200', '400', '401', '403', '404', '409']);
      expect(op.responses['200'].headers['Cache-Control'].example).toBe('no-store');
      expect(op.requestBody.required).toBe(false);
      expect(
        sendCatalogVersionToValidationRequestSchema.safeParse(
          op.requestBody.content['application/json'].example,
        ).success,
      ).toBe(true);
      const example = op.responses['200'].content['application/json'].example;
      const parsed = catalogVersionDtoSchema.safeParse(example);
      expect(parsed.success).toBe(true);
      expect(example.status).toBe('IN_VALIDATION');
      expect(
        spec.components.schemas['SendCatalogVersionToValidationRequest'].additionalProperties,
      ).toBe(false);
    });

    it('keeps the item edit examples valid against the shared schemas (HU-014, T-014-08)', () => {
      const objectives = spec.paths['/catalog-versions/{id}/objectives'].put;
      for (const example of Object.values(
        objectives.requestBody.content['application/json'].examples,
      ) as { value: unknown }[]) {
        expect(catalogObjectivesRequestSchema.safeParse(example.value).success).toBe(true);
      }
      expect(
        catalogObjectivesResponseSchema.safeParse(
          objectives.responses['200'].content['application/json'].example,
        ).success,
      ).toBe(true);

      const attributes = spec.paths['/catalog-versions/{id}/attributes'].put;
      for (const example of Object.values(
        attributes.requestBody.content['application/json'].examples,
      ) as { value: unknown }[]) {
        expect(catalogAttributesRequestSchema.safeParse(example.value).success).toBe(true);
      }
      expect(
        catalogAttributesResponseSchema.safeParse(
          attributes.responses['200'].content['application/json'].example,
        ).success,
      ).toBe(true);

      const detail = spec.paths['/catalog-versions/{id}'].get;
      expect(
        catalogVersionDetailDtoSchema.safeParse(
          detail.responses['200'].content['application/json'].example,
        ).success,
      ).toBe(true);
    });

    it('declares the item schemas strict and discriminated by operation (HU-014, T-014-08)', () => {
      const schemas = spec.components.schemas;
      for (const name of [
        'SaveCatalogObjectiveRequest',
        'SaveCatalogAttributeRequest',
        'ReorderCatalogItemsRequest',
        'CatalogObjectiveDto',
        'CatalogAttributeDto',
        'CatalogVersionDetailDto',
        'CatalogObjectivesResponse',
        'CatalogAttributesResponse',
      ]) {
        expect(schemas[name].additionalProperties, name).toBe(false);
      }
      expect(schemas['CatalogObjectivesRequest'].discriminator.propertyName).toBe('operation');
      expect(schemas['CatalogAttributesRequest'].discriminator.propertyName).toBe('operation');
      expect(schemas['ReorderCatalogItemsRequest'].properties.orderedIds.maxItems).toBe(100);
      expect(schemas['SaveCatalogAttributeRequest'].required).toContain('name');
      expect(schemas['SaveCatalogObjectiveRequest'].properties.name).toBeUndefined();
    });

    it('documents the comparison operation and the history field (HU-017, T-017-05)', () => {
      const op = spec.paths['/catalog-versions/{baseId}/compare/{targetId}'].get;
      expect(op.operationId).toBe('compareCatalogVersions');
      expect(op.tags).toContain('CatalogVersions');
      expect(op.security).toEqual([{ bearerAuth: [] }]);
      expect(op.parameters.map((parameter: { name: string }) => parameter.name)).toEqual([
        'baseId',
        'targetId',
      ]);
      for (const parameter of op.parameters) {
        expect(parameter).toMatchObject({ in: 'path', required: true });
      }
      expect(Object.keys(op.responses).sort()).toEqual(['200', '400', '401', '403', '404']);
      expect(op.responses['200'].headers['Cache-Control'].example).toBe('no-store');
      expect(
        catalogComparisonDtoSchema.safeParse(
          op.responses['200'].content['application/json'].example,
        ).success,
      ).toBe(true);

      const schemas = spec.components.schemas;
      for (const name of [
        'CatalogComparisonDto',
        'CatalogComparedVersionDto',
        'CatalogItemDiffDto',
        'CatalogItemSideDto',
        'WordDiffSegmentDto',
        'CatalogVersionHistoryDto',
        'CatalogVersionResolutionDto',
      ]) {
        expect(schemas[name].additionalProperties, name).toBe(false);
      }
      expect(schemas['CatalogVersionDetailDto'].required).toContain('history');
      expect(Object.keys(schemas['CatalogComparisonDto'].properties).sort()).toEqual(
        Object.keys(catalogComparisonDtoSchema.shape).sort(),
      );
    });

    it('has bidirectional parity between openapi spec and createCatalogVersionsRouter', () => {
      const router = createCatalogVersionsRouter({
        controller: {
          listCatalogVersions: vi.fn(),
          createCatalogVersion: vi.fn(),
        } as unknown as CatalogVersionsController,
        itemsController: {
          editObjectives: vi.fn(),
          editAttributes: vi.fn(),
          getVersionDetail: vi.fn(),
          compareVersions: vi.fn(),
          sendToValidation: vi.fn(),
        } as unknown as CatalogVersionItemsController,
        authenticate: vi.fn(),
        requirePermission: vi.fn(() => vi.fn()),
      });

      const routerEndpoints: { method: string; path: string }[] = [];
      for (const layer of router.stack) {
        if (layer.route) {
          for (const method of Object.keys(layer.route.methods)) {
            const normalizedPath =
              '/catalog-versions' + (layer.route.path === '/' ? '' : layer.route.path);
            routerEndpoints.push({ method: method.toLowerCase(), path: normalizedPath });
          }
        }
      }

      const key = (e: { method: string; path: string }) => e.method + ' ' + e.path;
      expect(routerEndpoints.map(key).sort()).toEqual([
        'get /catalog-versions',
        'get /catalog-versions/:baseId/compare/:targetId',
        'get /catalog-versions/:id',
        'post /catalog-versions',
        'post /catalog-versions/:id/validation',
        'put /catalog-versions/:id/attributes',
        'put /catalog-versions/:id/objectives',
      ]);
    });
  });

  describe('OpenAPI Specification for Resolutions (HU-048, T-048-12, RF-048, RNF-032)', () => {
    it('documents the three operations with bearerAuth and proper status codes', () => {
      const expectations: [string, string, string, string[]][] = [
        ['/resolutions', 'get', 'listResolutions', ['200', '400', '401', '403']],
        ['/resolutions', 'post', 'registerResolution', ['201', '400', '401', '403', '404', '409']],
        [
          '/resolutions/{id}/approve',
          'post',
          'approveResolution',
          ['200', '400', '401', '403', '404', '409'],
        ],
      ];
      for (const [route, method, operationId, codes] of expectations) {
        const op = spec.paths[route][method];
        expect(op.operationId).toBe(operationId);
        expect(op.tags).toContain('Resolutions');
        expect(op.security).toEqual([{ bearerAuth: [] }]);
        expect(Object.keys(op.responses).sort()).toEqual(codes);
        const success = op.responses[codes[0] as string];
        expect(success.headers['Cache-Control'].example).toBe('no-store');
      }
    });

    it('validates the request and response examples against the shared schemas', () => {
      const register = spec.paths['/resolutions'].post;
      expect(
        registerResolutionRequestSchema.safeParse(
          register.requestBody.content['application/json'].example,
        ).success,
      ).toBe(true);
      const registered = register.responses['201'].content['application/json'].example;
      expect(resolutionDtoSchema.safeParse(registered).success).toBe(true);
      expect(registered.status).toBe('REGISTERED');
      expect(registered.pdfFileId).toBeNull();

      const approved =
        spec.paths['/resolutions/{id}/approve'].post.responses['200'].content['application/json']
          .example;
      expect(resolutionDtoSchema.safeParse(approved).success).toBe(true);
      expect(approved.status).toBe('APPROVED');
      expect(approved.pdfFileId).not.toBeNull();

      const list =
        spec.paths['/resolutions'].get.responses['200'].content['application/json'].example;
      expect(listResolutionsResponseSchema.safeParse(list).success).toBe(true);
      expect(list.items.length).toBeGreaterThan(1);
    });

    it('documents the approval body as a binary pdf and the id parameter', () => {
      const op = spec.paths['/resolutions/{id}/approve'].post;
      expect(op.requestBody.required).toBe(true);
      expect(Object.keys(op.requestBody.content)).toEqual(['application/pdf']);
      expect(op.requestBody.content['application/pdf'].schema).toMatchObject({
        type: 'string',
        format: 'binary',
      });
      expect(op.parameters[0]).toMatchObject({ name: 'id', in: 'path', required: true });
    });

    it('documents the list filters and pagination limits', () => {
      const params = spec.paths['/resolutions'].get.parameters;
      expect(params.map((param: { name: string }) => param.name).sort()).toEqual([
        'catalogVersionId',
        'page',
        'pageSize',
        'status',
        'type',
      ]);
      const pageSize = params.find((param: { name: string }) => param.name === 'pageSize');
      expect(pageSize.schema.maximum).toBe(100);
    });

    it('matches components.schemas properties with Zod schemas shape', () => {
      const dto = spec.components.schemas['ResolutionDto'];
      expect(Object.keys(dto.properties).sort()).toEqual(
        Object.keys(resolutionDtoSchema.shape).sort(),
      );
      expect([...dto.required].sort()).toEqual(Object.keys(resolutionDtoSchema.shape).sort());
      expect(dto.additionalProperties).toBe(false);
      expect(dto.properties.pdfFileId.type).toEqual(['string', 'null']);
      expect(dto.properties.catalogVersionId.type).toEqual(['string', 'null']);
      expect(dto.properties.approvedAt.type).toEqual(['string', 'null']);
      expect(dto.properties.approvedBy.type).toEqual(['string', 'null']);
      expect(dto.properties.status.enum).toEqual(['REGISTERED', 'APPROVED']);

      const request = spec.components.schemas['RegisterResolutionRequest'];
      expect(Object.keys(request.properties).sort()).toEqual(
        Object.keys(registerResolutionRequestSchema.shape).sort(),
      );
      expect(request.additionalProperties).toBe(false);
      expect(request.properties.number.maxLength).toBe(40);

      const list = spec.components.schemas['ListResolutionsResponse'];
      expect(Object.keys(list.properties).sort()).toEqual(
        Object.keys(listResolutionsResponseSchema.shape).sort(),
      );
    });

    it('has bidirectional parity between openapi spec and createResolutionsRouter', () => {
      const router = createResolutionsRouter({
        controller: {
          registerResolution: vi.fn(),
          approveResolution: vi.fn(),
          listResolutions: vi.fn(),
        } as unknown as ResolutionsController,
        authenticate: vi.fn(),
        requirePermission: vi.fn(() => vi.fn()),
      });

      const routerEndpoints: string[] = [];
      for (const layer of router.stack) {
        if (layer.route) {
          for (const method of Object.keys(layer.route.methods)) {
            const normalizedPath =
              '/resolutions' + (layer.route.path === '/' ? '' : layer.route.path);
            routerEndpoints.push(method.toLowerCase() + ' ' + normalizedPath);
          }
        }
      }

      expect(routerEndpoints.sort()).toEqual([
        'get /resolutions',
        'post /resolutions',
        'post /resolutions/:id/approve',
      ]);
    });
  });

  describe('OpenAPI Specification for Templates (HU-018, T-018-17, RF-018, RNF-032)', () => {
    it('documents the four operations with bearerAuth and proper status codes', () => {
      const expectations: [string, string, string, string[]][] = [
        ['/templates', 'get', 'listTemplates', ['200', '400', '401', '403']],
        ['/templates/{id}', 'get', 'getTemplate', ['200', '400', '401', '403', '404']],
        [
          '/templates/{id}/draft',
          'put',
          'saveTemplateDraft',
          ['200', '201', '400', '401', '403', '404', '409'],
        ],
        [
          '/templates/{id}/publish',
          'post',
          'publishTemplate',
          ['200', '400', '401', '403', '404', '409'],
        ],
        [
          '/templates/{id}/preview',
          'post',
          'previewTemplate',
          ['200', '400', '401', '403', '404', '409'],
        ],
      ];
      for (const [route, method, operationId, codes] of expectations) {
        const op = spec.paths[route][method];
        expect(op.operationId).toBe(operationId);
        expect(op.tags).toContain('Templates');
        expect(op.security).toEqual([{ bearerAuth: [] }]);
        expect(Object.keys(op.responses).sort()).toEqual(codes);
        const success = op.responses[codes[0] as string];
        expect(success.headers['Cache-Control'].example).toBe('no-store');
      }
    });

    it('validates the request and response examples against the shared schemas', () => {
      const list =
        spec.paths['/templates'].get.responses['200'].content['application/json'].example;
      expect(listTemplatesResponseSchema.safeParse(list).success).toBe(true);
      expect(list.items[0].draft).not.toBeNull();
      expect(list.items[1].draft).toBeNull();

      const detail =
        spec.paths['/templates/{id}'].get.responses['200'].content['application/json'].example;
      expect(templateDetailDtoSchema.safeParse(detail).success).toBe(true);

      const put = spec.paths['/templates/{id}/draft'].put;
      expect(
        saveTemplateDraftRequestSchema.safeParse(
          put.requestBody.content['application/json'].example,
        ).success,
      ).toBe(true);
      for (const code of ['200', '201']) {
        const draft = put.responses[code].content['application/json'].example;
        expect(templateVersionDtoSchema.safeParse(draft).success).toBe(true);
        expect(draft.status).toBe('DRAFT');
        expect(draft.publishedAt).toBeNull();
      }

      const post = spec.paths['/templates/{id}/publish'].post;
      expect(
        publishTemplateRequestSchema.safeParse(post.requestBody.content['application/json'].example)
          .success,
      ).toBe(true);
      const published = post.responses['200'].content['application/json'].example;
      expect(templateVersionDtoSchema.safeParse(published).success).toBe(true);
      expect(published.status).toBe('PUBLISHED');
      expect(published.publishedAt).not.toBeNull();

      const preview = spec.paths['/templates/{id}/preview'].post;
      expect(
        previewTemplateRequestSchema.safeParse(
          preview.requestBody.content['application/json'].example,
        ).success,
      ).toBe(true);
      expect(
        previewTemplateResponseSchema.safeParse(
          preview.responses['200'].content['application/json'].example,
        ).success,
      ).toBe(true);
    });

    it('documents the id parameter, the list filters and the pagination limits', () => {
      for (const [route, method] of [
        ['/templates/{id}', 'get'],
        ['/templates/{id}/draft', 'put'],
        ['/templates/{id}/publish', 'post'],
        ['/templates/{id}/preview', 'post'],
      ] as const) {
        expect(spec.paths[route][method].parameters[0]).toMatchObject({
          name: 'id',
          in: 'path',
          required: true,
          schema: { maxLength: 64 },
        });
      }
      const params = spec.paths['/templates'].get.parameters;
      expect(params.map((param: { name: string }) => param.name).sort()).toEqual([
        'page',
        'pageSize',
        'type',
      ]);
      const pageSize = params.find((param: { name: string }) => param.name === 'pageSize');
      expect(pageSize.schema).toMatchObject({ maximum: 100, default: 50 });
      const type = params.find((param: { name: string }) => param.name === 'type');
      expect(type.schema.enum).toEqual(['ANNEX', 'MINUTES', 'SURVEY', 'INSTRUMENT']);
    });

    it('matches components.schemas properties with the Zod schemas shape', () => {
      const pairs: [string, { shape: Record<string, unknown> }][] = [
        ['TemplateVariable', templateVariableSchema],
        ['TemplateVersionSummaryDto', templateVersionSummaryDtoSchema],
        ['TemplateVersionDto', templateVersionDtoSchema],
        ['TemplateSummaryDto', templateSummaryDtoSchema],
        ['TemplateDetailDto', templateDetailDtoSchema],
        ['ListTemplatesResponse', listTemplatesResponseSchema],
        ['SaveTemplateDraftRequest', saveTemplateDraftRequestSchema],
        ['PublishTemplateRequest', publishTemplateRequestSchema],
        ['PreviewTemplateRequest', previewTemplateRequestSchema],
        ['TemplatePreviewWarning', templatePreviewWarningSchema],
        ['PreviewTemplateResponse', previewTemplateResponseSchema],
      ];
      for (const [name, zodSchema] of pairs) {
        const schema = spec.components.schemas[name];
        const keys = Object.keys(zodSchema.shape).sort();
        expect(Object.keys(schema.properties).sort(), name).toEqual(keys);
        expect([...schema.required].sort(), name).toEqual(keys);
        expect(schema.additionalProperties, name).toBe(false);
      }
      const version = spec.components.schemas['TemplateVersionSummaryDto'];
      expect(version.properties.publishedAt.type).toEqual(['string', 'null']);
      expect(version.properties.status.enum).toEqual(['DRAFT', 'PUBLISHED', 'OBSOLETE']);
      expect(spec.components.schemas['SaveTemplateDraftRequest'].properties.content.maxLength).toBe(
        40000,
      );
      const summary = spec.components.schemas['TemplateSummaryDto'];
      expect(summary.properties.published.oneOf).toContainEqual({ type: 'null' });
      expect(summary.properties.draft.oneOf).toContainEqual({ type: 'null' });
    });

    it('has bidirectional parity between openapi spec and createTemplatesRouter', () => {
      const router = createTemplatesRouter({
        controller: {
          listTemplates: vi.fn(),
          getTemplate: vi.fn(),
          saveDraft: vi.fn(),
          publishTemplate: vi.fn(),
          previewTemplate: vi.fn(),
        } as unknown as TemplatesController,
        authenticate: vi.fn(),
        requirePermission: vi.fn(() => vi.fn()),
      });

      const routerEndpoints: string[] = [];
      for (const layer of router.stack) {
        if (layer.route) {
          for (const method of Object.keys(layer.route.methods)) {
            const normalizedPath =
              '/templates' + (layer.route.path === '/' ? '' : layer.route.path);
            routerEndpoints.push(method.toLowerCase() + ' ' + normalizedPath);
          }
        }
      }

      expect(routerEndpoints.sort()).toEqual([
        'get /templates',
        'get /templates/:id',
        'post /templates/:id/preview',
        'post /templates/:id/publish',
        'put /templates/:id/draft',
      ]);
    });
  });

  describe('OpenAPI Specification for Stakeholders (HU-021, T-021-15, RF-021, RNF-032)', () => {
    it('documents the four operations with bearerAuth and proper status codes', () => {
      const operations = [
        {
          path: '/stakeholders',
          method: 'get',
          id: 'listStakeholders',
          codes: ['200', '400', '401', '403'],
        },
        {
          path: '/stakeholders',
          method: 'post',
          id: 'registerStakeholder',
          codes: ['201', '400', '401', '403', '409'],
        },
        {
          path: '/stakeholders/{id}',
          method: 'patch',
          id: 'editStakeholder',
          codes: ['200', '400', '401', '403', '404', '409'],
        },
        {
          path: '/stakeholders/{id}/void',
          method: 'post',
          id: 'voidStakeholder',
          codes: ['200', '400', '401', '403', '404', '409'],
        },
      ] as const;

      for (const expected of operations) {
        const op = spec.paths[expected.path]?.[expected.method];
        expect(op, `${expected.method} ${expected.path}`).toBeDefined();
        expect(op.operationId).toBe(expected.id);
        expect(op.tags).toEqual(['Stakeholders']);
        expect(op.security).toEqual([{ bearerAuth: [] }]);
        expect(Object.keys(op.responses).sort()).toEqual([...expected.codes]);
        const successCode = expected.codes[0];
        expect(op.responses[successCode].headers['Cache-Control'].example).toBe('no-store');
      }
    });

    it('validates the request and response examples against the shared schemas', () => {
      const listExample =
        spec.paths['/stakeholders'].get.responses['200'].content['application/json'].example;
      expect(listStakeholdersResponseSchema.safeParse(listExample).success).toBe(true);

      const postOp = spec.paths['/stakeholders'].post;
      expect(
        registerStakeholderRequestSchema.safeParse(
          postOp.requestBody.content['application/json'].example,
        ).success,
      ).toBe(true);
      expect(
        stakeholderDtoSchema.safeParse(postOp.responses['201'].content['application/json'].example)
          .success,
      ).toBe(true);

      const patchOp = spec.paths['/stakeholders/{id}'].patch;
      expect(
        editStakeholderRequestSchema.safeParse(
          patchOp.requestBody.content['application/json'].example,
        ).success,
      ).toBe(true);
      expect(
        stakeholderDtoSchema.safeParse(patchOp.responses['200'].content['application/json'].example)
          .success,
      ).toBe(true);

      const voidOp = spec.paths['/stakeholders/{id}/void'].post;
      expect(
        voidStakeholderRequestSchema.safeParse(
          voidOp.requestBody.content['application/json'].example,
        ).success,
      ).toBe(true);
      expect(
        stakeholderDtoSchema.safeParse(voidOp.responses['200'].content['application/json'].example)
          .success,
      ).toBe(true);

      const pairs: [string, { shape: Record<string, unknown> }][] = [
        ['StakeholderDto', stakeholderDtoSchema],
        ['EditStakeholderRequest', editStakeholderRequestSchema],
        ['VoidStakeholderRequest', voidStakeholderRequestSchema],
        ['ListStakeholdersResponse', listStakeholdersResponseSchema],
      ];
      for (const [name, zodSchema] of pairs) {
        const schema = spec.components.schemas[name];
        expect(Object.keys(schema.properties).sort(), name).toEqual(
          Object.keys(zodSchema.shape).sort(),
        );
        expect(schema.additionalProperties, name).toBe(false);
      }
      expect(spec.components.schemas.RegisterStakeholderRequest.discriminator.propertyName).toBe(
        'kind',
      );
    });

    it('documents no delete operation', () => {
      expect(spec.paths['/stakeholders']?.delete).toBeUndefined();
      expect(spec.paths['/stakeholders/{id}']?.delete).toBeUndefined();
      expect(spec.paths['/stakeholders/{id}/void']?.delete).toBeUndefined();
    });

    it('has bidirectional parity between openapi spec and createStakeholdersRouter', () => {
      const router = createStakeholdersRouter({
        controller: {
          registerStakeholder: vi.fn(),
          editStakeholder: vi.fn(),
          voidStakeholder: vi.fn(),
          listStakeholders: vi.fn(),
        } as unknown as StakeholdersController,
        authenticate: vi.fn(),
        requirePermission: vi.fn(() => vi.fn()),
      });

      const routerEndpoints: string[] = [];
      for (const layer of router.stack) {
        if (layer.route) {
          for (const method of Object.keys(layer.route.methods)) {
            const normalizedPath = (
              '/stakeholders' + (layer.route.path === '/' ? '' : layer.route.path)
            ).replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
            routerEndpoints.push(`${method.toLowerCase()} ${normalizedPath}`);
          }
        }
      }

      expect(routerEndpoints.sort()).toEqual([
        'get /stakeholders',
        'patch /stakeholders/{id}',
        'post /stakeholders',
        'post /stakeholders/{id}/void',
      ]);

      for (const endpoint of routerEndpoints) {
        const [method, routePath] = endpoint.split(' ');
        expect(spec.paths[routePath!]?.[method!], endpoint).toBeDefined();
      }
    });
  });

  describe('OpenAPI Specification for Stakeholder Lists (HU-022, T-022-14, RF-022, RNF-032)', () => {
    it('documents the four operations with bearerAuth and proper status codes', () => {
      const operations = [
        {
          path: '/stakeholder-lists',
          method: 'get',
          id: 'listStakeholderLists',
          codes: ['200', '400', '401', '403'],
        },
        {
          path: '/stakeholder-lists',
          method: 'post',
          id: 'createStakeholderList',
          codes: ['201', '400', '401', '403', '409'],
        },
        {
          path: '/stakeholder-lists/{id}/members',
          method: 'post',
          id: 'addStakeholderListMember',
          codes: ['201', '400', '401', '403', '404', '409'],
        },
        {
          path: '/stakeholder-lists/{id}/copy',
          method: 'post',
          id: 'copyStakeholderList',
          codes: ['201', '400', '401', '403', '404', '409'],
        },
      ] as const;

      for (const expected of operations) {
        const op = spec.paths[expected.path]?.[expected.method];
        expect(op, `${expected.method} ${expected.path}`).toBeDefined();
        expect(op.operationId).toBe(expected.id);
        expect(op.tags).toEqual(['StakeholderLists']);
        expect(op.security).toEqual([{ bearerAuth: [] }]);
        expect(Object.keys(op.responses).sort()).toEqual([...expected.codes]);
        const successCode = expected.codes[0];
        expect(op.responses[successCode].headers['Cache-Control'].example).toBe('no-store');
      }
    });

    it('keeps component schemas and examples aligned with shared Zod schemas', () => {
      const createOp = spec.paths['/stakeholder-lists'].post;
      expect(
        createStakeholderListRequestSchema.safeParse(
          createOp.requestBody.content['application/json'].example,
        ).success,
      ).toBe(true);

      const addOp = spec.paths['/stakeholder-lists/{id}/members'].post;
      expect(
        addStakeholderListMemberRequestSchema.safeParse(
          addOp.requestBody.content['application/json'].example,
        ).success,
      ).toBe(true);

      const copyOp = spec.paths['/stakeholder-lists/{id}/copy'].post;
      expect(
        copyStakeholderListRequestSchema.safeParse(
          copyOp.requestBody.content['application/json'].example,
        ).success,
      ).toBe(true);

      const pairs: Array<[string, { shape: Record<string, unknown> }]> = [
        ['StakeholderListDto', stakeholderListDtoSchema],
        ['StakeholderListMemberDto', stakeholderListMemberDtoSchema],
        ['CreateStakeholderListRequest', createStakeholderListRequestSchema],
        ['AddStakeholderListMemberRequest', addStakeholderListMemberRequestSchema],
        ['CopyStakeholderListRequest', copyStakeholderListRequestSchema],
        ['ListStakeholderListsResponse', listStakeholderListsResponseSchema],
        ['CopyStakeholderListResponse', copyStakeholderListResponseSchema],
      ];
      for (const [name, zodSchema] of pairs) {
        const schema = spec.components.schemas[name];
        expect(Object.keys(schema.properties).sort(), name).toEqual(
          Object.keys(zodSchema.shape).sort(),
        );
      }
    });

    it('has no delete operation for stakeholder lists', () => {
      expect(spec.paths['/stakeholder-lists']?.delete).toBeUndefined();
      expect(spec.paths['/stakeholder-lists/{id}/members']?.delete).toBeUndefined();
      expect(spec.paths['/stakeholder-lists/{id}/copy']?.delete).toBeUndefined();
    });

    it('has bidirectional parity between openapi spec and createStakeholderListsRouter', () => {
      const router = createStakeholderListsRouter({
        controller: {
          createStakeholderList: vi.fn(),
          addStakeholderListMember: vi.fn(),
          copyStakeholderList: vi.fn(),
          listStakeholderLists: vi.fn(),
          previewStakeholderImport: vi.fn(),
        } as unknown as StakeholderListsController,
        authenticate: vi.fn(),
        requirePermission: vi.fn(() => vi.fn()),
      });

      const routerEndpoints: string[] = [];
      for (const layer of router.stack) {
        if (layer.route) {
          for (const method of Object.keys(layer.route.methods)) {
            const normalizedPath = (
              '/stakeholder-lists' + (layer.route.path === '/' ? '' : layer.route.path)
            ).replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
            routerEndpoints.push(`${method.toLowerCase()} ${normalizedPath}`);
          }
        }
      }

      expect(routerEndpoints.sort()).toEqual([
        'get /stakeholder-lists',
        'post /stakeholder-lists',
        'post /stakeholder-lists/{id}/copy',
        'post /stakeholder-lists/{id}/import/preview',
        'post /stakeholder-lists/{id}/members',
      ]);

      for (const endpoint of routerEndpoints) {
        const [method, routePath] = endpoint.split(' ');
        expect(spec.paths[routePath!]?.[method!], endpoint).toBeDefined();
      }
    });
  });
});
