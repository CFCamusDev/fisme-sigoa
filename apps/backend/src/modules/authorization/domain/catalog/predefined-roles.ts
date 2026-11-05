import type { PermissionCode } from './permission-catalog.js';

export interface PredefinedRoleDefinition {
  readonly code: string;
  readonly name: string;
  readonly description: string;
}

export const PREDEFINED_ROLES: readonly PredefinedRoleDefinition[] = [
  {
    code: 'ADMINISTRATOR',
    name: 'Administrador',
    description: 'Acceso y administración general del sistema',
  },
  {
    code: 'COMMITTEE_PRESIDENT',
    name: 'Presidente del Comité de Calidad',
    description: 'Presidencia del Comité de Calidad de EPIS',
  },
  {
    code: 'COMMITTEE_MEMBER',
    name: 'Miembro del Comité de Calidad',
    description: 'Miembro del Comité de Calidad de EPIS',
  },
  {
    code: 'PROGRAM_DIRECTOR',
    name: 'Director de Escuela',
    description: 'Director de la Escuela Profesional de Ingeniería de Sistemas',
  },
  {
    code: 'TEACHER',
    name: 'Docente',
    description: 'Docente de la Escuela Profesional de Ingeniería de Sistemas',
  },
] as const;

export interface DefaultRolePermissionGrant {
  readonly roleCode: string;
  readonly permissionCode: PermissionCode;
  readonly scope: 'GLOBAL' | 'OWN';
}

export const DEFAULT_ROLE_PERMISSIONS: readonly DefaultRolePermissionGrant[] = [
  {
    roleCode: 'ADMINISTRATOR',
    permissionCode: 'usuario.ver',
    scope: 'GLOBAL',
  },
  {
    roleCode: 'ADMINISTRATOR',
    permissionCode: 'usuario.crear',
    scope: 'GLOBAL',
  },
  {
    roleCode: 'ADMINISTRATOR',
    permissionCode: 'usuario.editar',
    scope: 'GLOBAL',
  },
  {
    roleCode: 'ADMINISTRATOR',
    permissionCode: 'rol.ver',
    scope: 'GLOBAL',
  },
] as const;
