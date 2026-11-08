import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import type { PermissionDto, RoleDto, UserAccessDto } from '@sigoa/shared';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { useAuthStore } from '@/stores/auth.store';
import { UserAccessPanel } from './user-access-panel';

const mockCatalog: PermissionDto[] = [
  {
    code: 'usuario.ver',
    description: 'Ver usuarios',
    module: 'M01 Seguridad',
  },
  {
    code: 'usuario.crear',
    description: 'Crear usuarios',
    module: 'M01 Seguridad',
  },
  {
    code: 'catalogo.ver',
    description: 'Ver catálogo OE/AG',
    module: 'M02 Catálogo',
  },
];

const mockRoles: RoleDto[] = [
  {
    id: 'role-admin',
    code: 'ADMINISTRATOR',
    name: 'Administrador',
    description: 'Acceso total',
    isPredefined: true,
    status: 'ACTIVE',
    deactivatedAt: null,
    userCount: 2,
    permissions: [{ permissionCode: 'usuario.ver', scope: 'GLOBAL' }],
    updatedAt: '2026-11-06T12:00:00.000Z',
  },
  {
    id: 'role-teacher',
    code: 'TEACHER',
    name: 'Docente',
    description: 'Docente del programa',
    isPredefined: true,
    status: 'ACTIVE',
    deactivatedAt: null,
    userCount: 10,
    permissions: [{ permissionCode: 'catalogo.ver', scope: 'OWN' }],
    updatedAt: '2026-11-06T12:00:00.000Z',
  },
];

const mockUserAccess: UserAccessDto = {
  userId: 'usr-123',
  roles: [
    {
      id: 'role-teacher',
      code: 'TEACHER',
      name: 'Docente',
      status: 'ACTIVE',
    },
  ],
  directPermissions: [
    {
      permissionCode: 'usuario.ver',
      scope: 'OWN',
    },
  ],
  effectivePermissions: [
    {
      permissionCode: 'catalogo.ver',
      scope: 'OWN',
      sources: [
        {
          kind: 'ROLE',
          roleId: 'role-teacher',
          roleCode: 'TEACHER',
          roleName: 'Docente',
          scope: 'OWN',
        },
      ],
    },
    {
      permissionCode: 'usuario.ver',
      scope: 'OWN',
      sources: [{ kind: 'DIRECT', scope: 'OWN' }],
    },
  ],
};

function setupDefaultMsw() {
  server.use(
    http.get('http://localhost:3000/users/usr-123/effective-permissions', () => {
      return HttpResponse.json(mockUserAccess);
    }),
    http.get('http://localhost:3000/roles', () => {
      return HttpResponse.json({ items: mockRoles });
    }),
    http.get('http://localhost:3000/permissions', () => {
      return HttpResponse.json({ items: mockCatalog });
    }),
  );
}

describe('UserAccessPanel component (T-007-16)', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuthSession();
  });

  afterEach(() => {
    useAuthStore.getState().clearAuthSession();
  });

  it('shows loading state while fetching user access', async () => {
    let resolveAccess: () => void;
    const accessPromise = new Promise<void>((resolve) => {
      resolveAccess = resolve;
    });

    server.use(
      http.get('http://localhost:3000/users/usr-123/effective-permissions', async () => {
        await accessPromise;
        return HttpResponse.json(mockUserAccess);
      }),
      http.get('http://localhost:3000/roles', () => HttpResponse.json({ items: mockRoles })),
      http.get('http://localhost:3000/permissions', () =>
        HttpResponse.json({ items: mockCatalog }),
      ),
    );

    renderWithProviders(<UserAccessPanel userId="usr-123" />);

    const loadingSpans = await screen.findAllByText('Cargando accesos del usuario...');
    expect(loadingSpans.length).toBeGreaterThan(0);
    resolveAccess!();
    expect(await screen.findByRole('heading', { name: 'Roles asignados' })).toBeInTheDocument();
  });

  it('shows not found error state for a 404 response', async () => {
    server.use(
      http.get('http://localhost:3000/users/usr-404/effective-permissions', () => {
        return HttpResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Usuario no encontrado' } },
          { status: 404 },
        );
      }),
      http.get('http://localhost:3000/roles', () => HttpResponse.json({ items: mockRoles })),
      http.get('http://localhost:3000/permissions', () =>
        HttpResponse.json({ items: mockCatalog }),
      ),
    );

    renderWithProviders(<UserAccessPanel userId="usr-404" />);

    expect(await screen.findByText('Usuario no encontrado')).toBeInTheDocument();
  });

  it('shows forbidden error state for a 403 response', async () => {
    server.use(
      http.get('http://localhost:3000/users/usr-403/effective-permissions', () => {
        return HttpResponse.json(
          { error: { code: 'FORBIDDEN', message: 'No tienes permiso' } },
          { status: 403 },
        );
      }),
      http.get('http://localhost:3000/roles', () => HttpResponse.json({ items: mockRoles })),
      http.get('http://localhost:3000/permissions', () =>
        HttpResponse.json({ items: mockCatalog }),
      ),
    );

    renderWithProviders(<UserAccessPanel userId="usr-403" />);

    expect(await screen.findByText('Acceso restringido')).toBeInTheDocument();
    expect(
      screen.getByText('No tienes permiso para ver los accesos de este usuario.'),
    ).toBeInTheDocument();
  });

  it('shows generic error state with retry on server failure', async () => {
    let callCount = 0;
    server.use(
      http.get('http://localhost:3000/users/usr-err/effective-permissions', () => {
        callCount++;
        if (callCount === 1) {
          return HttpResponse.json(
            { error: { code: 'INTERNAL_ERROR', message: 'Falla interna' } },
            { status: 500 },
          );
        }
        return HttpResponse.json({ ...mockUserAccess, userId: 'usr-err' });
      }),
      http.get('http://localhost:3000/roles', () => HttpResponse.json({ items: mockRoles })),
      http.get('http://localhost:3000/permissions', () =>
        HttpResponse.json({ items: mockCatalog }),
      ),
    );

    const user = userEvent.setup();
    renderWithProviders(<UserAccessPanel userId="usr-err" />);

    expect(await screen.findByText('Error al cargar accesos')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /reintentar/i });
    await user.click(retryBtn);

    expect(await screen.findByRole('heading', { name: 'Roles asignados' })).toBeInTheDocument();
  });

  it('shows warning banner when the user edits their own access (D21)', async () => {
    setupDefaultMsw();

    useAuthStore.getState().setAuthSession({
      accessToken: 'token-123',
      accessTokenExpiresAt: new Date(Date.now() + 60000).toISOString(),
      refreshTokenExpiresAt: new Date(Date.now() + 3600000).toISOString(),
      user: {
        id: 'usr-123',
        email: 'admin@unterm.edu.pe',
        names: 'Admin',
        firstSurname: 'User',
        secondSurname: null,
      },
    });

    renderWithProviders(<UserAccessPanel userId="usr-123" />);

    expect(
      await screen.findByText(
        'Estás editando tus propios accesos; si los reduces podrías perder el acceso a esta pantalla.',
      ),
    ).toBeInTheDocument();
  });

  it('does not show warning banner when editing another user', async () => {
    setupDefaultMsw();

    useAuthStore.getState().setAuthSession({
      accessToken: 'token-123',
      accessTokenExpiresAt: new Date(Date.now() + 60000).toISOString(),
      refreshTokenExpiresAt: new Date(Date.now() + 3600000).toISOString(),
      user: {
        id: 'usr-admin',
        email: 'admin@unterm.edu.pe',
        names: 'Admin',
        firstSurname: 'User',
        secondSurname: null,
      },
    });

    renderWithProviders(<UserAccessPanel userId="usr-123" />);

    await screen.findByRole('heading', { name: 'Roles asignados' });
    expect(
      screen.queryByText(
        'Estás editando tus propios accesos; si los reduces podrías perder el acceso a esta pantalla.',
      ),
    ).not.toBeInTheDocument();
  });

  it('renders roles, direct permissions and effective permissions sections', async () => {
    setupDefaultMsw();

    renderWithProviders(<UserAccessPanel userId="usr-123" />);

    expect(await screen.findByRole('heading', { name: 'Roles asignados' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Permisos directos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Permisos efectivos' })).toBeInTheDocument();

    // Roles cargados
    expect(screen.getByText('Administrador')).toBeInTheDocument();
    expect(screen.getByText('Docente')).toBeInTheDocument();

    // Permisos directos y efectivos
    expect(screen.getAllByText('M01 Seguridad').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('M02 Catálogo').length).toBeGreaterThanOrEqual(1);
  });

  it('disables both save buttons and controls while one save mutation is in flight (D16)', async () => {
    let resolveSave: () => void;
    const savePromise = new Promise<void>((resolve) => {
      resolveSave = resolve;
    });

    server.use(
      http.get('http://localhost:3000/users/usr-123/effective-permissions', () =>
        HttpResponse.json(mockUserAccess),
      ),
      http.get('http://localhost:3000/roles', () => HttpResponse.json({ items: mockRoles })),
      http.get('http://localhost:3000/permissions', () =>
        HttpResponse.json({ items: mockCatalog }),
      ),
      http.put('http://localhost:3000/users/usr-123/roles', async () => {
        await savePromise;
        return HttpResponse.json({
          ...mockUserAccess,
          roles: [
            ...mockUserAccess.roles,
            { id: 'role-admin', code: 'ADMINISTRATOR', name: 'Administrador', status: 'ACTIVE' },
          ],
        });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<UserAccessPanel userId="usr-123" />);

    await screen.findByRole('heading', { name: 'Roles asignados' });

    // Modificar un rol para habilitar Guardar roles
    const adminCheckbox = screen.getByLabelText(/Administrador/i);
    await user.click(adminCheckbox);

    const saveRolesBtn = screen.getByRole('button', { name: 'Guardar roles' });
    const savePermsBtn = screen.getByRole('button', { name: 'Guardar permisos directos' });

    expect(saveRolesBtn).not.toBeDisabled();
    // Guardar permisos directos está deshabilitado por falta de cambios
    expect(savePermsBtn).toBeDisabled();

    // Disparar guardado de roles
    await user.click(saveRolesBtn);

    // Mientras la mutación está en vuelo, isBusy es verdadero
    await waitFor(() => {
      const busyButtons = screen.getAllByRole('button', { name: 'Guardando…' });
      expect(busyButtons.length).toBe(2);
      expect(busyButtons[0]).toBeDisabled();
      expect(busyButtons[1]).toBeDisabled();
    });

    // Resolver la mutación
    resolveSave!();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Guardar roles' })).toBeInTheDocument();
    });
  });

  it('sends one request when save roles is double clicked', async () => {
    let putCount = 0;
    let resolvePut: () => void;
    const putPromise = new Promise<void>((resolve) => {
      resolvePut = resolve;
    });

    server.use(
      http.get('http://localhost:3000/users/usr-123/effective-permissions', () =>
        HttpResponse.json(mockUserAccess),
      ),
      http.get('http://localhost:3000/roles', () => HttpResponse.json({ items: mockRoles })),
      http.get('http://localhost:3000/permissions', () =>
        HttpResponse.json({ items: mockCatalog }),
      ),
      http.put('http://localhost:3000/users/usr-123/roles', async () => {
        putCount++;
        await putPromise;
        return HttpResponse.json(mockUserAccess);
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<UserAccessPanel userId="usr-123" />);

    await screen.findByRole('heading', { name: 'Roles asignados' });

    const adminCheckbox = screen.getByLabelText(/Administrador/i);
    await user.click(adminCheckbox);

    const saveRolesBtn = screen.getByRole('button', { name: 'Guardar roles' });
    // Primer click
    await user.click(saveRolesBtn);
    // Segundo click mientras la petición está en vuelo
    await user.click(saveRolesBtn);

    resolvePut!();

    await waitFor(() => {
      expect(screen.getByText('Roles actualizados correctamente.')).toBeInTheDocument();
    });

    expect(putCount).toBe(1);
  });

  it('sends one request when save direct permissions is double clicked', async () => {
    let putCount = 0;
    let resolvePut: () => void;
    const putPromise = new Promise<void>((resolve) => {
      resolvePut = resolve;
    });

    server.use(
      http.get('http://localhost:3000/users/usr-123/effective-permissions', () =>
        HttpResponse.json(mockUserAccess),
      ),
      http.get('http://localhost:3000/roles', () => HttpResponse.json({ items: mockRoles })),
      http.get('http://localhost:3000/permissions', () =>
        HttpResponse.json({ items: mockCatalog }),
      ),
      http.put('http://localhost:3000/users/usr-123/permissions', async () => {
        putCount++;
        await putPromise;
        return HttpResponse.json(mockUserAccess);
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<UserAccessPanel userId="usr-123" />);

    await screen.findByRole('heading', { name: 'Permisos directos' });

    // Modificar un select de alcance para habilitar el guardado de directos
    const select = screen.getByLabelText('Acceso a usuario.crear');
    await user.selectOptions(select, 'GLOBAL');

    const savePermsBtn = screen.getByRole('button', { name: 'Guardar permisos directos' });
    await user.click(savePermsBtn);
    await user.click(savePermsBtn);

    resolvePut!();

    await waitFor(() => {
      expect(screen.getByText('Permisos directos actualizados correctamente.')).toBeInTheDocument();
    });

    expect(putCount).toBe(1);
  });

  it('shows server error message when roles mutation fails (e.g. 409 last admin conflict)', async () => {
    server.use(
      http.get('http://localhost:3000/users/usr-123/effective-permissions', () =>
        HttpResponse.json(mockUserAccess),
      ),
      http.get('http://localhost:3000/roles', () => HttpResponse.json({ items: mockRoles })),
      http.get('http://localhost:3000/permissions', () =>
        HttpResponse.json({ items: mockCatalog }),
      ),
      http.put('http://localhost:3000/users/usr-123/roles', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'CONFLICT',
              message: 'No se puede revocar el rol al último administrador activo del sistema.',
            },
          },
          { status: 409 },
        );
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<UserAccessPanel userId="usr-123" />);

    await screen.findByRole('heading', { name: 'Roles asignados' });

    // Modificar roles
    const adminCheckbox = screen.getByLabelText(/Administrador/i);
    await user.click(adminCheckbox);

    const saveRolesBtn = screen.getByRole('button', { name: 'Guardar roles' });
    await user.click(saveRolesBtn);

    expect(
      await screen.findByText(
        'No se puede revocar el rol al último administrador activo del sistema.',
      ),
    ).toBeInTheDocument();
  });

  describe('Full flows and CA acceptance criteria (T-007-27)', () => {
    it('refreshes the effective view with the union after assigning two roles and a direct permission (CA1)', async () => {
      let currentAccess: UserAccessDto = {
        userId: 'usr-123',
        roles: [
          {
            id: 'role-teacher',
            code: 'TEACHER',
            name: 'Docente',
            status: 'ACTIVE',
          },
        ],
        directPermissions: [],
        effectivePermissions: [
          {
            permissionCode: 'catalogo.ver',
            scope: 'OWN',
            sources: [
              {
                kind: 'ROLE',
                roleId: 'role-teacher',
                roleCode: 'TEACHER',
                roleName: 'Docente',
                scope: 'OWN',
              },
            ],
          },
        ],
      };

      server.use(
        http.get('http://localhost:3000/users/usr-123/effective-permissions', () => {
          return HttpResponse.json(currentAccess);
        }),
        http.get('http://localhost:3000/roles', () => HttpResponse.json({ items: mockRoles })),
        http.get('http://localhost:3000/permissions', () =>
          HttpResponse.json({ items: mockCatalog }),
        ),
        http.put('http://localhost:3000/users/usr-123/roles', () => {
          currentAccess = {
            ...currentAccess,
            roles: [
              {
                id: 'role-admin',
                code: 'ADMINISTRATOR',
                name: 'Administrador',
                status: 'ACTIVE',
              },
              {
                id: 'role-teacher',
                code: 'TEACHER',
                name: 'Docente',
                status: 'ACTIVE',
              },
            ],
            effectivePermissions: [
              {
                permissionCode: 'catalogo.ver',
                scope: 'OWN',
                sources: [
                  {
                    kind: 'ROLE',
                    roleId: 'role-teacher',
                    roleCode: 'TEACHER',
                    roleName: 'Docente',
                    scope: 'OWN',
                  },
                ],
              },
              {
                permissionCode: 'usuario.ver',
                scope: 'GLOBAL',
                sources: [
                  {
                    kind: 'ROLE',
                    roleId: 'role-admin',
                    roleCode: 'ADMINISTRATOR',
                    roleName: 'Administrador',
                    scope: 'GLOBAL',
                  },
                ],
              },
            ],
          };
          return HttpResponse.json(currentAccess);
        }),
        http.put('http://localhost:3000/users/usr-123/permissions', () => {
          currentAccess = {
            ...currentAccess,
            directPermissions: [
              {
                permissionCode: 'usuario.crear',
                scope: 'GLOBAL',
              },
            ],
            effectivePermissions: [
              ...currentAccess.effectivePermissions,
              {
                permissionCode: 'usuario.crear',
                scope: 'GLOBAL',
                sources: [{ kind: 'DIRECT', scope: 'GLOBAL' }],
              },
            ],
          };
          return HttpResponse.json(currentAccess);
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(<UserAccessPanel userId="usr-123" />);

      await screen.findByRole('heading', { name: 'Roles asignados' });

      // Asignar segundo rol: Administrador
      const adminCheckbox = screen.getByLabelText(/Administrador/i);
      await user.click(adminCheckbox);

      const saveRolesBtn = screen.getByRole('button', { name: 'Guardar roles' });
      await user.click(saveRolesBtn);

      expect(await screen.findByText('Roles actualizados correctamente.')).toBeInTheDocument();

      // Asignar permiso directo: usuario.crear -> GLOBAL
      const select = screen.getByLabelText('Acceso a usuario.crear');
      await user.selectOptions(select, 'GLOBAL');

      const savePermsBtn = screen.getByRole('button', { name: 'Guardar permisos directos' });
      await user.click(savePermsBtn);

      expect(
        await screen.findByText('Permisos directos actualizados correctamente.'),
      ).toBeInTheDocument();

      // Verificar que la vista de permisos efectivos refleja la unión
      await waitFor(() => {
        expect(screen.getAllByText('Crear usuarios').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Ver usuarios').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Ver catálogo OE/AG').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('shows a direct OWN permission as Propio in the effective view (CA2)', async () => {
      let currentAccess: UserAccessDto = {
        userId: 'usr-123',
        roles: [
          {
            id: 'role-teacher',
            code: 'TEACHER',
            name: 'Docente',
            status: 'ACTIVE',
          },
        ],
        directPermissions: [],
        effectivePermissions: [],
      };

      server.use(
        http.get('http://localhost:3000/users/usr-123/effective-permissions', () => {
          return HttpResponse.json(currentAccess);
        }),
        http.get('http://localhost:3000/roles', () => HttpResponse.json({ items: mockRoles })),
        http.get('http://localhost:3000/permissions', () =>
          HttpResponse.json({ items: mockCatalog }),
        ),
        http.put('http://localhost:3000/users/usr-123/permissions', () => {
          currentAccess = {
            ...currentAccess,
            directPermissions: [
              {
                permissionCode: 'usuario.ver',
                scope: 'OWN',
              },
            ],
            effectivePermissions: [
              {
                permissionCode: 'usuario.ver',
                scope: 'OWN',
                sources: [{ kind: 'DIRECT', scope: 'OWN' }],
              },
            ],
          };
          return HttpResponse.json(currentAccess);
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(<UserAccessPanel userId="usr-123" />);

      await screen.findByRole('heading', { name: 'Permisos directos' });

      const select = screen.getByLabelText('Acceso a usuario.ver');
      await user.selectOptions(select, 'OWN');

      const savePermsBtn = screen.getByRole('button', { name: 'Guardar permisos directos' });
      await user.click(savePermsBtn);

      expect(
        await screen.findByText('Permisos directos actualizados correctamente.'),
      ).toBeInTheDocument();

      // En la vista efectiva debe aparecer con "Propio" y etiqueta de origen "Directo · Propio"
      await waitFor(() => {
        expect(screen.getAllByText('Propio').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Directo · Propio')).toBeInTheDocument();
      });
    });

    it('keeps the draft and controls state when a save operation fails', async () => {
      server.use(
        http.get('http://localhost:3000/users/usr-123/effective-permissions', () =>
          HttpResponse.json(mockUserAccess),
        ),
        http.get('http://localhost:3000/roles', () => HttpResponse.json({ items: mockRoles })),
        http.get('http://localhost:3000/permissions', () =>
          HttpResponse.json({ items: mockCatalog }),
        ),
        http.put('http://localhost:3000/users/usr-123/roles', () => {
          return HttpResponse.json(
            {
              error: {
                code: 'CONFLICT',
                message: 'Conflicto al guardar roles.',
              },
            },
            { status: 409 },
          );
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(<UserAccessPanel userId="usr-123" />);

      await screen.findByRole('heading', { name: 'Roles asignados' });

      const adminCheckbox = screen.getByLabelText(/Administrador/i);
      await user.click(adminCheckbox);

      expect(screen.getByText('1 cambio sin guardar')).toBeInTheDocument();

      const saveRolesBtn = screen.getByRole('button', { name: 'Guardar roles' });
      await user.click(saveRolesBtn);

      // Muestra el mensaje de error y conserva la selección y el borrador sin descartarlo
      expect(await screen.findByText('Conflicto al guardar roles.')).toBeInTheDocument();
      expect(adminCheckbox).toBeChecked();
      expect(screen.getByText('1 cambio sin guardar')).toBeInTheDocument();
    });
  });
});
