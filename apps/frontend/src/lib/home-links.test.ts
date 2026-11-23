import { describe, expect, it } from 'vitest';
import { getHomeQuickLinkGroups } from './home-links';
import { resolveNavGroups, type NavFilterGroup } from './nav-filter';

interface TestGroup extends NavFilterGroup {
  readonly title: string;
}

const GROUPS: readonly TestGroup[] = [
  { id: 'inicio', title: 'Inicio', items: [{ href: '/' }] },
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
    items: [{ href: '/configuracion/parametros', permission: 'parametro.ver' }],
  },
];

describe('getHomeQuickLinkGroups', () => {
  it('excludes the dashboard item and empty groups', () => {
    const resolved = resolveNavGroups(GROUPS, {
      isLoading: false,
      isAllowed: (perm) => perm === 'usuario.ver',
    });

    const quickLinks = getHomeQuickLinkGroups(resolved);
    expect(quickLinks.map((entry) => entry.group.id)).toEqual(['administracion']);
    expect(quickLinks[0]?.items.map((item) => item.href)).toEqual(['/usuarios']);
  });

  it('returns an empty list while permissions are loading', () => {
    const resolved = resolveNavGroups(GROUPS, {
      isLoading: true,
      isAllowed: () => false,
    });

    expect(getHomeQuickLinkGroups(resolved)).toEqual([]);
  });
});
