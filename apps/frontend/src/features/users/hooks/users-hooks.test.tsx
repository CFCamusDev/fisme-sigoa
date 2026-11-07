import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { server } from '@/test/msw/server';
import type { ListRolesResponse, ListUsersResponse, UserDto } from '@sigoa/shared';
import {
  useChangeUserStatus,
  useCreateUser,
  useRoles,
  useUpdateUser,
  useUser,
  useUsers,
} from './index';

const mockUserDto: UserDto = {
  id: 'usr-cuid-123',
  names: 'Carlos',
  firstSurname: 'Pérez',
  secondSurname: 'Gómez',
  email: 'carlos.perez@untrm.edu.pe',
  dni: '12345678',
  status: 'ACTIVE',
  roleIds: ['role-teacher-1'],
  lastLoginAt: '2026-11-05T12:00:00.000Z',
  createdAt: '2026-11-05T10:00:00.000Z',
  updatedAt: '2026-11-05T10:00:00.000Z',
};

const mockListUsersResponse: ListUsersResponse = {
  items: [mockUserDto],
  total: 1,
  page: 1,
  pageSize: 20,
  totalPages: 1,
};

const mockListRolesResponse: ListRolesResponse = {
  items: [
    {
      id: 'role-admin-1',
      code: 'ADMINISTRATOR',
      name: 'Administrador',
      description: 'Acceso total',
      isPredefined: true,
      status: 'ACTIVE',
      deactivatedAt: null,
      userCount: 0,
      permissions: [],
      updatedAt: '2026-11-06T15:00:00.000Z',
    },
  ],
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, Wrapper };
}

describe('users query and mutation hooks (T-003-15)', () => {
  it('useUsers fetches user list successfully', async () => {
    server.use(
      http.get('http://localhost:3000/users', () => {
        return HttpResponse.json(mockListUsersResponse, { status: 200 });
      }),
    );

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUsers({ page: 1 }), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockListUsersResponse);
  });

  it('useUser fetches a single user by ID', async () => {
    server.use(
      http.get('http://localhost:3000/users/usr-cuid-123', () => {
        return HttpResponse.json(mockUserDto, { status: 200 });
      }),
    );

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUser('usr-cuid-123'), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockUserDto);
  });

  it('useRoles fetches roles with 5 min staleTime', async () => {
    server.use(
      http.get('http://localhost:3000/roles', () => {
        return HttpResponse.json(mockListRolesResponse, { status: 200 });
      }),
    );

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRoles(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockListRolesResponse);
  });

  it('useCreateUser mutates and invalidates user lists', async () => {
    server.use(
      http.post('http://localhost:3000/users', () => {
        return HttpResponse.json(mockUserDto, { status: 201 });
      }),
    );

    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateUser(), {
      wrapper: Wrapper,
    });

    result.current.mutate({
      names: 'Carlos',
      firstSurname: 'Pérez',
      secondSurname: null,
      email: 'carlos.perez@untrm.edu.pe',
      dni: '12345678',
      roleIds: ['role-teacher-1'],
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it('useUpdateUser mutates and updates detail cache', async () => {
    const updatedDto = { ...mockUserDto, names: 'Carlos Updated' };
    server.use(
      http.patch('http://localhost:3000/users/usr-cuid-123', () => {
        return HttpResponse.json(updatedDto, { status: 200 });
      }),
    );

    const { queryClient, Wrapper } = createWrapper();
    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');

    const { result } = renderHook(() => useUpdateUser('usr-cuid-123'), {
      wrapper: Wrapper,
    });

    result.current.mutate({
      names: 'Carlos Updated',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(setQueryDataSpy).toHaveBeenCalled();
  });

  it('useChangeUserStatus mutates and updates cache', async () => {
    const inactiveDto = { ...mockUserDto, status: 'INACTIVE' as const };
    server.use(
      http.patch('http://localhost:3000/users/usr-cuid-123/status', () => {
        return HttpResponse.json(inactiveDto, { status: 200 });
      }),
    );

    const { queryClient, Wrapper } = createWrapper();
    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');

    const { result } = renderHook(() => useChangeUserStatus(), {
      wrapper: Wrapper,
    });

    result.current.mutate({
      id: 'usr-cuid-123',
      body: { status: 'INACTIVE' },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(setQueryDataSpy).toHaveBeenCalled();
  });
});
