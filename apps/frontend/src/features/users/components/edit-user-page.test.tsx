import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { RoleDto, UserDto } from '@sigoa/shared';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { EditUserPage } from './edit-user-page';

const mockUser: UserDto = {
  id: 'usr-123',
  email: 'martha.quispe@unterm.edu.pe',
  names: 'Martha',
  firstSurname: 'Quispe',
  secondSurname: 'Flores',
  dni: '78901234',
  status: 'ACTIVE',
  roleIds: ['role-teacher'],
  lastLoginAt: '2026-11-01T08:00:00.000Z',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const mockRoles: RoleDto[] = [
  {
    id: 'role-teacher',
    code: 'TEACHER',
    name: 'Docente',
    description: null,
    isPredefined: true,
    status: 'ACTIVE',
    deactivatedAt: null,
    userCount: 0,
    permissions: [],
    updatedAt: '2026-11-06T15:00:00.000Z',
  },
];

describe('EditUserPage component (T-003-27)', () => {
  it('shows loading state while fetching user', async () => {
    let resolveRequest: () => void;
    const requestPromise = new Promise<void>((resolve) => {
      resolveRequest = resolve;
    });

    server.use(
      http.get('http://localhost:3000/users/usr-123', async () => {
        await requestPromise;
        return HttpResponse.json(mockUser);
      }),
      http.get('http://localhost:3000/roles', () => {
        return HttpResponse.json({ items: mockRoles });
      }),
    );

    renderWithProviders(<EditUserPage userId="usr-123" />);

    const loadingSpans = await screen.findAllByText('Cargando datos del usuario...');
    expect(loadingSpans.length).toBeGreaterThan(0);
    resolveRequest!();
  });

  it('shows not found message and back button for a 404', async () => {
    server.use(
      http.get('http://localhost:3000/users/usr-404', () => {
        return HttpResponse.json({ message: 'Usuario no encontrado' }, { status: 404 });
      }),
      http.get('http://localhost:3000/roles', () => {
        return HttpResponse.json({ items: [] });
      }),
    );

    renderWithProviders(<EditUserPage userId="usr-404" />);

    expect(await screen.findByText('No se encontró el usuario')).toBeInTheDocument();
    expect(
      screen.getByText('El usuario solicitado no existe o fue eliminado del sistema.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /volver a la lista/i })).toBeInTheDocument();
  });

  it('shows permission message for a 403', async () => {
    server.use(
      http.get('http://localhost:3000/users/usr-forbidden', () => {
        return HttpResponse.json({ message: 'No autorizado' }, { status: 403 });
      }),
      http.get('http://localhost:3000/roles', () => {
        return HttpResponse.json({ items: [] });
      }),
    );

    renderWithProviders(<EditUserPage userId="usr-forbidden" />);

    expect(await screen.findByText('Acceso restringido')).toBeInTheDocument();
    expect(
      screen.getByText('No tienes permiso para ver o editar este usuario.'),
    ).toBeInTheDocument();
  });

  it('shows generic error with retry on 500 server failure', async () => {
    let callCount = 0;
    server.use(
      http.get('http://localhost:3000/roles', () => {
        return HttpResponse.json({ items: mockRoles });
      }),
      http.get('http://localhost:3000/users/usr-123', () => {
        callCount++;
        if (callCount === 1) {
          return new HttpResponse(null, { status: 500 });
        }
        return HttpResponse.json(mockUser);
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<EditUserPage userId="usr-123" />);

    expect(await screen.findByText('Error al cargar el usuario')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /reintentar/i });
    await user.click(retryBtn);

    expect(await screen.findByText('Editar usuario: Martha Quispe')).toBeInTheDocument();
  });

  it('renders user form with initial data when loaded successfully', async () => {
    server.use(
      http.get('http://localhost:3000/users/usr-123', () => {
        return HttpResponse.json(mockUser);
      }),
      http.get('http://localhost:3000/roles', () => {
        return HttpResponse.json({ items: mockRoles });
      }),
    );

    renderWithProviders(<EditUserPage userId="usr-123" />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Editar usuario: Martha Quispe' }),
    ).toBeInTheDocument();

    expect(screen.getByLabelText(/nombres/i)).toHaveValue('Martha');
    expect(screen.getByLabelText(/primer apellido/i)).toHaveValue('Quispe');
    expect(screen.getByLabelText(/segundo apellido/i)).toHaveValue('Flores');
    expect(screen.getByLabelText(/correo electrónico/i)).toHaveValue('martha.quispe@unterm.edu.pe');
    expect(screen.getByLabelText(/dni/i)).toHaveValue('78901234');
    expect(await screen.findByText('Docente')).toBeInTheDocument();
  });
});
