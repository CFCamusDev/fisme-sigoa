export type PermissionCode = 'usuario.ver' | 'usuario.crear' | 'usuario.editar';

export interface PermissionDefinition {
  readonly code: PermissionCode;
  readonly description: string;
  readonly module: string;
}

const PERMISSION_CODE_REGEX = /^[a-z]+(\.[a-z]+)+$/;

export function isValidPermissionCodeFormat(code: string): boolean {
  return PERMISSION_CODE_REGEX.test(code);
}

export const CATALOG_PERMISSIONS: readonly PermissionDefinition[] = [
  {
    code: 'usuario.ver',
    description: 'Permite visualizar y listar usuarios del sistema',
    module: 'M01 Seguridad',
  },
  {
    code: 'usuario.crear',
    description: 'Permite crear nuevos usuarios en el sistema',
    module: 'M01 Seguridad',
  },
  {
    code: 'usuario.editar',
    description: 'Permite modificar datos de perfil y cambiar estados de usuarios',
    module: 'M01 Seguridad',
  },
] as const;

const PERMISSIONS_BY_CODE = new Map<string, PermissionDefinition>(
  CATALOG_PERMISSIONS.map((p) => [p.code, p]),
);

export function getPermissionDefinition(code: string): PermissionDefinition | undefined {
  return PERMISSIONS_BY_CODE.get(code);
}

export function isPermissionCode(code: string): code is PermissionCode {
  return PERMISSIONS_BY_CODE.has(code);
}
