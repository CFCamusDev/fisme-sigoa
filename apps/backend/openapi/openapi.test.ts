import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  activateAccountRequestSchema,
  activateAccountResponseSchema,
  apiErrorResponseSchema,
  changeUserStatusRequestSchema,
  createUserRequestSchema,
  errorCodeSchema,
  listRolesResponseSchema,
  listUsersResponseSchema,
  loginRequestSchema,
  loginResponseSchema,
  refreshResponseSchema,
  roleSummarySchema,
  updateUserRequestSchema,
  userDtoSchema,
} from '@sigoa/shared';
import { createAuthRouter } from '../src/modules/auth/infrastructure/http/auth.routes.js';
import { createUsersRouter } from '../src/modules/users/infrastructure/http/users.routes.js';
import type { UsersController } from '../src/modules/users/infrastructure/http/users.controller.js';
import { createRolesRouter } from '../src/modules/authorization/infrastructure/http/roles.routes.js';
import type { RolesController } from '../src/modules/authorization/infrastructure/http/roles.controller.js';

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

  describe('OpenAPI Specification for Roles (HU-003, T-003-15, A2, A4)', () => {
    const rolePaths = ['/roles'];

    it('documents GET /roles endpoint with bearer security and Roles tag', () => {
      expect(spec.paths['/roles']).toBeDefined();
      expect(spec.paths['/roles'].get).toBeDefined();

      const op = spec.paths['/roles'].get;
      expect(op.tags).toContain('Roles');
      expect(op.security).toEqual([{ bearerAuth: [] }]);
      expect(op.operationId).toBe('listRoles');
      expect(op.description).toContain('rol.ver');
    });

    it('documents RoleSummary and ListRolesResponse components', () => {
      expect(spec.components.schemas.RoleSummary).toBeDefined();
      expect(spec.components.schemas.ListRolesResponse).toBeDefined();

      const roleSummary = spec.components.schemas.RoleSummary;
      expect(roleSummary.properties.id).toBeDefined();
      expect(roleSummary.properties.code).toBeDefined();
      expect(roleSummary.properties.name).toBeDefined();
      expect(roleSummary.properties.description).toBeDefined();
      expect(roleSummary.properties.isPredefined).toBeDefined();
    });

    it('keeps GET /roles response example valid against listRolesResponseSchema', () => {
      const getRolesRes =
        spec.paths['/roles'].get.responses['200'].content['application/json'].example;
      expect(listRolesResponseSchema.safeParse(getRolesRes).success).toBe(true);
      expect(spec.paths['/roles'].get.responses['200'].headers['Cache-Control']).toBeDefined();

      for (const item of getRolesRes.items) {
        expect(roleSummarySchema.safeParse(item).success).toBe(true);
      }
    });

    it('documents 401 and 403 error responses with the shared error contract', () => {
      const op = spec.paths['/roles'].get;
      expect(op.responses['401']).toBeDefined();
      expect(op.responses['403']).toBeDefined();

      const err401 = op.responses['401'].content['application/json'].example;
      expect(apiErrorResponseSchema.safeParse(err401).success).toBe(true);

      const err403 = op.responses['403'].content['application/json'].example;
      expect(apiErrorResponseSchema.safeParse(err403).success).toBe(true);
    });

    it('documents every route of the roles router and nothing else (guard against drift, A4)', () => {
      const dummyController = {
        list: () => {},
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

      expect(routerEndpoints.length).toBe(1);

      for (const endpoint of routerEndpoints) {
        const specPath = spec.paths[endpoint.path];
        expect(specPath, `Path ${endpoint.path} must exist in openapi.json`).toBeDefined();
        expect(
          specPath[endpoint.method],
          `Method ${endpoint.method.toUpperCase()} ${endpoint.path} must exist in openapi.json`,
        ).toBeDefined();
      }

      for (const pathKey of rolePaths) {
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

      // Debe haber exactamente 4 rutas: /auth/login, /auth/refresh, /auth/logout, /auth/activate
      expect(routerEndpoints.length).toBe(4);

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
});
