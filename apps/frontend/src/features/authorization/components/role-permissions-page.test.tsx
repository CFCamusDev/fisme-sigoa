import * as React from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { PROTECTED_ROLE_CODE, type PermissionDto, type RoleDto } from '@sigoa/shared';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { RolePermissionsPage } from './role-permissions-page';

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

const mockRole: RoleDto = {
  id: 'role-123',
  code: 'DOCENTE',
  name: 'Docente Evaluador',
  description: 'Docente evaluador',
  isPredefined: false,
  status: 'ACTIVE',
  deactivatedAt: null,
  userCount: 4,
  permissions: [{ permissionCode: 'usuario.ver', scope: 'GLOBAL' }],
  updatedAt: '2026-11-06T12:00:00.000Z',
};

function setupMswHandlers(options?: {
  rolesStatus?: number;
  permissionsStatus?: number;
  rolesData?: RoleDto[];
  permissionsData?: PermissionDto[];
}) {
  server.use(
    http.get('http://localhost:3000/roles', () => {
      if (options?.rolesStatus && options.rolesStatus !== 200) {
        return HttpResponse.json(
          {
            error: {
              code: options.rolesStatus === 403 ? 'FORBIDDEN' : 'INTERNAL_SERVER_ERROR',
              message: 'Error en roles',
            },
          },
          { status: options.rolesStatus },
        );
      }
      return HttpResponse.json({ items: options?.rolesData ?? [mockRole] });
    }),
    http.get('http://localhost:3000/permissions', () => {
      if (options?.permissionsStatus && options.permissionsStatus !== 200) {
        return HttpResponse.json(
          {
            error: {
              code: options.permissionsStatus === 403 ? 'FORBIDDEN' : 'INTERNAL_SERVER_ERROR',
              message: 'Error en catálogo de permisos',
            },
          },
          { status: options.permissionsStatus },
        );
      }
      return HttpResponse.json({ items: options?.permissionsData ?? mockCatalog });
    }),
  );
}

describe('RolePermissionsPage component (T-006-22c)', () => {
  it('shows a loading state', async () => {
    let resolveRequest: () => void;
    const requestPromise = new Promise<void>((resolve) => {
      resolveRequest = resolve;
    });

    server.use(
      http.get('http://localhost:3000/roles', async () => {
        await requestPromise;
        return HttpResponse.json({ items: [mockRole] });
      }),
      http.get('http://localhost:3000/permissions', async () => {
        await requestPromise;
        return HttpResponse.json({ items: mockCatalog });
      }),
    );

    renderWithProviders(<RolePermissionsPage roleId="role-123" />);

    const loadingSpans = await screen.findAllByText('Cargando permisos del rol...');
    expect(loadingSpans.length).toBeGreaterThan(0);
    resolveRequest!();
  });

  it('loads the role and the catalog', async () => {
    setupMswHandlers();

    renderWithProviders(<RolePermissionsPage roleId="role-123" />);

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Permisos del rol: Docente Evaluador',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Los cambios se aplican en la siguiente petición de los 4 usuarios que tienen este rol.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'M01 Seguridad' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { level: 2, name: 'M02 Catálogo' }),
    ).not.toBeInTheDocument();
    const moduleNav = screen.getByRole('navigation', { name: 'Módulos de permisos' });
    expect(within(moduleNav).getByRole('button', { name: /M01 Seguridad/i })).toHaveTextContent(
      '1/2',
    );
    expect(within(moduleNav).getByRole('button', { name: /M02 Catálogo/i })).toHaveTextContent(
      '0/1',
    );
  });

  it('shows not found for an unknown role', async () => {
    setupMswHandlers();

    renderWithProviders(<RolePermissionsPage roleId="non-existent-id" />);

    expect(await screen.findByText('No se encontró el rol')).toBeInTheDocument();
    expect(
      screen.getByText('El rol solicitado no existe o fue eliminado del sistema.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a roles' })).toBeInTheDocument();
  });

  it('shows an error with retry', async () => {
    setupMswHandlers({ rolesStatus: 500 });

    renderWithProviders(<RolePermissionsPage roleId="role-123" />);

    expect(await screen.findByText('Error al cargar datos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('shows a permission message on 403', async () => {
    setupMswHandlers({ rolesStatus: 403 });

    renderWithProviders(<RolePermissionsPage roleId="role-123" />);

    expect(await screen.findByText('Acceso restringido')).toBeInTheDocument();
    expect(
      screen.getByText('No tienes permiso para ver o modificar los permisos de este rol.'),
    ).toBeInTheDocument();
  });

  it('sends the full permission set and shows success', async () => {
    const user = userEvent.setup();
    let capturedBody: unknown = null;

    setupMswHandlers();
    server.use(
      http.put('http://localhost:3000/roles/role-123/permissions', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(mockRole, { status: 200 });
      }),
    );

    renderWithProviders(<RolePermissionsPage roleId="role-123" />);

    await screen.findByRole('heading', {
      level: 1,
      name: 'Permisos del rol: Docente Evaluador',
    });

    // Cambiamos al módulo M02 Catálogo y modificamos catalogo.ver a GLOBAL
    const moduleNav = screen.getByRole('navigation', { name: 'Módulos de permisos' });
    await user.click(within(moduleNav).getByRole('button', { name: /M02 Catálogo/i }));
    const catalogoSelect = screen.getByRole('combobox', { name: 'Acceso a catalogo.ver' });
    await user.selectOptions(catalogoSelect, 'GLOBAL');

    const saveButton = screen.getByRole('button', { name: 'Guardar cambios' });
    await user.click(saveButton);

    expect(await screen.findByText('Los permisos se guardaron exitosamente.')).toBeInTheDocument();

    expect(capturedBody).toEqual({
      permissions: [
        { permissionCode: 'catalogo.ver', scope: 'GLOBAL' },
        { permissionCode: 'usuario.ver', scope: 'GLOBAL' },
      ],
    });
  });

  it('shows the server error on 409', async () => {
    const user = userEvent.setup();

    setupMswHandlers();
    server.use(
      http.put('http://localhost:3000/roles/role-123/permissions', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'CONFLICT',
              message: 'El rol Administrador debe conservar los permisos requeridos.',
            },
          },
          { status: 409 },
        );
      }),
    );

    renderWithProviders(<RolePermissionsPage roleId="role-123" />);

    await screen.findByRole('heading', {
      level: 1,
      name: 'Permisos del rol: Docente Evaluador',
    });

    const moduleNav = screen.getByRole('navigation', { name: 'Módulos de permisos' });
    await user.click(within(moduleNav).getByRole('button', { name: /M02 Catálogo/i }));
    const catalogoSelect = screen.getByRole('combobox', { name: 'Acceso a catalogo.ver' });
    await user.selectOptions(catalogoSelect, 'GLOBAL');

    const saveButton = screen.getByRole('button', { name: 'Guardar cambios' });
    await user.click(saveButton);

    expect(
      await screen.findByText('El rol Administrador debe conservar los permisos requeridos.'),
    ).toBeInTheDocument();
  });

  it('links back to the roles list', async () => {
    setupMswHandlers();

    renderWithProviders(<RolePermissionsPage roleId="role-123" />);

    await screen.findByRole('heading', {
      level: 1,
      name: 'Permisos del rol: Docente Evaluador',
    });

    const backLink = screen.getByRole('link', { name: 'Volver a roles' });
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute('href', '/roles');
  });

  it('loads the roles and the catalog once each under StrictMode', async () => {
    let rolesCalls = 0;
    let catalogCalls = 0;

    server.use(
      http.get('http://localhost:3000/roles', () => {
        rolesCalls++;
        return HttpResponse.json({ items: [mockRole] });
      }),
      http.get('http://localhost:3000/permissions', () => {
        catalogCalls++;
        return HttpResponse.json({ items: mockCatalog });
      }),
    );

    renderWithProviders(
      <React.StrictMode>
        <RolePermissionsPage roleId="role-123" />
      </React.StrictMode>,
    );

    await screen.findByRole('heading', {
      level: 1,
      name: 'Permisos del rol: Docente Evaluador',
    });

    // TanStack Query deduplica peticiones en vuelo con la misma clave
    expect(rolesCalls).toBe(1);
    expect(catalogCalls).toBe(1);
  });

  it('validates ?module= against the catalog', async () => {
    setupMswHandlers();

    const { unmount } = renderWithProviders(<RolePermissionsPage roleId="role-123" />, {
      initialEntries: ['/roles/role-123/permisos?module=M02%20Catálogo'],
    });

    expect(
      await screen.findByRole('heading', { level: 2, name: 'M02 Catálogo' }),
    ).toBeInTheDocument();
    unmount();

    renderWithProviders(<RolePermissionsPage roleId="role-123" />, {
      initialEntries: ['/roles/role-123/permisos?module=Inexistente'],
    });

    expect(
      await screen.findByRole('heading', { level: 2, name: 'M01 Seguridad' }),
    ).toBeInTheDocument();
  });

  it('searches across modules', async () => {
    const user = userEvent.setup();
    setupMswHandlers();

    renderWithProviders(<RolePermissionsPage roleId="role-123" />);

    await screen.findByRole('heading', { level: 2, name: 'M01 Seguridad' });
    await user.type(screen.getByLabelText('Buscar permisos'), 'catálogo');

    expect(screen.getByRole('heading', { level: 2, name: 'M02 Catálogo' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { level: 2, name: 'M01 Seguridad' }),
    ).not.toBeInTheDocument();
  });

  it('keeps protected permissions of the administrator role', async () => {
    const adminRole: RoleDto = {
      ...mockRole,
      id: 'role-admin',
      code: PROTECTED_ROLE_CODE,
      name: 'Administrador',
      permissions: [
        { permissionCode: 'rol.ver', scope: 'GLOBAL' },
        { permissionCode: 'rol.editar', scope: 'GLOBAL' },
      ],
    };
    const adminCatalog: PermissionDto[] = [
      ...mockCatalog,
      { code: 'rol.ver', description: 'Ver roles', module: 'M01 Seguridad' },
      { code: 'rol.editar', description: 'Editar roles', module: 'M01 Seguridad' },
    ];
    setupMswHandlers({ rolesData: [adminRole], permissionsData: adminCatalog });

    renderWithProviders(<RolePermissionsPage roleId="role-admin" />);

    expect(await screen.findByRole('combobox', { name: 'Acceso a rol.ver' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Acceso a rol.editar' })).toBeDisabled();
  });

  it('saves from the sticky bar', async () => {
    const user = userEvent.setup();
    setupMswHandlers();
    server.use(
      http.put('http://localhost:3000/roles/role-123/permissions', () =>
        HttpResponse.json(mockRole, { status: 200 }),
      ),
    );

    renderWithProviders(<RolePermissionsPage roleId="role-123" />);

    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Acceso a usuario.crear' }),
      'OWN',
    );
    const stickyBar = screen.getByTestId('sticky-action-bar');
    expect(stickyBar).toHaveTextContent('1 cambio sin guardar');
    await user.click(within(stickyBar).getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText('Los permisos se guardaron exitosamente.')).toBeInTheDocument();
  });
});
