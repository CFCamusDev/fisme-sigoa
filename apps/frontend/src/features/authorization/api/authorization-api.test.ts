import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import type {
  CreateRoleRequest,
  ListPermissionsResponse,
  ListRolesResponse,
  RoleDto,
  UpdateRolePermissionsRequest,
  UpdateRoleRequest,
  UserAccessDto,
} from '@sigoa/shared';
import {
  changeRoleStatus,
  createRole,
  listPermissions,
  listRoles,
  updateRole,
  updateRolePermissions,
  getUserAccess,
  assignUserRoles,
  assignUserPermissions,
  getMyPermissions,
} from './index';

const mockRoleDto: RoleDto = {
  id: 'role-cuid-123',
  code: 'AUDITOR_CALIDAD',
  name: 'Auditor de Calidad',
  description: 'Auditor funcional',
  isPredefined: false,
  status: 'ACTIVE',
  deactivatedAt: null,
  userCount: 0,
  permissions: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }],
  updatedAt: '2026-11-06T15:00:00.000Z',
};

const mockListRolesResponse: ListRolesResponse = {
  items: [mockRoleDto],
};

const mockListPermissionsResponse: ListPermissionsResponse = {
  items: [
    {
      code: 'rol.ver',
      description: 'Ver roles y permisos',
      module: 'ROLES',
    },
  ],
};

describe('Authorization API client functions (HU-006, T-006-20)', () => {
  describe('listRoles', () => {
    it('requests GET /roles and returns parsed data', async () => {
      server.use(
        http.get('http://localhost:3000/roles', () => {
          return HttpResponse.json(mockListRolesResponse, { status: 200 });
        }),
      );

      const result = await listRoles();
      expect(result).toEqual(mockListRolesResponse);
    });

    it('rejects a malformed server response', async () => {
      server.use(
        http.get('http://localhost:3000/roles', () => {
          return HttpResponse.json({ items: [{ invalid: 'data' }] }, { status: 200 });
        }),
      );

      await expect(listRoles()).rejects.toThrow();
    });
  });

  describe('listPermissions', () => {
    it('requests GET /permissions and returns parsed data', async () => {
      server.use(
        http.get('http://localhost:3000/permissions', () => {
          return HttpResponse.json(mockListPermissionsResponse, { status: 200 });
        }),
      );

      const result = await listPermissions();
      expect(result).toEqual(mockListPermissionsResponse);
    });
  });

  describe('createRole', () => {
    it('validates request before sending and calls POST /roles', async () => {
      let capturedBody: unknown = null;

      server.use(
        http.post('http://localhost:3000/roles', async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json(mockRoleDto, { status: 201 });
        }),
      );

      const payload: CreateRoleRequest = {
        name: 'Nuevo Rol',
        description: 'Descripción válida',
        permissions: [],
      };

      const result = await createRole(payload);
      expect(result).toEqual(mockRoleDto);
      expect(capturedBody).toEqual(payload);
    });

    it('validates and rejects invalid payload before sending', async () => {
      const invalidPayload = {
        name: 'AB', // muy corto (< 3)
      } as CreateRoleRequest;

      await expect(createRole(invalidPayload)).rejects.toThrow();
    });
  });

  describe('updateRole', () => {
    it('encodes id and calls PATCH /roles/:id with validated body', async () => {
      let capturedUrl = '';
      let capturedBody: unknown = null;

      server.use(
        http.patch('http://localhost:3000/roles/:id', async ({ request }) => {
          capturedUrl = request.url;
          capturedBody = await request.json();
          return HttpResponse.json(mockRoleDto, { status: 200 });
        }),
      );

      const body: UpdateRoleRequest = {
        name: 'Nombre Actualizado',
        description: 'Nueva descripción',
      };

      const result = await updateRole({ id: 'role/with/special/chars', body });
      expect(result).toEqual(mockRoleDto);
      expect(capturedUrl).toContain('/roles/role%2Fwith%2Fspecial%2Fchars');
      expect(capturedBody).toEqual(body);
    });
  });

  describe('changeRoleStatus', () => {
    it('encodes id and calls PATCH /roles/:id/status with validated body', async () => {
      let capturedUrl = '';
      let capturedBody: unknown = null;

      server.use(
        http.patch('http://localhost:3000/roles/:id/status', async ({ request }) => {
          capturedUrl = request.url;
          capturedBody = await request.json();
          return HttpResponse.json(mockRoleDto, { status: 200 });
        }),
      );

      const result = await changeRoleStatus({
        id: 'role-123',
        body: { status: 'INACTIVE', confirmed: true },
      });

      expect(result).toEqual(mockRoleDto);
      expect(capturedUrl).toContain('/roles/role-123/status');
      expect(capturedBody).toEqual({ status: 'INACTIVE', confirmed: true });
    });
  });

  describe('updateRolePermissions', () => {
    it('encodes id and calls PUT /roles/:id/permissions with validated body', async () => {
      let capturedUrl = '';
      let capturedBody: unknown = null;

      server.use(
        http.put('http://localhost:3000/roles/:id/permissions', async ({ request }) => {
          capturedUrl = request.url;
          capturedBody = await request.json();
          return HttpResponse.json(mockRoleDto, { status: 200 });
        }),
      );

      const body: UpdateRolePermissionsRequest = {
        permissions: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }],
      };

      const result = await updateRolePermissions({ id: 'role-123', body });
      expect(result).toEqual(mockRoleDto);
      expect(capturedUrl).toContain('/roles/role-123/permissions');
      expect(capturedBody).toEqual(body);
    });
  });

  describe('User Access API functions (HU-007, T-007-15)', () => {
    const mockUserAccessDto: UserAccessDto = {
      userId: 'usr-123',
      roles: [
        {
          id: 'role-cuid-123',
          code: 'AUDITOR_CALIDAD',
          name: 'Auditor de Calidad',
          status: 'ACTIVE',
        },
      ],
      directPermissions: [
        {
          permissionCode: 'academico.editar',
          scope: 'GLOBAL',
        },
      ],
      effectivePermissions: [
        {
          permissionCode: 'academico.editar',
          scope: 'GLOBAL',
          sources: [{ kind: 'DIRECT', scope: 'GLOBAL' }],
        },
      ],
    };

    describe('getUserAccess', () => {
      it('requests GET /users/:id/effective-permissions and returns parsed UserAccessDto', async () => {
        let capturedUrl = '';
        server.use(
          http.get('http://localhost:3000/users/:id/effective-permissions', ({ request }) => {
            capturedUrl = request.url;
            return HttpResponse.json(mockUserAccessDto, { status: 200 });
          }),
        );

        const result = await getUserAccess('usr-123');
        expect(result).toEqual(mockUserAccessDto);
        expect(capturedUrl).toContain('/users/usr-123/effective-permissions');
      });

      it('encodes the user id in the path', async () => {
        let capturedUrl = '';
        server.use(
          http.get('http://localhost:3000/users/:id/effective-permissions', ({ request }) => {
            capturedUrl = request.url;
            return HttpResponse.json(mockUserAccessDto, { status: 200 });
          }),
        );

        await getUserAccess('user/special+id');
        expect(capturedUrl).toContain('/users/user%2Fspecial%2Bid/effective-permissions');
      });

      it('rejects when server response does not match userAccessSchema', async () => {
        server.use(
          http.get('http://localhost:3000/users/:id/effective-permissions', () => {
            return HttpResponse.json({ userId: 123, invalidField: true }, { status: 200 });
          }),
        );

        await expect(getUserAccess('usr-123')).rejects.toThrow();
      });
    });

    describe('assignUserRoles', () => {
      it('validates request before sending and calls PUT /users/:id/roles', async () => {
        let capturedUrl = '';
        let capturedBody: unknown = null;
        server.use(
          http.put('http://localhost:3000/users/:id/roles', async ({ request }) => {
            capturedUrl = request.url;
            capturedBody = await request.json();
            return HttpResponse.json(mockUserAccessDto, { status: 200 });
          }),
        );

        const result = await assignUserRoles({
          userId: 'usr-123',
          body: { roleIds: ['role-cuid-123'] },
        });

        expect(result).toEqual(mockUserAccessDto);
        expect(capturedUrl).toContain('/users/usr-123/roles');
        expect(capturedBody).toEqual({ roleIds: ['role-cuid-123'] });
      });

      it('encodes user id in assignUserRoles path', async () => {
        let capturedUrl = '';
        server.use(
          http.put('http://localhost:3000/users/:id/roles', ({ request }) => {
            capturedUrl = request.url;
            return HttpResponse.json(mockUserAccessDto, { status: 200 });
          }),
        );

        await assignUserRoles({
          userId: 'user/special#1',
          body: { roleIds: ['role-1'] },
        });
        expect(capturedUrl).toContain('/users/user%2Fspecial%231/roles');
      });

      it('rejects a body outside shared limits (e.g. empty roleIds) before network call', async () => {
        let networkCalled = false;
        server.use(
          http.put('http://localhost:3000/users/:id/roles', () => {
            networkCalled = true;
            return HttpResponse.json(mockUserAccessDto, { status: 200 });
          }),
        );

        await expect(
          assignUserRoles({
            userId: 'usr-123',
            body: { roleIds: [] },
          }),
        ).rejects.toThrow();
        expect(networkCalled).toBe(false);
      });

      it('rejects when server response does not match userAccessSchema', async () => {
        server.use(
          http.put('http://localhost:3000/users/:id/roles', () => {
            return HttpResponse.json({ malformed: 'response' }, { status: 200 });
          }),
        );

        await expect(
          assignUserRoles({
            userId: 'usr-123',
            body: { roleIds: ['role-1'] },
          }),
        ).rejects.toThrow();
      });
    });

    describe('assignUserPermissions', () => {
      it('validates request before sending and calls PUT /users/:id/permissions', async () => {
        let capturedUrl = '';
        let capturedBody: unknown = null;
        server.use(
          http.put('http://localhost:3000/users/:id/permissions', async ({ request }) => {
            capturedUrl = request.url;
            capturedBody = await request.json();
            return HttpResponse.json(mockUserAccessDto, { status: 200 });
          }),
        );

        const body = {
          permissions: [{ permissionCode: 'academico.editar', scope: 'GLOBAL' as const }],
        };

        const result = await assignUserPermissions({
          userId: 'usr-123',
          body,
        });

        expect(result).toEqual(mockUserAccessDto);
        expect(capturedUrl).toContain('/users/usr-123/permissions');
        expect(capturedBody).toEqual(body);
      });

      it('encodes user id in assignUserPermissions path', async () => {
        let capturedUrl = '';
        server.use(
          http.put('http://localhost:3000/users/:id/permissions', ({ request }) => {
            capturedUrl = request.url;
            return HttpResponse.json(mockUserAccessDto, { status: 200 });
          }),
        );

        await assignUserPermissions({
          userId: 'user/special#2',
          body: { permissions: [] },
        });
        expect(capturedUrl).toContain('/users/user%2Fspecial%232/permissions');
      });

      it('rejects duplicate permissions before network call', async () => {
        let networkCalled = false;
        server.use(
          http.put('http://localhost:3000/users/:id/permissions', () => {
            networkCalled = true;
            return HttpResponse.json(mockUserAccessDto, { status: 200 });
          }),
        );

        await expect(
          assignUserPermissions({
            userId: 'usr-123',
            body: {
              permissions: [
                { permissionCode: 'academico.editar', scope: 'GLOBAL' },
                { permissionCode: 'academico.editar', scope: 'OWN' },
              ],
            },
          }),
        ).rejects.toThrow();
        expect(networkCalled).toBe(false);
      });

      it('rejects when server response does not match userAccessSchema', async () => {
        server.use(
          http.put('http://localhost:3000/users/:id/permissions', () => {
            return HttpResponse.json({ not: 'valid' }, { status: 200 });
          }),
        );

        await expect(
          assignUserPermissions({
            userId: 'usr-123',
            body: { permissions: [] },
          }),
        ).rejects.toThrow();
      });
    });
  });

  describe('error handling', () => {
    it('propagates api errors with status and message', async () => {
      server.use(
        http.get('http://localhost:3000/roles', () => {
          return HttpResponse.json(
            {
              error: {
                code: 'FORBIDDEN',
                message: 'No tienes permiso para ver los roles.',
                requestId: 'req-123',
              },
            },
            { status: 403 },
          );
        }),
      );

      await expect(listRoles()).rejects.toMatchObject({
        status: 403,
        message: 'No tienes permiso para ver los roles.',
      });
    });
  });

  describe('getMyPermissions (HU-008, T-008-04)', () => {
    it('requests GET /me/permissions and validates response with myPermissionsResponseSchema', async () => {
      server.use(
        http.get('http://localhost:3000/me/permissions', () => {
          return HttpResponse.json(
            {
              permissions: [
                { code: 'medicion.ver', scope: 'OWN' },
                { code: 'usuario.ver', scope: 'GLOBAL' },
              ],
            },
            { status: 200 },
          );
        }),
      );

      const result = await getMyPermissions();
      expect(result).toEqual({
        permissions: [
          { code: 'medicion.ver', scope: 'OWN' },
          { code: 'usuario.ver', scope: 'GLOBAL' },
        ],
      });
    });

    it('rejects when GET /me/permissions returns unexpected fields', async () => {
      server.use(
        http.get('http://localhost:3000/me/permissions', () => {
          return HttpResponse.json(
            {
              permissions: [{ code: 'usuario.ver', scope: 'GLOBAL', extra: true }],
            },
            { status: 200 },
          );
        }),
      );

      await expect(getMyPermissions()).rejects.toThrow();
    });
  });
});
