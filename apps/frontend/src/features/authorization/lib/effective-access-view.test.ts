import { describe, expect, it } from 'vitest';
import type { EffectiveAccessEntry, ListPermissionsResponse } from '@sigoa/shared';
import { describeScope, describeSource, groupEntriesByModule } from './effective-access-view';

const mockCatalog: ListPermissionsResponse = {
  items: [
    {
      code: 'academico.ver',
      description: 'Ver información académica',
      module: 'M09 Gestión Académica',
    },
    {
      code: 'academico.editar',
      description: 'Editar información académica',
      module: 'M09 Gestión Académica',
    },
    {
      code: 'matriz.ver',
      description: 'Ver matriz de alineamiento',
      module: 'M10 Medición Directa',
    },
  ],
};

describe('effective-access-view helpers (HU-007, T-007-17, CA1, CA2)', () => {
  describe('describeScope', () => {
    it('formats GLOBAL as Global and OWN as Propio', () => {
      expect(describeScope('GLOBAL')).toBe('Global');
      expect(describeScope('OWN')).toBe('Propio');
    });
  });

  describe('describeSource', () => {
    it('describes a role source in text including role name and scope', () => {
      const source = {
        kind: 'ROLE' as const,
        roleId: 'role-1',
        roleCode: 'TEACHER',
        roleName: 'Docente',
        scope: 'GLOBAL' as const,
      };
      expect(describeSource(source)).toBe('Rol Docente · Global');
    });

    it('describes a direct source in text including direct label and scope', () => {
      const source = {
        kind: 'DIRECT' as const,
        scope: 'OWN' as const,
      };
      expect(describeSource(source)).toBe('Directo · Propio');
    });
  });

  describe('groupEntriesByModule', () => {
    it('returns empty array when entries are empty', () => {
      expect(groupEntriesByModule([])).toEqual([]);
      expect(groupEntriesByModule([], mockCatalog)).toEqual([]);
    });

    it('groups entries by module and sorts by module and permission code', () => {
      const entries: EffectiveAccessEntry[] = [
        {
          permissionCode: 'matriz.ver',
          scope: 'OWN',
          sources: [{ kind: 'DIRECT', scope: 'OWN' }],
        },
        {
          permissionCode: 'academico.editar',
          scope: 'GLOBAL',
          sources: [
            {
              kind: 'ROLE',
              roleId: 'r1',
              roleCode: 'DIRECTOR',
              roleName: 'Director de Programa',
              scope: 'GLOBAL',
            },
          ],
        },
        {
          permissionCode: 'academico.ver',
          scope: 'GLOBAL',
          sources: [
            {
              kind: 'ROLE',
              roleId: 'r2',
              roleCode: 'TEACHER',
              roleName: 'Docente',
              scope: 'GLOBAL',
            },
          ],
        },
      ];

      const grouped = groupEntriesByModule(entries, mockCatalog);
      expect(grouped).toHaveLength(2);

      // Primer módulo M09
      expect(grouped[0]!.module).toBe('M09 Gestión Académica');
      expect(grouped[0]!.entries).toHaveLength(2);
      expect(grouped[0]!.entries[0]!.permissionCode).toBe('academico.editar');
      expect(grouped[0]!.entries[0]!.description).toBe('Editar información académica');
      expect(grouped[0]!.entries[0]!.scopeLabel).toBe('Global');
      expect(grouped[0]!.entries[0]!.sourceLabels).toEqual(['Rol Director de Programa · Global']);

      expect(grouped[0]!.entries[1]!.permissionCode).toBe('academico.ver');
      expect(grouped[0]!.entries[1]!.description).toBe('Ver información académica');

      // Segundo módulo M10
      expect(grouped[1]!.module).toBe('M10 Medición Directa');
      expect(grouped[1]!.entries).toHaveLength(1);
      expect(grouped[1]!.entries[0]!.permissionCode).toBe('matriz.ver');
      expect(grouped[1]!.entries[0]!.scopeLabel).toBe('Propio');
      expect(grouped[1]!.entries[0]!.sourceLabels).toEqual(['Directo · Propio']);
    });

    it('falls back to Sin módulo and empty description when catalog is omitted or permission is unknown', () => {
      const entries: EffectiveAccessEntry[] = [
        {
          permissionCode: 'permiso.desconocido',
          scope: 'GLOBAL',
          sources: [{ kind: 'DIRECT', scope: 'GLOBAL' }],
        },
      ];

      const groupedWithoutCatalog = groupEntriesByModule(entries);
      expect(groupedWithoutCatalog).toHaveLength(1);
      expect(groupedWithoutCatalog[0]!.module).toBe('Sin módulo');
      expect(groupedWithoutCatalog[0]!.entries[0]!.description).toBe('');
    });
  });
});
