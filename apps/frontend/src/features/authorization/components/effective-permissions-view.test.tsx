import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { EffectiveAccessEntry, ListPermissionsResponse } from '@sigoa/shared';
import { EffectivePermissionsView } from './effective-permissions-view';

const mockCatalog: ListPermissionsResponse = {
  items: [
    {
      code: 'academico.ver',
      description: 'Ver planes de estudio y cursos',
      module: 'M09 Gestión Académica',
    },
    {
      code: 'academico.editar',
      description: 'Editar cursos y asignaturas',
      module: 'M09 Gestión Académica',
    },
    {
      code: 'matriz.ver',
      description: 'Ver matriz de alineamiento',
      module: 'M10 Medición Directa',
    },
  ],
};

describe('EffectivePermissionsView Component (HU-007, T-007-17, CA1, CA2)', () => {
  it('shows the empty state when entries are empty', () => {
    render(<EffectivePermissionsView entries={[]} />);

    expect(screen.getByText('Este usuario no tiene permisos efectivos')).toBeInTheDocument();
  });

  it('renders CA1: shows the union of two roles and one direct grant with their sources', () => {
    const entries: EffectiveAccessEntry[] = [
      {
        permissionCode: 'academico.ver',
        scope: 'GLOBAL',
        sources: [
          {
            kind: 'ROLE',
            roleId: 'role-teacher',
            roleCode: 'TEACHER',
            roleName: 'Docente',
            scope: 'GLOBAL',
          },
          {
            kind: 'ROLE',
            roleId: 'role-director',
            roleCode: 'PROGRAM_DIRECTOR',
            roleName: 'Director de Programa',
            scope: 'GLOBAL',
          },
        ],
      },
      {
        permissionCode: 'academico.editar',
        scope: 'GLOBAL',
        sources: [
          {
            kind: 'DIRECT',
            scope: 'GLOBAL',
          },
        ],
      },
    ];

    render(<EffectivePermissionsView entries={entries} catalog={mockCatalog} />);

    // Módulo M09
    expect(
      screen.getByRole('heading', { level: 3, name: 'M09 Gestión Académica' }),
    ).toBeInTheDocument();

    // Permisos y descripciones
    expect(screen.getByText('academico.ver')).toBeInTheDocument();
    expect(screen.getByText('Ver planes de estudio y cursos')).toBeInTheDocument();
    expect(screen.getByText('academico.editar')).toBeInTheDocument();
    expect(screen.getByText('Editar cursos y asignaturas')).toBeInTheDocument();

    // Fuentes en texto
    expect(screen.getByText('Rol Docente · Global')).toBeInTheDocument();
    expect(screen.getByText('Rol Director de Programa · Global')).toBeInTheDocument();
    expect(screen.getByText('Directo · Global')).toBeInTheDocument();
  });

  it('renders CA2: shows a direct OWN grant as Propio', () => {
    const entries: EffectiveAccessEntry[] = [
      {
        permissionCode: 'matriz.ver',
        scope: 'OWN',
        sources: [
          {
            kind: 'DIRECT',
            scope: 'OWN',
          },
        ],
      },
    ];

    render(<EffectivePermissionsView entries={entries} catalog={mockCatalog} />);

    expect(screen.getByText('matriz.ver')).toBeInTheDocument();
    expect(screen.getByText('Propio')).toBeInTheDocument();
    expect(screen.getByText('Directo · Propio')).toBeInTheDocument();
  });

  it('renders without a catalog with fallback to Sin módulo and no description', () => {
    const entries: EffectiveAccessEntry[] = [
      {
        permissionCode: 'custom.code',
        scope: 'GLOBAL',
        sources: [{ kind: 'DIRECT', scope: 'GLOBAL' }],
      },
    ];

    render(<EffectivePermissionsView entries={entries} />);

    expect(screen.getByRole('heading', { level: 3, name: 'Sin módulo' })).toBeInTheDocument();
    expect(screen.getByText('custom.code')).toBeInTheDocument();
    expect(screen.getByText('Global')).toBeInTheDocument();
  });

  it('uses the requested heading level (h4)', () => {
    const entries: EffectiveAccessEntry[] = [
      {
        permissionCode: 'matriz.ver',
        scope: 'OWN',
        sources: [{ kind: 'DIRECT', scope: 'OWN' }],
      },
    ];

    render(<EffectivePermissionsView entries={entries} catalog={mockCatalog} headingLevel="h4" />);

    expect(
      screen.getByRole('heading', { level: 4, name: 'M10 Medición Directa' }),
    ).toBeInTheDocument();
  });
});
