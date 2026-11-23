import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoleDto, UserDto } from '@sigoa/shared';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { UserForm } from './user-form';

const mockRoles: RoleDto[] = [
  {
    id: 'role-admin',
    code: 'ADMINISTRATOR',
    name: 'Administrador',
    description: 'Acceso total al sistema',
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
    description: 'Profesor de asignaturas',
    isPredefined: true,
    status: 'ACTIVE',
    deactivatedAt: null,
    userCount: 0,
    permissions: [],
    updatedAt: '2026-11-06T15:00:00.000Z',
  },
];

const mockInitialUser: UserDto = {
  id: 'usr-1',
  email: 'ana.torres@unterm.edu.pe',
  names: 'Ana',
  firstSurname: 'Torres',
  secondSurname: 'Vega',
  dni: '76543210',
  status: 'ACTIVE',
  roleIds: ['role-teacher'],
  lastLoginAt: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};

const mockInitialUserWithoutDni: UserDto = {
  id: 'usr-2',
  email: 'luis.perez@unterm.edu.pe',
  names: 'Luis',
  firstSurname: 'Pérez',
  secondSurname: null,
  dni: null,
  status: 'ACTIVE',
  roleIds: ['role-admin'],
  lastLoginAt: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};

function setupRolesMsw(roles: RoleDto[] = mockRoles) {
  server.use(
    http.get('http://localhost:3000/roles', () => {
      return HttpResponse.json({ items: roles }, { status: 200 });
    }),
  );
}

describe('UserForm component (T-003-27)', () => {
  beforeEach(() => {
    setupRolesMsw();
  });

  it('shows required and format errors in spanish, links aria-describedby and focuses the first invalid field', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UserForm mode="create" />);

    await screen.findByText('Administrador');

    const submitBtn = screen.getByRole('button', { name: /crear usuario/i });
    await user.click(submitBtn);

    // Errores en español requeridos
    expect(await screen.findByText('Los nombres son obligatorios')).toBeInTheDocument();
    expect(screen.getByText('El primer apellido es obligatorio')).toBeInTheDocument();
    expect(screen.getByText('El correo electrónico es obligatorio')).toBeInTheDocument();
    expect(
      screen.getByText('El DNI debe contener exactamente 8 dígitos numéricos'),
    ).toBeInTheDocument();
    expect(screen.getByText('Debe asignar al menos un rol al usuario')).toBeInTheDocument();

    // El foco debe estar en el primer campo inválido (Nombres)
    const namesInput = screen.getByLabelText(/nombres/i);
    expect(namesInput).toHaveFocus();
    expect(namesInput).toHaveAttribute('aria-invalid', 'true');
    expect(namesInput).toHaveAttribute('aria-describedby', 'user-names-error');
  });

  it('requires at least one role and displays roles from the api', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UserForm mode="create" />);

    expect(await screen.findByText('Administrador')).toBeInTheDocument();
    expect(screen.getByText('Docente')).toBeInTheDocument();

    // Rellenamos datos válidos pero ningún rol seleccionado
    await user.type(screen.getByLabelText(/nombres/i), 'Carlos');
    await user.type(screen.getByLabelText(/primer apellido/i), 'Ruiz');
    await user.type(screen.getByLabelText(/correo electrónico/i), 'carlos@unterm.edu.pe');
    await user.type(screen.getByLabelText(/dni/i), '71234567');

    await user.click(screen.getByRole('button', { name: /crear usuario/i }));

    expect(await screen.findByText('Debe asignar al menos un rol al usuario')).toBeInTheDocument();
  });

  it('disables creation when roles fail to load and offers retry', async () => {
    let callCount = 0;
    server.use(
      http.get('http://localhost:3000/roles', () => {
        callCount++;
        if (callCount === 1) {
          return new HttpResponse(null, { status: 500 });
        }
        return HttpResponse.json({ items: mockRoles });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<UserForm mode="create" />);

    expect(await screen.findByText('Error al cargar catálogo de roles')).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /crear usuario/i });
    expect(submitBtn).toBeDisabled();

    // Reintentar carga de roles
    const retryBtn = screen.getByRole('button', { name: /reintentar/i });
    await user.click(retryBtn);

    expect(await screen.findByText('Administrador')).toBeInTheDocument();
    expect(submitBtn).toBeEnabled();
  });

  it('creates a user and shows the activation notice (CA1)', async () => {
    let createdPayload: unknown = null;
    server.use(
      http.post('http://localhost:3000/users', async ({ request }) => {
        createdPayload = await request.json();
        return HttpResponse.json(
          {
            ...mockInitialUser,
            email: 'nuevo.docente@unterm.edu.pe',
            names: 'Nuevo',
            firstSurname: 'Docente',
            secondSurname: null,
            dni: '88776655',
            status: 'PENDING_ACTIVATION',
            roleIds: ['role-teacher'],
          },
          { status: 201 },
        );
      }),
    );

    const onSuccess = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<UserForm mode="create" onSuccess={onSuccess} />);

    await screen.findByText('Administrador');

    await user.type(screen.getByLabelText(/nombres/i), 'Nuevo');
    await user.type(screen.getByLabelText(/primer apellido/i), 'Docente');
    await user.type(screen.getByLabelText(/correo electrónico/i), 'nuevo.docente@unterm.edu.pe');
    await user.type(screen.getByLabelText(/dni/i), '88776655');

    // Seleccionamos rol Docente
    const teacherCheckbox = screen.getByRole('checkbox', { name: /docente/i });
    await user.click(teacherCheckbox);

    await user.click(screen.getByRole('button', { name: /crear usuario/i }));

    expect(await screen.findByText('Usuario creado exitosamente')).toBeInTheDocument();
    expect(screen.getByText(/nuevo\.docente@unterm\.edu\.pe/)).toBeInTheDocument();
    expect(screen.getByText(/se envió un correo de activación a/i)).toBeInTheDocument();

    expect(onSuccess).toHaveBeenCalled();
    expect(createdPayload).toEqual({
      names: 'Nuevo',
      firstSurname: 'Docente',
      secondSurname: null,
      email: 'nuevo.docente@unterm.edu.pe',
      dni: '88776655',
      roleIds: ['role-teacher'],
    });

    // Permite crear otro usuario limpiando el formulario
    const createAnotherBtn = screen.getByRole('button', { name: /crear otro usuario/i });
    await user.click(createAnotherBtn);

    expect(screen.getByRole('button', { name: /crear usuario/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/nombres/i)).toHaveValue('');
  });

  it('marks the email field on a 409 for a duplicated email and the dni field for a duplicated dni (CA2)', async () => {
    let mode: 'email' | 'dni' = 'email';

    server.use(
      http.post('http://localhost:3000/users', () => {
        if (mode === 'email') {
          return HttpResponse.json(
            {
              error: {
                code: 'CONFLICT',
                message: 'Ya existe un usuario con el correo electrónico proporcionado',
              },
            },
            { status: 409 },
          );
        }
        return HttpResponse.json(
          {
            error: {
              code: 'CONFLICT',
              message: 'Ya existe un usuario con el DNI proporcionado',
            },
          },
          { status: 409 },
        );
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<UserForm mode="create" />);

    await screen.findByText('Administrador');

    await user.type(screen.getByLabelText(/nombres/i), 'Carlos');
    await user.type(screen.getByLabelText(/primer apellido/i), 'Ruiz');
    await user.type(screen.getByLabelText(/correo electrónico/i), 'repetido@unterm.edu.pe');
    await user.type(screen.getByLabelText(/dni/i), '71234567');
    await user.click(screen.getByRole('checkbox', { name: /administrador/i }));

    // 1. Envío con conflicto de email
    await user.click(screen.getByRole('button', { name: /crear usuario/i }));

    expect(
      await screen.findByText('Ya existe otro usuario con este correo electrónico.'),
    ).toBeInTheDocument();
    const emailInput = screen.getByLabelText(/correo electrónico/i);
    expect(emailInput).toHaveFocus();
    expect(emailInput).toHaveAttribute('aria-invalid', 'true');

    // 2. Envío con conflicto de DNI
    mode = 'dni';
    await user.click(screen.getByRole('button', { name: /crear usuario/i }));

    expect(
      await screen.findByText('Ya existe otro usuario con este DNI registrado.'),
    ).toBeInTheDocument();
    const dniInput = screen.getByLabelText(/dni/i);
    expect(dniInput).toHaveFocus();
    expect(dniInput).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows a general alert for other errors', async () => {
    server.use(
      http.post('http://localhost:3000/users', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Error inesperado en el servidor al crear usuario',
            },
          },
          { status: 500 },
        );
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<UserForm mode="create" />);

    await screen.findByText('Administrador');

    await user.type(screen.getByLabelText(/nombres/i), 'Carlos');
    await user.type(screen.getByLabelText(/primer apellido/i), 'Ruiz');
    await user.type(screen.getByLabelText(/correo electrónico/i), 'test@unterm.edu.pe');
    await user.type(screen.getByLabelText(/dni/i), '71234567');
    await user.click(screen.getByRole('checkbox', { name: /administrador/i }));

    await user.click(screen.getByRole('button', { name: /crear usuario/i }));

    expect(await screen.findByText('Error al crear usuario')).toBeInTheDocument();
    expect(
      screen.getByText('Error inesperado en el servidor al crear usuario'),
    ).toBeInTheDocument();
  });

  it('blocks a second submit while sending', async () => {
    let postCount = 0;
    server.use(
      http.post('http://localhost:3000/users', async () => {
        postCount++;
        await new Promise((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json(mockInitialUser, { status: 201 });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<UserForm mode="create" />);

    await screen.findByText('Administrador');

    await user.type(screen.getByLabelText(/nombres/i), 'Carlos');
    await user.type(screen.getByLabelText(/primer apellido/i), 'Ruiz');
    await user.type(screen.getByLabelText(/correo electrónico/i), 'carlos@unterm.edu.pe');
    await user.type(screen.getByLabelText(/dni/i), '71234567');
    await user.click(screen.getByRole('checkbox', { name: /administrador/i }));

    const submitBtn = screen.getByRole('button', { name: /crear usuario/i });
    await user.dblClick(submitBtn);

    await waitFor(() => {
      expect(postCount).toBe(1);
    });
  });

  it('loads the user and sends only the changed fields in edit mode', async () => {
    let patchPayload: unknown = null;
    server.use(
      http.patch('http://localhost:3000/users/usr-1', async ({ request }) => {
        patchPayload = await request.json();
        return HttpResponse.json(
          {
            ...mockInitialUser,
            names: 'Ana María',
          },
          { status: 200 },
        );
      }),
    );

    const onSuccess = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <UserForm mode="edit" initialUser={mockInitialUser} onSuccess={onSuccess} />,
    );

    const namesInput = await screen.findByLabelText(/nombres/i);
    expect(namesInput).toHaveValue('Ana');

    // Cambiamos solo el nombre
    await user.clear(namesInput);
    await user.type(namesInput, 'Ana María');

    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    expect(await screen.findByText('Cambios guardados')).toBeInTheDocument();
    expect(onSuccess).toHaveBeenCalled();
    // Solo debe haber enviado el campo modificado
    expect(patchPayload).toEqual({
      names: 'Ana María',
    });
  });

  it('leaves an empty dni untouched for a user without dni', async () => {
    let patchPayload: unknown = null;
    server.use(
      http.patch('http://localhost:3000/users/usr-2', async ({ request }) => {
        patchPayload = await request.json();
        return HttpResponse.json(
          {
            ...mockInitialUserWithoutDni,
            names: 'Luis Alberto',
          },
          { status: 200 },
        );
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<UserForm mode="edit" initialUser={mockInitialUserWithoutDni} />);

    const dniInput = await screen.findByLabelText(/dni/i);
    expect(dniInput).toHaveValue('');
    expect(dniInput).toHaveAttribute('placeholder', 'Sin DNI registrado');

    // Cambiamos el nombre, dejamos el DNI vacío
    const namesInput = screen.getByLabelText(/nombres/i);
    await user.clear(namesInput);
    await user.type(namesInput, 'Luis Alberto');

    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    expect(await screen.findByText('Cambios guardados')).toBeInTheDocument();
    // No debe enviar el campo dni
    expect(patchPayload).toEqual({
      names: 'Luis Alberto',
    });
  });

  it('does not show read-only roles block in edit mode', async () => {
    renderWithProviders(<UserForm mode="edit" initialUser={mockInitialUser} />);

    expect(await screen.findByLabelText(/nombres/i)).toHaveValue('Ana');
    expect(screen.queryByText('Roles asignados (solo lectura)')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('offers only active roles when creating a user (U2b, CA3)', async () => {
    const rolesWithInactive: RoleDto[] = [
      ...mockRoles,
      {
        id: 'role-inactive-custom',
        code: 'OLD_AUDITOR',
        name: 'Auditor Antiguo Inactivo',
        description: 'Rol en desuso',
        isPredefined: false,
        status: 'INACTIVE',
        deactivatedAt: '2026-11-01T00:00:00.000Z',
        userCount: 0,
        permissions: [],
        updatedAt: '2026-11-01T00:00:00.000Z',
      },
    ];
    setupRolesMsw(rolesWithInactive);

    renderWithProviders(<UserForm mode="create" />);

    // El rol activo debe estar presente
    expect(await screen.findByText('Administrador')).toBeInTheDocument();
    expect(screen.getByText('Docente')).toBeInTheDocument();

    // El rol inactivo no debe estar disponible para selección en modo creación
    expect(screen.queryByText('Auditor Antiguo Inactivo')).not.toBeInTheDocument();
  });

  it('validates dni inline on edit and does not call the api', async () => {
    let patchCalls = 0;
    server.use(
      http.patch('http://localhost:3000/users/usr-1', () => {
        patchCalls += 1;
        return HttpResponse.json(mockInitialUser, { status: 200 });
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<UserForm mode="edit" initialUser={mockInitialUser} />);

    const dniInput = await screen.findByLabelText(/dni/i);
    await user.clear(dniInput);
    await user.type(dniInput, '123');
    await user.tab();

    expect(
      await screen.findByText('El DNI debe contener exactamente 8 dígitos numéricos'),
    ).toBeInTheDocument();
    expect(dniInput).toHaveAttribute('aria-invalid', 'true');

    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));
    expect(patchCalls).toBe(0);
  });

  it('does not show raw JSON when server returns a serialized validator error', async () => {
    server.use(
      http.patch('http://localhost:3000/users/usr-1', () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: '[{"code":"invalid_string","path":["dni"],"message":"DNI inválido"}]',
            },
          },
          { status: 400 },
        ),
      ),
    );

    const user = userEvent.setup();
    renderWithProviders(<UserForm mode="edit" initialUser={mockInitialUser} />);

    const namesInput = await screen.findByLabelText(/nombres/i);
    await user.clear(namesInput);
    await user.type(namesInput, 'Ana Sofía');
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert');
      expect(alerts.length).toBeGreaterThan(0);
    });
    expect(screen.queryByText(/invalid_string/)).not.toBeInTheDocument();
  });
});
