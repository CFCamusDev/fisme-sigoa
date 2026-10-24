import { defineFactory } from './define-factory.js';

export const USER_ROLES = [
  'ADMINISTRATOR',
  'COMMITTEE_PRESIDENT',
  'COMMITTEE_MEMBER',
  'EPIS_DIRECTOR',
  'TEACHER',
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ['PENDING_ACTIVATION', 'ACTIVE', 'INACTIVE'] as const;

export type UserStatus = (typeof USER_STATUSES)[number];

export interface TestUser {
  id: string;
  names: string;
  firstSurname: string;
  secondSurname?: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

const baseUserFactory = defineFactory<TestUser>((seq) => ({
  id: `usr-test-${seq}`,
  names: `Usuario ${seq}`,
  firstSurname: `Apellido ${seq}`,
  secondSurname: undefined,
  email: `usuario-${seq}@example.test`,
  role: 'TEACHER',
  status: 'ACTIVE',
  createdAt: new Date('2026-10-23T12:00:00.000Z'),
  updatedAt: new Date('2026-10-23T12:00:00.000Z'),
}));

/**
 * Crea un usuario ficticio para pruebas unitarias y de integración.
 * Permite instanciar cualquier rol del sistema en una sola línea.
 */
export function buildUser(role: UserRole = 'TEACHER', overrides?: Partial<TestUser>): TestUser {
  return baseUserFactory.build({
    role,
    ...overrides,
  });
}

/**
 * Devuelve un diccionario con un usuario generado por cada rol existente en el sistema.
 */
export function buildUsersByRole(
  overrides?: Partial<Record<UserRole, Partial<TestUser>>>,
): Record<UserRole, TestUser> {
  const result = {} as Record<UserRole, TestUser>;
  for (const role of USER_ROLES) {
    result[role] = buildUser(role, overrides?.[role]);
  }
  return result;
}
