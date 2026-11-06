import { describe, expect, it } from 'vitest';
import { ROLE_DESCRIPTION_MAX_LENGTH, ROLE_NAME_MAX_LENGTH } from '@sigoa/shared';
import { InvalidRoleDataError } from '../errors/invalid-role-data-error.js';
import { Role } from './role.js';

describe('Role Domain Entity (HU-006, T-006-07b)', () => {
  it('creates an active custom role with a derived code', () => {
    const role = Role.create({
      id: 'role-cuid-1',
      name: 'Auditor de Calidad',
      description: 'Rol para auditorías de procesos',
      createdBy: 'user-admin',
    });

    expect(role.id).toBe('role-cuid-1');
    expect(role.code).toBe('AUDITOR_DE_CALIDAD');
    expect(role.name).toBe('Auditor de Calidad');
    expect(role.description).toBe('Rol para auditorías de procesos');
    expect(role.status).toBe('ACTIVE');
    expect(role.isPredefined).toBe(false);
    expect(role.deactivatedAt).toBeNull();
    expect(role.createdBy).toBe('user-admin');
    expect(role.updatedBy).toBeNull();
    expect(role.createdAt).toBeInstanceOf(Date);
    expect(role.updatedAt).toBeInstanceOf(Date);
  });

  it('normalizes name and description', () => {
    const role = Role.create({
      id: 'role-cuid-2',
      name: '   Coordinador    General   ',
      description: '   Descripción con espacios   ',
    });

    expect(role.name).toBe('Coordinador General');
    expect(role.code).toBe('COORDINADOR_GENERAL');
    expect(role.description).toBe('Descripción con espacios');

    const roleEmptyDesc = Role.create({
      id: 'role-cuid-3',
      name: 'Gestor',
      description: '   ',
    });
    expect(roleEmptyDesc.description).toBeNull();

    const roleNullDesc = Role.create({
      id: 'role-cuid-4',
      name: 'Evaluador',
      description: null,
    });
    expect(roleNullDesc.description).toBeNull();
  });

  it('rejects invalid name or description', () => {
    expect(() =>
      Role.create({
        id: 'role-cuid-5',
        name: 'ab',
      }),
    ).toThrow(InvalidRoleDataError);

    expect(() =>
      Role.create({
        id: 'role-cuid-6',
        name: 'a'.repeat(ROLE_NAME_MAX_LENGTH + 1),
      }),
    ).toThrow(InvalidRoleDataError);

    expect(() =>
      Role.create({
        id: 'role-cuid-7',
        name: 'Valido',
        description: 'd'.repeat(ROLE_DESCRIPTION_MAX_LENGTH + 1),
      }),
    ).toThrow(InvalidRoleDataError);

    expect(() =>
      Role.create({
        id: '',
        name: 'Valido',
      }),
    ).toThrow(InvalidRoleDataError);
  });

  it('restores every field', () => {
    const now = new Date('2026-11-06T15:00:00.000Z');
    const deactivatedDate = new Date('2026-11-06T16:00:00.000Z');

    const role = Role.restore({
      id: 'role-teacher',
      code: 'TEACHER',
      name: 'Docente',
      description: 'Docente del programa',
      status: 'INACTIVE',
      deactivatedAt: deactivatedDate,
      isPredefined: true,
      createdBy: 'system',
      updatedBy: 'admin',
      createdAt: now,
      updatedAt: now,
    });

    expect(role.id).toBe('role-teacher');
    expect(role.code).toBe('TEACHER');
    expect(role.name).toBe('Docente');
    expect(role.description).toBe('Docente del programa');
    expect(role.status).toBe('INACTIVE');
    expect(role.deactivatedAt).toEqual(deactivatedDate);
    expect(role.isPredefined).toBe(true);
    expect(role.createdBy).toBe('system');
    expect(role.updatedBy).toBe('admin');
    expect(role.createdAt).toEqual(now);
    expect(role.updatedAt).toEqual(now);
  });

  it('audit snapshot excludes timestamps', () => {
    const role = Role.create({
      id: 'role-cuid-8',
      name: 'Secretario Académico',
      description: 'Secretaría',
    });

    const snapshot = role.toAuditSnapshot();
    expect(snapshot).toEqual({
      id: 'role-cuid-8',
      code: 'SECRETARIO_ACADEMICO',
      name: 'Secretario Académico',
      description: 'Secretaría',
      status: 'ACTIVE',
      isPredefined: false,
    });
    expect((snapshot as unknown as Record<string, unknown>).createdAt).toBeUndefined();
    expect((snapshot as unknown as Record<string, unknown>).updatedAt).toBeUndefined();
    expect((snapshot as unknown as Record<string, unknown>).deactivatedAt).toBeUndefined();
  });
});
