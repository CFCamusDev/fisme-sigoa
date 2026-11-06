import { describe, expect, it } from 'vitest';
import {
  listRolesResponseSchema,
  roleStatusSchema,
  roleSummarySchema,
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

  it('list response wraps the roles in items', () => {
    const listPayload = {
      items: [validRole],
    };
    const parsed = listRolesResponseSchema.safeParse(listPayload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.items).toHaveLength(1);
      expect(parsed.data.items[0]?.code).toBe('TEACHER');
    }

    const emptyList = listRolesResponseSchema.safeParse({ items: [] });
    expect(emptyList.success).toBe(true);

    const invalidList = listRolesResponseSchema.safeParse({
      items: [{ id: 'bad-role' }],
    });
    expect(invalidList.success).toBe(false);
  });
});
