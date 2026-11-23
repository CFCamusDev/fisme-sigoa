import { describe, expect, it } from 'vitest';
import {
  changeUserStatusRequestSchema,
  createUserRequestSchema,
  listUsersQuerySchema,
  updateUserRequestSchema,
  userDtoSchema,
  userEditFormSchema,
  type CreateUserRequest,
  type UserDto,
} from './users.js';

describe('Users Schemas (T-003-09, RF-003, RNF-008, CA1-CA4)', () => {
  describe('createUserRequestSchema', () => {
    const validPayload = {
      names: 'Juan Carlos',
      firstSurname: 'Pérez',
      secondSurname: 'Gómez',
      email: 'juan.perez@untrm.edu.pe',
      dni: '12345678',
      roleIds: ['role-admin-id'],
    };

    it('accepts a valid create request', () => {
      const parsed: CreateUserRequest = createUserRequestSchema.parse(validPayload);
      expect(parsed.names).toBe('Juan Carlos');
      expect(parsed.firstSurname).toBe('Pérez');
      expect(parsed.secondSurname).toBe('Gómez');
      expect(parsed.email).toBe('juan.perez@untrm.edu.pe');
      expect(parsed.dni).toBe('12345678');
      expect(parsed.roleIds).toEqual(['role-admin-id']);
    });

    it('trims and lowercases the email', () => {
      const parsed = createUserRequestSchema.parse({
        ...validPayload,
        email: '  JUAN.PEREZ@UNTRM.EDU.PE  ',
      });
      expect(parsed.email).toBe('juan.perez@untrm.edu.pe');
    });

    it('rejects a dni that is not 8 digits', () => {
      expect(() =>
        createUserRequestSchema.parse({
          ...validPayload,
          dni: '1234567',
        }),
      ).toThrow();

      expect(() =>
        createUserRequestSchema.parse({
          ...validPayload,
          dni: '123456789',
        }),
      ).toThrow();

      expect(() =>
        createUserRequestSchema.parse({
          ...validPayload,
          dni: '1234567a',
        }),
      ).toThrow();
    });

    it('userEditFormSchema rejects an invalid dni with the signup message', () => {
      const invalid = userEditFormSchema.safeParse({
        names: 'Ana',
        firstSurname: 'Torres',
        secondSurname: '',
        email: 'ana@untrm.edu.pe',
        dni: '123',
      });
      expect(invalid.success).toBe(false);
      if (!invalid.success) {
        expect(invalid.error.issues[0]?.message).toBe(
          'El DNI debe contener exactamente 8 dígitos numéricos',
        );
      }

      const emptyDni = userEditFormSchema.safeParse({
        names: 'Ana',
        firstSurname: 'Torres',
        secondSurname: '',
        email: 'ana@untrm.edu.pe',
        dni: '',
      });
      expect(emptyDni.success).toBe(true);
    });

    it('rejects an empty or oversized name', () => {
      expect(() =>
        createUserRequestSchema.parse({
          ...validPayload,
          names: '   ',
        }),
      ).toThrow();

      expect(() =>
        createUserRequestSchema.parse({
          ...validPayload,
          names: 'a'.repeat(101),
        }),
      ).toThrow();

      expect(() =>
        createUserRequestSchema.parse({
          ...validPayload,
          firstSurname: '',
        }),
      ).toThrow();
    });

    it('rejects an empty role list', () => {
      expect(() =>
        createUserRequestSchema.parse({
          ...validPayload,
          roleIds: [],
        }),
      ).toThrow();
    });

    it('rejects duplicated or too many role ids', () => {
      expect(() =>
        createUserRequestSchema.parse({
          ...validPayload,
          roleIds: ['role-1', 'role-1'],
        }),
      ).toThrow();

      expect(() =>
        createUserRequestSchema.parse({
          ...validPayload,
          roleIds: Array.from({ length: 11 }, (_, i) => `role-${i}`),
        }),
      ).toThrow();
    });

    it('rejects unknown keys', () => {
      expect(() =>
        createUserRequestSchema.parse({
          ...validPayload,
          extraField: 'not-allowed',
        }),
      ).toThrow();
    });
  });

  describe('updateUserRequestSchema', () => {
    it('update request requires at least one field', () => {
      expect(() => updateUserRequestSchema.parse({})).toThrow();

      const validUpdate = updateUserRequestSchema.parse({
        names: 'Nuevo Nombre',
      });
      expect(validUpdate.names).toBe('Nuevo Nombre');
    });

    it('update request does not accept status', () => {
      expect(() =>
        updateUserRequestSchema.parse({
          names: 'Nuevo Nombre',
          status: 'ACTIVE',
        }),
      ).toThrow();
    });

    it('update request does not accept roleIds', () => {
      expect(() =>
        updateUserRequestSchema.parse({
          names: 'Nuevo Nombre',
          roleIds: ['role-1'],
        }),
      ).toThrow();
    });
  });

  describe('changeUserStatusRequestSchema', () => {
    it('change status accepts only ACTIVE or INACTIVE', () => {
      expect(changeUserStatusRequestSchema.parse({ status: 'ACTIVE' })).toEqual({
        status: 'ACTIVE',
      });
      expect(changeUserStatusRequestSchema.parse({ status: 'INACTIVE' })).toEqual({
        status: 'INACTIVE',
      });

      expect(() =>
        changeUserStatusRequestSchema.parse({
          status: 'PENDING_ACTIVATION',
        }),
      ).toThrow();

      expect(() =>
        changeUserStatusRequestSchema.parse({
          status: 'OTHER',
        }),
      ).toThrow();
    });
  });

  describe('listUsersQuerySchema', () => {
    it('list query applies defaults and coerces numbers', () => {
      const parsed = listUsersQuerySchema.parse({});
      expect(parsed.page).toBe(1);
      expect(parsed.pageSize).toBe(20);
      expect(parsed.status).toBeUndefined();
      expect(parsed.roleId).toBeUndefined();

      const parsedCoerced = listUsersQuerySchema.parse({
        page: '3',
        pageSize: '50',
        status: 'ACTIVE',
        roleId: 'role-123',
      });
      expect(parsedCoerced.page).toBe(3);
      expect(parsedCoerced.pageSize).toBe(50);
      expect(parsedCoerced.status).toBe('ACTIVE');
      expect(parsedCoerced.roleId).toBe('role-123');
    });

    it('list query rejects page size above the maximum', () => {
      expect(() =>
        listUsersQuerySchema.parse({
          pageSize: 101,
        }),
      ).toThrow();

      expect(() =>
        listUsersQuerySchema.parse({
          page: 0,
        }),
      ).toThrow();
    });

    it('list query rejects a page above the maximum', () => {
      expect(() =>
        listUsersQuerySchema.parse({
          page: 10_001,
        }),
      ).toThrow();
    });

    it('list query rejects an oversized role id', () => {
      expect(() =>
        listUsersQuerySchema.parse({
          roleId: 'a'.repeat(65),
        }),
      ).toThrow();
    });
  });

  describe('userDtoSchema', () => {
    const validDto: UserDto = {
      id: 'usr-123',
      names: 'Juan Carlos',
      firstSurname: 'Pérez',
      secondSurname: null,
      email: 'juan.perez@untrm.edu.pe',
      dni: '12345678',
      status: 'ACTIVE',
      roleIds: ['role-admin'],
      lastLoginAt: '2026-11-03T12:00:00.000Z',
      createdAt: '2026-11-03T10:00:00.000Z',
      updatedAt: '2026-11-03T10:00:00.000Z',
    };

    it('user dto accepts a null dni', () => {
      const parsed = userDtoSchema.parse({
        ...validDto,
        dni: null,
      });
      expect(parsed.dni).toBeNull();
    });

    it('user dto still rejects a malformed dni', () => {
      expect(() =>
        userDtoSchema.parse({
          ...validDto,
          dni: '1234',
        }),
      ).toThrow();
    });

    it('user dto has no password or lockout fields', () => {
      const parsed = userDtoSchema.parse(validDto);
      expect(parsed.id).toBe('usr-123');
      expect((parsed as Record<string, unknown>).passwordHash).toBeUndefined();
      expect((parsed as Record<string, unknown>).failedLoginAttempts).toBeUndefined();
      expect((parsed as Record<string, unknown>).lockedUntil).toBeUndefined();

      expect(() =>
        userDtoSchema.parse({
          ...validDto,
          passwordHash: 'secret',
        }),
      ).toThrow();
    });
  });
});
