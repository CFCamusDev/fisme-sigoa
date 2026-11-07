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
} from '@sigoa/shared';
import {
  changeRoleStatus,
  createRole,
  listPermissions,
  listRoles,
  updateRole,
  updateRolePermissions,
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
});
