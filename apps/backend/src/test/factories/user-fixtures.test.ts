import { describe, expect, it } from 'vitest';
import { buildUser, buildUsersByRole, USER_ROLES, USER_STATUSES } from './user-fixtures.js';

describe('user fixtures', () => {
  it('buildUser creates a user for each role in one line', () => {
    for (const role of USER_ROLES) {
      const user = buildUser(role);
      expect(user.role).toBe(role);
      expect(user.id).toBeDefined();
      expect(user.email).toMatch(/^usuario-\d+@example\.test$/);
      expect(user.status).toBe('ACTIVE');
    }
  });

  it('buildUser respects overrides for specific attributes', () => {
    const customUser = buildUser('TEACHER', {
      names: 'Docente Carlos',
      email: 'carlos.docente@example.test',
      status: 'PENDING_ACTIVATION',
    });

    expect(customUser.role).toBe('TEACHER');
    expect(customUser.names).toBe('Docente Carlos');
    expect(customUser.email).toBe('carlos.docente@example.test');
    expect(customUser.status).toBe('PENDING_ACTIVATION');
  });

  it('buildUsersByRole returns one user per role dictionary', () => {
    const allRoleUsers = buildUsersByRole();

    for (const role of USER_ROLES) {
      const user = allRoleUsers[role];
      expect(user).toBeDefined();
      expect(user.role).toBe(role);
    }
  });

  it('fixtures use only fictional test data without personal data', () => {
    const user = buildUser('ADMINISTRATOR');

    expect(user.email.endsWith('@example.test')).toBe(true);
    // No debe contener DNI, teléfono ni datos reales
    expect((user as unknown as Record<string, unknown>)['dni']).toBeUndefined();
    expect((user as unknown as Record<string, unknown>)['phone']).toBeUndefined();
    expect((user as unknown as Record<string, unknown>)['password']).toBeUndefined();
  });

  it('validates user statuses belong to allowed enum', () => {
    expect(USER_STATUSES).toEqual(['PENDING_ACTIVATION', 'ACTIVE', 'INACTIVE']);
  });
});
