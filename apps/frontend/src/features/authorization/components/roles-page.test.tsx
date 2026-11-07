import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import type { ListRolesResponse, RoleDto } from '@sigoa/shared';
import { RolesPage } from './roles-page';

const letters = 'abcdefghijklmnopqrstuvwxyz';
const validPermissions = Array.from({ length: 72 }, (_, i) => {
  const prefix = letters[Math.floor(i / 26)] ?? 'a';
  const suffix = letters[i % 26];
  return {
    permissionCode: `permiso_${prefix}.accion_${suffix}`,
    scope: 'GLOBAL' as const,
  };
});

const predefinedRoles: RoleDto[] = [
  {
    id: 'role-admin',
    code: 'ADMINISTRATOR',
    name: 'Administrador',
    description: 'Acceso total y configuración del sistema',
    isPredefined: true,
    status: 'ACTIVE',
    deactivatedAt: null,
    userCount: 1500,
    permissions: validPermissions,
    updatedAt: '2026-11-06T10:00:00.000Z',
  },
  {
    id: 'role-quality',
    code: 'QUALITY_COMMITTEE',
    name: 'Comité de Calidad',
    description: null, // descripción nula para probar '—'
    isPredefined: true,
    status: 'ACTIVE',
    deactivatedAt: null,
    userCount: 5,
    permissions: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }],
    updatedAt: '2026-11-06T10:00:00.000Z',
  },
  {
    id: 'role-advisory',
    code: 'ADVISORY_BOARD',
    name: 'Comité Consultivo',
    description: 'Miembros del comité consultivo',
    isPredefined: true,
    status: 'ACTIVE',
    deactivatedAt: null,
    userCount: 12,
    permissions: [],
    updatedAt: '2026-11-06T10:00:00.000Z',
  },
  {
    id: 'role-teacher',
    code: 'TEACHER',
    name: 'Docente',
    description: 'Docentes evaluadores del programa',
    isPredefined: true,
    status: 'ACTIVE',
    deactivatedAt: null,
    userCount: 45,
    permissions: [],
    updatedAt: '2026-11-06T10:00:00.000Z',
  },
  {
    id: 'role-student',
    code: 'STUDENT',
    name: 'Estudiante',
    description: 'Estudiantes matriculados',
    isPredefined: true,
    status: 'ACTIVE',
    deactivatedAt: null,
    userCount: 820,
    permissions: [],
    updatedAt: '2026-11-06T10:00:00.000Z',
  },
  {
    id: 'role-custom-inactive',
    code: 'AUDITOR_DE_CALIDAD',
    name: 'Auditor de Calidad',
    description: 'Auditor externo temporal',
    isPredefined: false,
    status: 'INACTIVE',
    deactivatedAt: '2026-11-06T12:00:00.000Z',
    userCount: 0,
    permissions: [],
    updatedAt: '2026-11-06T12:00:00.000Z',
  },
];

describe('RolesPage (HU-006, T-006-21a, RF-006, CA1, CA3)', () => {
  it('shows a loading state while fetching roles', async () => {
    let resolveRequest: () => void;
    const requestPromise = new Promise<void>((resolve) => {
      resolveRequest = resolve;
    });

    server.use(
      http.get('http://localhost:3000/roles', async () => {
        await requestPromise;
        return HttpResponse.json<ListRolesResponse>({ items: [] });
      }),
    );

    renderWithProviders(<RolesPage />);

    expect(await screen.findByRole('heading', { name: 'Roles', level: 1 })).toBeInTheDocument();
    expect(
      screen.getByText('Administra los grupos de permisos de FISME-SIGOA'),
    ).toBeInTheDocument();
    const loadingSpans = await screen.findAllByText('Cargando datos de la tabla...');
    expect(loadingSpans.length).toBeGreaterThan(0);
    resolveRequest!();
  });

  it('lists roles with status, type, users and permissions including the 5 predefined roles', async () => {
    server.use(
      http.get('http://localhost:3000/roles', () => {
        return HttpResponse.json<ListRolesResponse>({ items: predefinedRoles });
      }),
    );

    renderWithProviders(<RolesPage />);

    await waitFor(() => {
      expect(screen.getByText('Administrador')).toBeInTheDocument();
    });

    // Five predefined roles are rendered
    expect(screen.getByText('Administrador')).toBeInTheDocument();
    expect(screen.getByText('ADMINISTRATOR')).toBeInTheDocument();
    expect(screen.getByText('Comité de Calidad')).toBeInTheDocument();
    expect(screen.getByText('Comité Consultivo')).toBeInTheDocument();
    expect(screen.getByText('Docente')).toBeInTheDocument();
    expect(screen.getByText('Estudiante')).toBeInTheDocument();

    // Type column reflects predefined / custom
    const predefinedBadges = screen.getAllByText('Predefinido');
    expect(predefinedBadges.length).toBe(5);
    expect(screen.getByText('Personalizado')).toBeInTheDocument();

    // StatusBadge with icon + text
    const activeBadges = screen.getAllByText('Activo');
    expect(activeBadges.length).toBe(5);
    expect(screen.getByText('Inactivo')).toBeInTheDocument();
  });

  it('formats counts in es-PE (e.g. 1 500 or 1,500 depending on locale)', async () => {
    server.use(
      http.get('http://localhost:3000/roles', () => {
        return HttpResponse.json<ListRolesResponse>({ items: predefinedRoles });
      }),
    );

    renderWithProviders(<RolesPage />);

    await waitFor(() => {
      expect(screen.getByText('Administrador')).toBeInTheDocument();
    });

    const expectedFormatted1500 = new Intl.NumberFormat('es-PE').format(1500);
    const expectedFormatted72 = new Intl.NumberFormat('es-PE').format(72);
    expect(screen.getByText(expectedFormatted1500)).toBeInTheDocument();
    expect(screen.getByText(expectedFormatted72)).toBeInTheDocument();
  });

  it('shows a dash for a null description', async () => {
    server.use(
      http.get('http://localhost:3000/roles', () => {
        return HttpResponse.json<ListRolesResponse>({ items: predefinedRoles });
      }),
    );

    renderWithProviders(<RolesPage />);

    await waitFor(() => {
      expect(screen.getByText('Comité de Calidad')).toBeInTheDocument();
    });

    // In Comité de Calidad description is null
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('shows an inactive role with its badge', async () => {
    server.use(
      http.get('http://localhost:3000/roles', () => {
        return HttpResponse.json<ListRolesResponse>({ items: predefinedRoles });
      }),
    );

    renderWithProviders(<RolesPage />);

    await waitFor(() => {
      expect(screen.getByText('Auditor de Calidad')).toBeInTheDocument();
    });

    expect(screen.getByText('Inactivo')).toBeInTheDocument();
  });

  it('shows the empty state with the new role action when no roles exist', async () => {
    server.use(
      http.get('http://localhost:3000/roles', () => {
        return HttpResponse.json<ListRolesResponse>({ items: [] });
      }),
    );

    renderWithProviders(<RolesPage />);

    await waitFor(() => {
      expect(screen.getByText('No hay roles registrados')).toBeInTheDocument();
    });

    expect(screen.getByText('Aún no se han configurado roles en el sistema.')).toBeInTheDocument();
    const newRoleButtons = screen.getAllByRole('link', { name: 'Nuevo rol' });
    expect(newRoleButtons.length).toBeGreaterThan(0);
  });

  it('shows an error with a retry button', async () => {
    let attempts = 0;
    server.use(
      http.get('http://localhost:3000/roles', () => {
        attempts++;
        if (attempts === 1) {
          return HttpResponse.json(
            { error: { code: 'INTERNAL_ERROR', message: 'Error de servidor' } },
            { status: 500 },
          );
        }
        return HttpResponse.json<ListRolesResponse>({ items: predefinedRoles });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<RolesPage />);

    await waitFor(() => {
      expect(screen.getByText('Error al cargar los datos')).toBeInTheDocument();
    });

    const retryButton = screen.getByRole('button', { name: /reintentar/i });
    expect(retryButton).toBeInTheDocument();

    await user.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('Administrador')).toBeInTheDocument();
    });
  });

  it('shows a permission message on 403', async () => {
    server.use(
      http.get('http://localhost:3000/roles', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'FORBIDDEN',
              message: 'No tienes permiso para ver los roles.',
            },
          },
          { status: 403 },
        );
      }),
    );

    renderWithProviders(<RolesPage />);

    await waitFor(() => {
      expect(screen.getByText('Acceso restringido')).toBeInTheDocument();
    });
    expect(screen.getByText('No tienes permiso para ver los roles.')).toBeInTheDocument();
  });

  it('edit links are labelled with the role name', async () => {
    server.use(
      http.get('http://localhost:3000/roles', () => {
        return HttpResponse.json<ListRolesResponse>({ items: predefinedRoles });
      }),
    );

    renderWithProviders(<RolesPage />);

    await waitFor(() => {
      expect(screen.getByText('Administrador')).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: 'Editar rol Administrador' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Editar rol Docente' })).toBeInTheDocument();
  });
});
