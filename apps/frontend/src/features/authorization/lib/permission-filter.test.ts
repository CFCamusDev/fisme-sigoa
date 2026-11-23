import { describe, expect, it } from 'vitest';
import type { PermissionDto } from '@sigoa/shared';
import { countAssigned, filterPermissions } from './permission-filter';

const CATALOG: readonly PermissionDto[] = [
  {
    code: 'sesion.ver',
    description: 'Consultar sesiones de comité y evaluación',
    module: 'M06 Sesiones',
  },
  {
    code: 'usuario.ver',
    description: 'Listar usuarios del sistema',
    module: 'M01 Seguridad',
  },
  {
    code: 'usuario.editar',
    description: 'Actualizar datos y estado de usuarios',
    module: 'M01 Seguridad',
  },
];

describe('permission-filter', () => {
  it('filters ignoring accents and case', () => {
    expect(filterPermissions(CATALOG, 'SESIÓN').map((p) => p.code)).toEqual(['sesion.ver']);
    expect(filterPermissions(CATALOG, 'evaluacion').map((p) => p.code)).toEqual(['sesion.ver']);
    expect(filterPermissions(CATALOG, 'usuario.').map((p) => p.code)).toEqual([
      'usuario.ver',
      'usuario.editar',
    ]);
    expect(filterPermissions(CATALOG, '   ')).toHaveLength(3);
  });

  it('counts assigned permissions per module', () => {
    const draft = {
      'sesion.ver': 'NONE',
      'usuario.ver': 'GLOBAL',
      'usuario.editar': 'OWN',
    } as const;

    expect(
      countAssigned(
        draft,
        CATALOG.filter((p) => p.module === 'M01 Seguridad'),
      ),
    ).toBe(2);
    expect(
      countAssigned(
        draft,
        CATALOG.filter((p) => p.module === 'M06 Sesiones'),
      ),
    ).toBe(0);
  });
});
