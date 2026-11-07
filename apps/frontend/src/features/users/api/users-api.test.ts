import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import type {
  CreateUserRequest,
  ListUsersResponse,
  UpdateUserRequest,
  UserDto,
} from '@sigoa/shared';
import { changeUserStatus, createUser, getUser, listUsers, updateUser } from './index';

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

describe('Users API client functions (T-003-15)', () => {
  describe('listUsers', () => {
    it('requests users with query parameters and returns parsed data', async () => {
      let capturedUrl = '';

      server.use(
        http.get('http://localhost:3000/users', ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json(mockListUsersResponse, { status: 200 });
        }),
      );

      const result = await listUsers({
        status: 'ACTIVE',
        roleId: 'role-teacher-1',
        page: 2,
        pageSize: 10,
      });

      expect(capturedUrl).toContain('status=ACTIVE');
      expect(capturedUrl).toContain('roleId=role-teacher-1');
      expect(capturedUrl).toContain('page=2');
      expect(capturedUrl).toContain('pageSize=10');
      expect(result).toEqual(mockListUsersResponse);
    });

    it('rejects responses breaking the ListUsersResponse contract', async () => {
      server.use(
        http.get('http://localhost:3000/users', () => {
          return HttpResponse.json({ items: 'not-an-array' }, { status: 200 });
        }),
      );

      await expect(listUsers()).rejects.toThrow();
    });
  });

  describe('getUser', () => {
    it('fetches a user by ID and parses UserDto', async () => {
      server.use(
        http.get('http://localhost:3000/users/usr-cuid-123', () => {
          return HttpResponse.json(mockUserDto, { status: 200 });
        }),
      );

      const result = await getUser('usr-cuid-123');
      expect(result).toEqual(mockUserDto);
    });
  });

  describe('createUser', () => {
    it('validates request payload and posts to /users', async () => {
      let capturedBody: unknown = null;

      server.use(
        http.post('http://localhost:3000/users', async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json(mockUserDto, { status: 201 });
        }),
      );

      const newUserData: CreateUserRequest = {
        names: 'Carlos',
        firstSurname: 'Pérez',
        secondSurname: 'Gómez',
        email: 'carlos.perez@untrm.edu.pe',
        dni: '12345678',
        roleIds: ['role-teacher-1'],
      };

      const result = await createUser(newUserData);

      expect(capturedBody).toEqual(newUserData);
      expect(result).toEqual(mockUserDto);
    });
  });

  describe('updateUser', () => {
    it('sends PATCH request with partial update payload', async () => {
      let capturedBody: unknown = null;

      server.use(
        http.patch('http://localhost:3000/users/usr-cuid-123', async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({ ...mockUserDto, names: 'Carlos Modificado' }, { status: 200 });
        }),
      );

      const updateData: UpdateUserRequest = {
        names: 'Carlos Modificado',
      };

      const result = await updateUser('usr-cuid-123', updateData);

      expect(capturedBody).toEqual(updateData);
      expect(result.names).toBe('Carlos Modificado');
    });
  });

  describe('changeUserStatus', () => {
    it('sends PATCH request to /users/:id/status with target status', async () => {
      let capturedBody: unknown = null;

      server.use(
        http.patch('http://localhost:3000/users/usr-cuid-123/status', async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({ ...mockUserDto, status: 'INACTIVE' }, { status: 200 });
        }),
      );

      const result = await changeUserStatus('usr-cuid-123', { status: 'INACTIVE' });

      expect(capturedBody).toEqual({ status: 'INACTIVE' });
      expect(result.status).toBe('INACTIVE');
    });
  });
});
