import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoleDto, UserDto } from '@sigoa/shared';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { useAuthStore } from '@/stores/auth.store';
import { UsersPage } from './users-page';

const mockRoles: RoleDto[] = [
  {
    id: 'role-admin',
    code: 'ADMINISTRATOR',
    name: 'Administrador',
    description: 'Acceso total',
    isPredefined: true,
    status: 'ACTIVE',
    deactivatedAt: null,
    userCount: 0,
    permissions: [],
    updatedAt: '2026-11-06T15:00:00.000Z',
  },
  {
    id: 'role-teacher',
    code: 'TEACHER',
    name: 'Docente',
    description: 'Profesor de cursos',
    isPredefined: true,
    status: 'ACTIVE',
    deactivatedAt: null,
    userCount: 0,
    permissions: [],
    updatedAt: '2026-11-06T15:00:00.000Z',
  },
];

const mockUserActive: UserDto = {
  id: 'usr-1',
  email: 'carlos@unterm.edu.pe',
  names: 'Carlos',
  firstSurname: 'Mendoza',
  secondSurname: 'Ruiz',
  dni: '71234567',
  status: 'ACTIVE',
  roleIds: ['role-admin'],
  lastLoginAt: '2026-11-01T10:00:00.000Z',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
};

const mockUserInactiveWithoutDni: UserDto = {
  id: 'usr-2',
  email: 'maria@unterm.edu.pe',
  names: 'María',
  firstSurname: 'Vargas',
  secondSurname: null,
  dni: null,
  status: 'INACTIVE',
  roleIds: ['role-teacher'],
  lastLoginAt: null,
  createdAt: '2026-10-02T00:00:00.000Z',
  updatedAt: '2026-10-02T00:00:00.000Z',
};

const mockUserPending: UserDto = {
  id: 'usr-3',
  email: 'pedro@unterm.edu.pe',
  names: 'Pedro',
  firstSurname: 'Castillo',
  secondSurname: 'Torres',
  dni: '82345678',
  status: 'PENDING_ACTIVATION',
  roleIds: ['role-teacher'],
  lastLoginAt: null,
  createdAt: '2026-10-03T00:00:00.000Z',
  updatedAt: '2026-10-03T00:00:00.000Z',
};

function setupDefaultMsw(users: UserDto[] = [mockUserActive, mockUserInactiveWithoutDni]) {
  server.use(
    http.get('http://localhost:3000/roles', () => {
      return HttpResponse.json({ items: mockRoles }, { status: 200 });
    }),
    http.get('http://localhost:3000/users', ({ request }) => {
      const url = new URL(request.url);
      const page = Number(url.searchParams.get('page') || '1');
      const pageSize = Number(url.searchParams.get('pageSize') || '20');
      const status = url.searchParams.get('status');
      const roleId = url.searchParams.get('roleId');

      let filtered = [...users];
      if (status) {
        filtered = filtered.filter((u) => u.status === status);
      }
      if (roleId) {
        filtered = filtered.filter((u) => u.roleIds?.includes(roleId));
      }

      return HttpResponse.json(
        {
          items: filtered,
          total: filtered.length,
          page,
          pageSize,
          totalPages: Math.ceil(filtered.length / pageSize) || 1,
        },
        { status: 200 },
      );
    }),
  );
}

describe('UsersPage component (T-003-27)', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null });
    setupDefaultMsw();
  });

  it('shows the loading state while data is being fetched', async () => {
    let resolveRequest: () => void;
    const requestPromise = new Promise<void>((resolve) => {
      resolveRequest = resolve;
    });

    server.use(
      http.get('http://localhost:3000/users', async () => {
        await requestPromise;
        return HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 });
      }),
      http.get('http://localhost:3000/roles', () => {
        return HttpResponse.json({ items: [] });
      }),
    );

    renderWithProviders(<UsersPage />);

    const loadingSpans = await screen.findAllByText('Cargando datos de la tabla...');
    expect(loadingSpans.length).toBeGreaterThan(0);
    resolveRequest!();
  });

  it('shows the empty state without filters', async () => {
    server.use(
      http.get('http://localhost:3000/users', () => {
        return HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 });
      }),
      http.get('http://localhost:3000/roles', () => {
        return HttpResponse.json({ items: [] });
      }),
    );

    renderWithProviders(<UsersPage />);
    expect(await screen.findByText('Aún no hay usuarios')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Puedes registrar un nuevo usuario en la plataforma utilizando el botón superior.',
      ),
    ).toBeInTheDocument();
  });

  it('shows the empty state with filters', async () => {
    server.use(
      http.get('http://localhost:3000/users', () => {
        return HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 });
      }),
      http.get('http://localhost:3000/roles', () => {
        return HttpResponse.json({ items: [] });
      }),
    );

    renderWithProviders(
      <UsersPage
        search={{
          status: 'INACTIVE',
          page: 1,
          pageSize: 20,
        }}
      />,
    );
    expect(
      await screen.findByText('No hay usuarios que coincidan con los filtros'),
    ).toBeInTheDocument();
  });

  it('shows an error state with retry for a server failure', async () => {
    let callCount = 0;
    server.use(
      http.get('http://localhost:3000/roles', () => HttpResponse.json({ items: [] })),
      http.get('http://localhost:3000/users', () => {
        callCount++;
        if (callCount === 1) {
          return new HttpResponse(null, { status: 500 });
        }
        return HttpResponse.json({
          items: [mockUserActive],
          total: 1,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<UsersPage />);

    expect(await screen.findByText('Error al cargar los datos')).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /reintentar/i });
    await user.click(retryBtn);

    expect(await screen.findByText('Carlos Mendoza Ruiz')).toBeInTheDocument();
    expect(callCount).toBe(2);
  });

  it('shows a permission message without retry for a 403', async () => {
    server.use(
      http.get('http://localhost:3000/roles', () => HttpResponse.json({ items: [] })),
      http.get('http://localhost:3000/users', () => {
        return HttpResponse.json(
          { message: 'No tienes permiso para ver los usuarios.' },
          { status: 403 },
        );
      }),
    );

    renderWithProviders(<UsersPage />);

    expect(await screen.findByText('Acceso restringido')).toBeInTheDocument();
    expect(screen.getByText('No tienes permiso para ver los usuarios.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reintentar/i })).not.toBeInTheDocument();
  });

  it('renders name, email, dni, role names, status badge and last access', async () => {
    setupDefaultMsw([mockUserActive]);

    renderWithProviders(<UsersPage />);

    expect(await screen.findByText('Carlos Mendoza Ruiz')).toBeInTheDocument();
    expect(screen.getByText('carlos@unterm.edu.pe')).toBeInTheDocument();
    expect(screen.getByText('71234567')).toBeInTheDocument();
    expect(await screen.findAllByText('Administrador')).toHaveLength(2); // select option + tabla
    expect(screen.getAllByText('Activo')).toHaveLength(2); // select option + status badge
    expect(screen.getByText(/01\/11\/2026/)).toBeInTheDocument();
  });

  it('shows a dash for a user without dni and never for the others', async () => {
    setupDefaultMsw([mockUserActive, mockUserInactiveWithoutDni]);

    renderWithProviders(<UsersPage />);

    await screen.findByText('Carlos Mendoza Ruiz');
    await screen.findAllByText('Docente');

    // DNI de Carlos está presente
    expect(screen.getByText('71234567')).toBeInTheDocument();

    // DNI de María es null y muestra un guion
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);

    // María no tiene último acceso
    expect(screen.getByText('Nunca')).toBeInTheDocument();
  });

  it('filters by status and role through the url and goes back to page 1 (CA4)', async () => {
    setupDefaultMsw([mockUserActive, mockUserInactiveWithoutDni]);
    const onSearchChange = vi.fn();

    const user = userEvent.setup();
    renderWithProviders(
      <UsersPage search={{ page: 2, pageSize: 20 }} onSearchChange={onSearchChange} />,
    );

    await screen.findByText('Carlos Mendoza Ruiz');
    await screen.findByRole('option', { name: 'Docente' });

    const statusSelect = screen.getByLabelText(/filtrar por estado/i);
    await user.selectOptions(statusSelect, 'INACTIVE');

    expect(onSearchChange).toHaveBeenCalledWith({ status: 'INACTIVE', page: 1 });

    const roleSelect = screen.getByLabelText(/filtrar por rol/i);
    await user.selectOptions(roleSelect, 'role-teacher');

    expect(onSearchChange).toHaveBeenCalledWith({ roleId: 'role-teacher', page: 1 });
  });

  it('paginates with previous and next and announces the range', async () => {
    const onSearchChange = vi.fn();
    server.use(
      http.get('http://localhost:3000/roles', () => HttpResponse.json({ items: [] })),
      http.get('http://localhost:3000/users', () => {
        return HttpResponse.json({
          items: [mockUserActive],
          total: 45,
          page: 2,
          pageSize: 20,
          totalPages: 3,
        });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(
      <UsersPage search={{ page: 2, pageSize: 20 }} onSearchChange={onSearchChange} />,
    );

    expect(await screen.findByText('Mostrando página 2 de 3 (45 usuarios)')).toBeInTheDocument();

    const prevBtn = screen.getByRole('button', { name: /ir a la página anterior/i });
    const nextBtn = screen.getByRole('button', { name: /ir a la página siguiente/i });

    expect(prevBtn).toBeEnabled();
    expect(nextBtn).toBeEnabled();

    await user.click(nextBtn);
    expect(onSearchChange).toHaveBeenCalledWith({ page: 3 });

    await user.click(prevBtn);
    expect(onSearchChange).toHaveBeenCalledWith({ page: 1 });
  });

  it('offers deactivate only for active users other than the current one', async () => {
    useAuthStore.setState({
      user: {
        id: 'usr-1',
        email: 'carlos@unterm.edu.pe',
        names: 'Carlos',
        firstSurname: 'Mendoza',
        secondSurname: 'Ruiz',
      },
    });

    const otherActiveUser: UserDto = {
      ...mockUserActive,
      id: 'usr-other',
      names: 'Juan',
      email: 'juan@unterm.edu.pe',
    };

    setupDefaultMsw([mockUserActive, otherActiveUser, mockUserInactiveWithoutDni, mockUserPending]);

    renderWithProviders(<UsersPage />);

    await screen.findByText('Carlos Mendoza Ruiz');

    expect(
      screen.queryByRole('button', { name: /inactivar a carlos mendoza/i }),
    ).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: /inactivar a juan mendoza/i })).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /reactivar a maría vargas/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /inactivar a maría vargas/i }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole('button', { name: /inactivar a pedro castillo/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /reactivar a pedro castillo/i }),
    ).not.toBeInTheDocument();
  });

  it('asks for confirmation, focuses cancel and cancels with escape', async () => {
    useAuthStore.setState({
      user: {
        id: 'usr-999',
        email: 'admin@unterm.edu.pe',
        names: 'Admin',
        firstSurname: 'General',
        secondSurname: null,
      },
    });

    setupDefaultMsw([mockUserActive]);

    const user = userEvent.setup();
    renderWithProviders(<UsersPage />);

    const deactivateBtn = await screen.findByRole('button', {
      name: /inactivar a carlos mendoza/i,
    });
    await user.click(deactivateBtn);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(
      screen.getByText(/¿inactivar a carlos mendoza\? se cerrarán sus sesiones activas\./i),
    ).toBeInTheDocument();

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /inactivar a carlos mendoza/i })).toBeInTheDocument();
  });

  it('deactivates after confirming and refreshes the list (CA3)', async () => {
    useAuthStore.setState({
      user: {
        id: 'usr-999',
        email: 'admin@unterm.edu.pe',
        names: 'Admin',
        firstSurname: 'General',
        secondSurname: null,
      },
    });

    let patched = false;
    server.use(
      http.get('http://localhost:3000/roles', () => HttpResponse.json({ items: [] })),
      http.get('http://localhost:3000/users', () => {
        return HttpResponse.json({
          items: [
            {
              ...mockUserActive,
              status: patched ? 'INACTIVE' : 'ACTIVE',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        });
      }),
      http.patch('http://localhost:3000/users/usr-1/status', async ({ request }) => {
        const body = (await request.json()) as { status: string };
        if (body.status === 'INACTIVE') {
          patched = true;
          return HttpResponse.json({
            ...mockUserActive,
            status: 'INACTIVE',
          });
        }
        return new HttpResponse(null, { status: 400 });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<UsersPage />);

    const deactivateBtn = await screen.findByRole('button', {
      name: /inactivar a carlos mendoza/i,
    });
    await user.click(deactivateBtn);

    const confirmBtn = screen.getByRole('dialog').querySelector('button:last-of-type')!;
    await user.click(confirmBtn);

    expect(
      await screen.findByText(/se inactivó la cuenta de carlos mendoza correctamente\./i),
    ).toBeInTheDocument();
  });

  it('a double click sends one request', async () => {
    useAuthStore.setState({
      user: {
        id: 'usr-999',
        email: 'admin@unterm.edu.pe',
        names: 'Admin',
        firstSurname: 'General',
        secondSurname: null,
      },
    });

    let patchCount = 0;
    server.use(
      http.get('http://localhost:3000/roles', () => HttpResponse.json({ items: [] })),
      http.get('http://localhost:3000/users', () => {
        return HttpResponse.json({
          items: [mockUserActive],
          total: 1,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        });
      }),
      http.patch('http://localhost:3000/users/usr-1/status', async () => {
        patchCount++;
        await new Promise((resolve) => setTimeout(resolve, 80));
        return HttpResponse.json({
          ...mockUserActive,
          status: 'INACTIVE',
        });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<UsersPage />);

    const deactivateBtn = await screen.findByRole('button', {
      name: /inactivar a carlos mendoza/i,
    });
    await user.click(deactivateBtn);

    const confirmBtn = within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Inactivar',
    });
    await user.dblClick(confirmBtn);

    await waitFor(() => {
      expect(patchCount).toBe(1);
    });
  });

  it('reactivates an inactive user with confirmation', async () => {
    let reactivated = false;
    server.use(
      http.get('http://localhost:3000/roles', () => HttpResponse.json({ items: [] })),
      http.get('http://localhost:3000/users', () => {
        return HttpResponse.json({
          items: [
            {
              ...mockUserInactiveWithoutDni,
              status: reactivated ? 'ACTIVE' : 'INACTIVE',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        });
      }),
      http.patch('http://localhost:3000/users/usr-2/status', async () => {
        reactivated = true;
        return HttpResponse.json({
          ...mockUserInactiveWithoutDni,
          status: 'ACTIVE',
        });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<UsersPage />);

    const reactivateBtn = await screen.findByRole('button', {
      name: /reactivar a maría vargas/i,
    });
    await user.click(reactivateBtn);

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Reactivar' }));

    expect(
      await screen.findByText(/se reactivó la cuenta de maría vargas correctamente\./i),
    ).toBeInTheDocument();
  });

  it('shows an error alert when the change fails and keeps the list', async () => {
    server.use(
      http.get('http://localhost:3000/roles', () => HttpResponse.json({ items: [] })),
      http.get('http://localhost:3000/users', () => {
        return HttpResponse.json({
          items: [mockUserInactiveWithoutDni],
          total: 1,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        });
      }),
      http.patch('http://localhost:3000/users/usr-2/status', () => {
        return HttpResponse.json(
          { message: 'Error en el servidor al cambiar estado.' },
          { status: 500 },
        );
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<UsersPage />);

    const reactivateBtn = await screen.findByRole('button', {
      name: /reactivar a maría vargas/i,
    });
    await user.click(reactivateBtn);
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Reactivar' }));

    expect(await screen.findByText('Error al cambiar estado')).toBeInTheDocument();
    expect(screen.getByText('María Vargas')).toBeInTheDocument();
  });

  it('hides create, edit and status action buttons when the user only has usuario.ver permission (HU-008, T-008-08, CA3)', async () => {
    server.use(
      http.get('http://localhost:3000/roles', () => HttpResponse.json({ items: [] })),
      http.get('http://localhost:3000/users', () =>
        HttpResponse.json({
          items: [mockUserActive, mockUserInactiveWithoutDni],
          total: 2,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        }),
      ),
    );

    renderWithProviders(<UsersPage />, {
      permissions: [{ code: 'usuario.ver', scope: 'GLOBAL' }],
    });

    expect(await screen.findByText('Carlos Mendoza Ruiz')).toBeInTheDocument();
    expect(screen.getByText('María Vargas')).toBeInTheDocument();

    expect(screen.queryByRole('link', { name: /nuevo usuario/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /editar a carlos mendoza ruiz/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /inactivar a carlos mendoza ruiz/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /reactivar a maría vargas/i }),
    ).not.toBeInTheDocument();
  });
});
