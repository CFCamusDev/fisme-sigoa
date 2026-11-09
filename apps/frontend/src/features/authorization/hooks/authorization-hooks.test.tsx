import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, type ReactNode } from 'react';
import { server } from '@/test/msw/server';
import type {
  ListPermissionsResponse,
  ListRolesResponse,
  RoleDto,
  UserAccessDto,
} from '@sigoa/shared';
import {
  useChangeRoleStatus,
  useCreateRole,
  usePermissions,
  useRoles,
  useUpdateRole,
  useUpdateRolePermissions,
  useUserAccess,
  useAssignUserRoles,
  useAssignUserPermissions,
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

function createWrapper(
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  }),
) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('Authorization hooks (HU-006, T-006-20)', () => {
  describe('useRoles', () => {
    it('fetches roles and caches data with 5 minutes staleTime', async () => {
      server.use(
        http.get('http://localhost:3000/roles', () => {
          return HttpResponse.json(mockListRolesResponse, { status: 200 });
        }),
      );

      const queryClient = new QueryClient();
      const { result } = renderHook(() => useRoles(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockListRolesResponse);
      expect(result.current.isStale).toBe(false);

      const query = queryClient.getQueryCache().find({ queryKey: ['roles'] });
      expect((query?.options as { staleTime?: number })?.staleTime).toBe(5 * 60 * 1000);
    });

    it('issues a single request under StrictMode', async () => {
      let requestCount = 0;
      server.use(
        http.get('http://localhost:3000/roles', () => {
          requestCount++;
          return HttpResponse.json(mockListRolesResponse, { status: 200 });
        }),
      );

      const queryClient = new QueryClient();
      function StrictWrapper({ children }: { children: ReactNode }) {
        return (
          <StrictMode>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          </StrictMode>
        );
      }

      const { result } = renderHook(() => useRoles(), {
        wrapper: StrictWrapper,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(requestCount).toBe(1);
    });
  });

  describe('usePermissions', () => {
    it('caches the catalog with 30 minutes staleTime', async () => {
      server.use(
        http.get('http://localhost:3000/permissions', () => {
          return HttpResponse.json(mockListPermissionsResponse, { status: 200 });
        }),
      );

      const queryClient = new QueryClient();
      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockListPermissionsResponse);
      expect(result.current.isStale).toBe(false);

      const query = queryClient.getQueryCache().find({ queryKey: ['permissions'] });
      expect((query?.options as { staleTime?: number })?.staleTime).toBe(30 * 60 * 1000);
    });
  });

  describe('mutations do not retry and invalidate roles query on success', () => {
    it('useCreateRole does not retry and invalidates roles query', async () => {
      server.use(
        http.post('http://localhost:3000/roles', () => {
          return HttpResponse.json(mockRoleDto, { status: 201 });
        }),
      );

      const queryClient = new QueryClient();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useCreateRole(), {
        wrapper: createWrapper(queryClient),
      });

      result.current.mutate({
        name: 'Nuevo Rol',
        description: null,
        permissions: [],
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['roles'] });
    });

    it('useUpdateRole does not retry and invalidates roles query', async () => {
      server.use(
        http.patch('http://localhost:3000/roles/:id', () => {
          return HttpResponse.json(mockRoleDto, { status: 200 });
        }),
      );

      const queryClient = new QueryClient();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useUpdateRole(), {
        wrapper: createWrapper(queryClient),
      });

      result.current.mutate({ id: 'role-123', body: { name: 'Editado' } });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['roles'] });
    });

    it('useChangeRoleStatus does not retry and invalidates roles query', async () => {
      server.use(
        http.patch('http://localhost:3000/roles/:id/status', () => {
          return HttpResponse.json(mockRoleDto, { status: 200 });
        }),
      );

      const queryClient = new QueryClient();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useChangeRoleStatus(), {
        wrapper: createWrapper(queryClient),
      });

      result.current.mutate({ id: 'role-123', body: { status: 'INACTIVE' } });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['roles'] });
    });

    it('useUpdateRolePermissions does not retry and invalidates roles query', async () => {
      server.use(
        http.put('http://localhost:3000/roles/:id/permissions', () => {
          return HttpResponse.json(mockRoleDto, { status: 200 });
        }),
      );

      const queryClient = new QueryClient();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useUpdateRolePermissions(), {
        wrapper: createWrapper(queryClient),
      });

      result.current.mutate({ id: 'role-123', body: { permissions: [] } });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['roles'] });
    });
  });

  describe('User Access hooks (HU-007, T-007-15)', () => {
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

    describe('useUserAccess', () => {
      it('fetches user access and caches data with staleTime: 0', async () => {
        server.use(
          http.get('http://localhost:3000/users/:id/effective-permissions', () => {
            return HttpResponse.json(mockUserAccessDto, { status: 200 });
          }),
        );

        const { result } = renderHook(() => useUserAccess('usr-123'), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual(mockUserAccessDto);
      });

      it('requests the user access once under StrictMode', async () => {
        let requestCount = 0;
        server.use(
          http.get('http://localhost:3000/users/:id/effective-permissions', () => {
            requestCount += 1;
            return HttpResponse.json(mockUserAccessDto, { status: 200 });
          }),
        );

        const queryClient = new QueryClient({
          defaultOptions: { queries: { retry: false } },
        });

        function StrictModeWrapper({ children }: { children: ReactNode }) {
          return (
            <StrictMode>
              <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
            </StrictMode>
          );
        }

        const { result } = renderHook(() => useUserAccess('usr-strict-mode'), {
          wrapper: StrictModeWrapper,
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(requestCount).toBe(1);
      });
    });

    describe('useAssignUserRoles', () => {
      it('stores the returned access in the cache and invalidates roles query after saving roles', async () => {
        server.use(
          http.put('http://localhost:3000/users/:id/roles', () => {
            return HttpResponse.json(mockUserAccessDto, { status: 200 });
          }),
        );

        const queryClient = new QueryClient({
          defaultOptions: { mutations: { retry: false } },
        });
        const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

        const { result } = renderHook(() => useAssignUserRoles('usr-123'), {
          wrapper: createWrapper(queryClient),
        });

        result.current.mutate({ roleIds: ['role-cuid-123'] });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual(mockUserAccessDto);
        expect(setQueryDataSpy).toHaveBeenCalledWith(['userAccess', 'usr-123'], mockUserAccessDto);
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['roles'] });
      });
    });

    describe('useAssignUserPermissions', () => {
      it('stores the returned access in the cache after saving permissions', async () => {
        server.use(
          http.put('http://localhost:3000/users/:id/permissions', () => {
            return HttpResponse.json(mockUserAccessDto, { status: 200 });
          }),
        );

        const queryClient = new QueryClient({
          defaultOptions: { mutations: { retry: false } },
        });
        const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');

        const { result } = renderHook(() => useAssignUserPermissions('usr-123'), {
          wrapper: createWrapper(queryClient),
        });

        result.current.mutate({
          permissions: [{ permissionCode: 'academico.editar', scope: 'GLOBAL' }],
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual(mockUserAccessDto);
        expect(setQueryDataSpy).toHaveBeenCalledWith(['userAccess', 'usr-123'], mockUserAccessDto);
      });
    });
  });
});
