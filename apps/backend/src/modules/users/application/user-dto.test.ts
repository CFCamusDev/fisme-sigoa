import { describe, expect, it } from 'vitest';
import { userDtoSchema } from '@sigoa/shared';
import { User } from '../domain/entities/user.js';
import { toUserDto } from './user-dto.js';

describe('toUserDto', () => {
  it('maps a user without dni to a null dni and validates against userDtoSchema', () => {
    const user = User.restore({
      id: 'usr-without-dni',
      names: 'Admin',
      firstSurname: 'Sistema',
      secondSurname: null,
      email: 'admin.sistema@untrm.edu.pe',
      dni: null,
      status: 'ACTIVE',
      lastLoginAt: null,
      createdBy: null,
      updatedBy: null,
      createdAt: new Date('2026-11-04T00:00:00.000Z'),
      updatedAt: new Date('2026-11-04T00:00:00.000Z'),
    });

    const dto = toUserDto(user, ['role-admin']);

    expect(dto.dni).toBeNull();
    expect(dto.id).toBe('usr-without-dni');
    expect(dto.email).toBe('admin.sistema@untrm.edu.pe');

    const parsed = userDtoSchema.parse(dto);
    expect(parsed.dni).toBeNull();
  });

  it('maps a user with dni keeping its 8-digit value', () => {
    const user = User.restore({
      id: 'usr-with-dni',
      names: 'Carlos',
      firstSurname: 'Pérez',
      secondSurname: 'Gómez',
      email: 'carlos.perez@untrm.edu.pe',
      dni: '12345678',
      status: 'ACTIVE',
      lastLoginAt: new Date('2026-11-04T02:00:00.000Z'),
      createdBy: null,
      updatedBy: null,
      createdAt: new Date('2026-11-04T00:00:00.000Z'),
      updatedAt: new Date('2026-11-04T00:00:00.000Z'),
    });

    const dto = toUserDto(user, ['role-teacher']);

    expect(dto.dni).toBe('12345678');
    expect(dto.lastLoginAt).toBe('2026-11-04T02:00:00.000Z');

    const parsed = userDtoSchema.parse(dto);
    expect(parsed.dni).toBe('12345678');
  });
});
