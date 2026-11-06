import { describe, expect, it } from 'vitest';
import {
  createRoleRequestSchema,
  listPermissionsResponseSchema,
  listRolesResponseSchema,
  permissionDtoSchema,
  PERMISSION_CODE_PATTERN,
  ROLE_DESCRIPTION_MAX_LENGTH,
  ROLE_NAME_MAX_LENGTH,
  ROLE_NAME_MIN_LENGTH,
  ROLE_PERMISSIONS_MAX,
  roleDtoSchema,
  roleGrantSchema,
  roleIdParamSchema,
  roleStatusSchema,
  roleSummarySchema,
  updateRolePermissionsRequestSchema,
  type RoleSummary,
} from './roles.js';

describe('Roles Shared Contracts (A1, HU-003, T-003-15)', () => {
  it('validates role status enum values (T-006-03)', () => {
    expect(roleStatusSchema.safeParse('ACTIVE').success).toBe(true);
    expect(roleStatusSchema.safeParse('INACTIVE').success).toBe(true);
    expect(roleStatusSchema.safeParse('OTHER').success).toBe(false);
    expect(roleStatusSchema.safeParse('').success).toBe(false);
  });

  const validRole: RoleSummary = {
    id: 'role-teacher-123',
    code: 'TEACHER',
    name: 'Docente',
    description: 'Docente responsable de cursos y mediciones',
    isPredefined: true,
  };

  it('accepts a role summary with and without description', () => {
    const withDescription = roleSummarySchema.safeParse(validRole);
    expect(withDescription.success).toBe(true);

    const withoutDescription = roleSummarySchema.safeParse({
      ...validRole,
      description: null,
    });
    expect(withoutDescription.success).toBe(true);
    if (withoutDescription.success) {
      expect(withoutDescription.data.description).toBeNull();
    }
  });

  it('rejects unknown keys', () => {
    const withExtra = roleSummarySchema.safeParse({
      ...validRole,
      extraField: 'not-allowed',
    });
    expect(withExtra.success).toBe(false);
  });

  const validRoleDto = {
    id: 'role-teacher-123',
    code: 'TEACHER',
    name: 'Docente',
    description: 'Docente responsable de cursos y mediciones',
    isPredefined: true,
    status: 'ACTIVE' as const,
    deactivatedAt: null,
    userCount: 0,
    permissions: [],
    updatedAt: '2026-11-06T15:00:00.000Z',
  };

  it('list response wraps the roles in items', () => {
    const listPayload = {
      items: [validRoleDto],
    };
    const parsed = listRolesResponseSchema.safeParse(listPayload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.items).toHaveLength(1);
      expect(parsed.data.items[0]?.code).toBe('TEACHER');
      expect(parsed.data.items[0]?.status).toBe('ACTIVE');
      expect(parsed.data.items[0]?.userCount).toBe(0);
    }

    const emptyList = listRolesResponseSchema.safeParse({ items: [] });
    expect(emptyList.success).toBe(true);

    const invalidList = listRolesResponseSchema.safeParse({
      items: [{ id: 'bad-role' }],
    });
    expect(invalidList.success).toBe(false);
  });

  it('list response requires the full role dto', () => {
    const partialRole = {
      id: 'role-partial',
      code: 'PARTIAL',
      name: 'Parcial',
      description: null,
      isPredefined: false,
    };
    const parsed = listRolesResponseSchema.safeParse({ items: [partialRole] });
    expect(parsed.success).toBe(false);
  });

  it('list response rejects a role without status', () => {
    const roleWithoutStatus = {
      ...validRoleDto,
      status: undefined,
    };
    const parsed = listRolesResponseSchema.safeParse({ items: [roleWithoutStatus] });
    expect(parsed.success).toBe(false);
  });
});

describe('Role Management Contracts (HU-006, T-006-14)', () => {
  it('accepts a valid create role request', () => {
    const payload = {
      name: 'Auditor de Calidad',
      description: 'Rol para auditorías internas',
      permissions: [
        { permissionCode: 'usuario.ver', scope: 'GLOBAL' as const },
        { permissionCode: 'proceso_ejecucion.revisar', scope: 'OWN' as const },
      ],
    };

    const parsed = createRoleRequestSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe('Auditor de Calidad');
      expect(parsed.data.description).toBe('Rol para auditorías internas');
      expect(parsed.data.permissions).toHaveLength(2);
    }
  });

  it('trims the name and collapses inner spaces', () => {
    const parsed = createRoleRequestSchema.safeParse({
      name: '   Auditor   de    Calidad   ',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe('Auditor de Calidad');
    }
  });

  it('treats an empty description as null', () => {
    const withEmpty = createRoleRequestSchema.safeParse({
      name: 'Auditor',
      description: '   ',
    });
    expect(withEmpty.success).toBe(true);
    if (withEmpty.success) {
      expect(withEmpty.data.description).toBeNull();
    }

    const withNull = createRoleRequestSchema.safeParse({
      name: 'Auditor',
      description: null,
    });
    expect(withNull.success).toBe(true);
    if (withNull.success) {
      expect(withNull.data.description).toBeNull();
    }
  });

  it('defaults permissions to an empty list', () => {
    const parsed = createRoleRequestSchema.safeParse({
      name: 'Coordinador',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.permissions).toEqual([]);
    }
  });

  it('rejects a name shorter than 3 or longer than 80 characters', () => {
    const tooShort = createRoleRequestSchema.safeParse({ name: 'ab' });
    expect(tooShort.success).toBe(false);

    const emptyAfterTrim = createRoleRequestSchema.safeParse({ name: '   ' });
    expect(emptyAfterTrim.success).toBe(false);

    const tooLong = createRoleRequestSchema.safeParse({
      name: 'a'.repeat(ROLE_NAME_MAX_LENGTH + 1),
    });
    expect(tooLong.success).toBe(false);

    const exactMin = createRoleRequestSchema.safeParse({
      name: 'a'.repeat(ROLE_NAME_MIN_LENGTH),
    });
    expect(exactMin.success).toBe(true);

    const exactMax = createRoleRequestSchema.safeParse({
      name: 'a'.repeat(ROLE_NAME_MAX_LENGTH),
    });
    expect(exactMax.success).toBe(true);
  });

  it('rejects a description longer than 255 characters', () => {
    const tooLong = createRoleRequestSchema.safeParse({
      name: 'Coordinador',
      description: 'x'.repeat(ROLE_DESCRIPTION_MAX_LENGTH + 1),
    });
    expect(tooLong.success).toBe(false);

    const exactMax = createRoleRequestSchema.safeParse({
      name: 'Coordinador',
      description: 'x'.repeat(ROLE_DESCRIPTION_MAX_LENGTH),
    });
    expect(exactMax.success).toBe(true);
  });

  it('rejects unknown keys', () => {
    const parsed = createRoleRequestSchema.safeParse({
      name: 'Coordinador',
      code: 'COORDINATOR',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects duplicated permission codes', () => {
    const parsed = createRoleRequestSchema.safeParse({
      name: 'Coordinador',
      permissions: [
        { permissionCode: 'usuario.ver', scope: 'GLOBAL' },
        { permissionCode: 'usuario.ver', scope: 'OWN' },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects more than 200 permissions', () => {
    const items = Array.from({ length: ROLE_PERMISSIONS_MAX + 1 }, (_, i) => ({
      permissionCode: `recurso_${i}.accion`,
      scope: 'GLOBAL' as const,
    }));
    const parsed = createRoleRequestSchema.safeParse({
      name: 'Super Rol',
      permissions: items,
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects a malformed permission code or scope', () => {
    const badCode = roleGrantSchema.safeParse({
      permissionCode: 'USUARIO.VER',
      scope: 'GLOBAL',
    });
    expect(badCode.success).toBe(false);

    const badScope = roleGrantSchema.safeParse({
      permissionCode: 'usuario.ver',
      scope: 'LOCAL',
    });
    expect(badScope.success).toBe(false);
  });

  it('accepts codes with underscores', () => {
    expect(PERMISSION_CODE_PATTERN.test('plan_assessment.ver')).toBe(true);
    expect(PERMISSION_CODE_PATTERN.test('acta.enviar_revision')).toBe(true);
    expect(PERMISSION_CODE_PATTERN.test('proceso_ejecucion.revisar')).toBe(true);
    expect(PERMISSION_CODE_PATTERN.test('proceso.ejecucion.revisar')).toBe(false);
  });

  it('update request accepts an empty permission list', () => {
    const parsed = updateRolePermissionsRequestSchema.safeParse({
      permissions: [],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.permissions).toEqual([]);
    }
  });

  it('role dto accepts null description and null deactivatedAt', () => {
    const dto = {
      id: 'role-123',
      code: 'AUDITOR',
      name: 'Auditor',
      description: null,
      isPredefined: false,
      status: 'ACTIVE' as const,
      deactivatedAt: null,
      userCount: 0,
      permissions: [],
      updatedAt: '2026-11-06T15:00:00.000Z',
    };
    const parsed = roleDtoSchema.safeParse(dto);
    expect(parsed.success).toBe(true);
  });

  it('role dto rejects a negative user count', () => {
    const dto = {
      id: 'role-123',
      code: 'AUDITOR',
      name: 'Auditor',
      description: null,
      isPredefined: false,
      status: 'ACTIVE' as const,
      deactivatedAt: null,
      userCount: -1,
      permissions: [],
      updatedAt: '2026-11-06T15:00:00.000Z',
    };
    const parsed = roleDtoSchema.safeParse(dto);
    expect(parsed.success).toBe(false);
  });

  it('permission list response requires items', () => {
    const single = permissionDtoSchema.safeParse({
      code: 'usuario.ver',
      description: 'Ver usuarios',
      module: 'M01 Seguridad',
    });
    expect(single.success).toBe(true);

    const listWithoutItems = listPermissionsResponseSchema.safeParse({});
    expect(listWithoutItems.success).toBe(false);

    const listWithItems = listPermissionsResponseSchema.safeParse({
      items: [
        {
          code: 'usuario.ver',
          description: 'Ver usuarios',
          module: 'M01 Seguridad',
        },
      ],
    });
    expect(listWithItems.success).toBe(true);
  });

  it('validates roleIdParamSchema', () => {
    const valid = roleIdParamSchema.safeParse({ id: 'role-123' });
    expect(valid.success).toBe(true);

    const empty = roleIdParamSchema.safeParse({ id: '' });
    expect(empty.success).toBe(false);

    const tooLong = roleIdParamSchema.safeParse({ id: 'a'.repeat(65) });
    expect(tooLong.success).toBe(false);
  });
});
