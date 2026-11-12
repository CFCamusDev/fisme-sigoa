import { PROTECTED_ROLE_CODE } from '@sigoa/shared';
import {
  DEFAULT_ROLE_MATRIX,
  expandDefaultGrants,
  type DefaultRolePermissionGrant,
} from './default-role-matrix.js';

export interface PredefinedRoleDefinition {
  readonly code: string;
  readonly name: string;
  readonly description: string;
}

export const PREDEFINED_ROLES: readonly PredefinedRoleDefinition[] = [
  {
    code: PROTECTED_ROLE_CODE,
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

export const DEFAULT_ROLE_PERMISSIONS: readonly DefaultRolePermissionGrant[] =
  expandDefaultGrants(DEFAULT_ROLE_MATRIX);
