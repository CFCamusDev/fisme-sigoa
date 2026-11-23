import { describe, expect, it } from 'vitest';
import { isNavItemActive, resolveNavGroups, type NavFilterGroup } from './nav-filter';

interface TestGroup extends NavFilterGroup {
  readonly title: string;
}

const SAMPLE_GROUPS: readonly TestGroup[] = [
  {
    id: 'inicio',
    title: 'Inicio',
    items: [{ href: '/' }],
  },
  {
    id: 'administracion',
    title: 'Administración',
    items: [
      { href: '/usuarios', permission: 'usuario.ver' },
      { href: '/roles', permission: 'rol.ver' },
    ],
  },
  {
    id: 'configuracion',
    title: 'Configuración',
    items: [
      { href: '/configuracion/programa', permission: 'parametro.ver' },
      { href: '/configuracion/parametros', permission: 'parametro.ver' },
    ],
  },
  {
    id: 'gestion-calidad',
    title: 'Gestión de calidad',
    items: [{ href: '/ejecuciones', permission: 'ejecucion.ver', activeMatch: ['/cronograma'] }],
  },
];

describe('resolveNavGroups', () => {
  it('hides a group without permitted items', () => {
    const result = resolveNavGroups(SAMPLE_GROUPS, {
      isLoading: false,
      isAllowed: (perm) => perm === 'usuario.ver',
    });

    expect(result.map((entry) => entry.group.id)).toEqual(['inicio', 'administracion']);
    expect(result[1]?.items.map((item) => item.href)).toEqual(['/usuarios']);
  });

  it('keeps ungated groups while permissions load', () => {
    const result = resolveNavGroups(SAMPLE_GROUPS, {
      isLoading: true,
      isAllowed: () => false,
    });

    expect(result[0]).toMatchObject({
      group: { id: 'inicio' },
      isLoading: false,
      items: [{ href: '/' }],
    });
    expect(result[1]).toMatchObject({
      group: { id: 'administracion' },
      isLoading: true,
      items: [],
    });
  });

  it('fails closed on error', () => {
    const result = resolveNavGroups(SAMPLE_GROUPS, {
      isLoading: false,
      isError: true,
      isAllowed: () => true,
    });

    expect(result.map((entry) => entry.group.id)).toEqual(['inicio']);
  });

  it('keeps the order of groups and items', () => {
    const result = resolveNavGroups(SAMPLE_GROUPS, {
      isLoading: false,
      isAllowed: () => true,
    });

    expect(result.map((entry) => entry.group.id)).toEqual([
      'inicio',
      'administracion',
      'configuracion',
      'gestion-calidad',
    ]);
    expect(result[1]?.items.map((item) => item.href)).toEqual(['/usuarios', '/roles']);
  });
});

describe('isNavItemActive', () => {
  it('matches exact root, nested paths and activeMatch prefixes', () => {
    expect(isNavItemActive('/', { href: '/' })).toBe(true);
    expect(isNavItemActive('/usuarios', { href: '/' })).toBe(false);
    expect(isNavItemActive('/usuarios/usr-1', { href: '/usuarios' })).toBe(true);
    expect(
      isNavItemActive('/cronograma/ej-1', {
        href: '/ejecuciones',
        activeMatch: ['/cronograma'],
      }),
    ).toBe(true);
  });
});
