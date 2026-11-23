import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import type {
  ListPermissionsResponse,
  ListRolesResponse,
  PermissionDto,
  RoleDto,
  UpdateRolePermissionsRequest,
} from '@sigoa/shared';
import { RolesPage } from './roles-page';
import { RolePermissionsPage } from './role-permissions-page';
import { CreateRolePage } from './create-role-page';
import { EditRolePage } from './edit-role-page';

const mockPermissionsCatalog: PermissionDto[] = [
  {
    code: 'usuario.ver',
    description: 'Permite listar y consultar usuarios',
    module: 'Usuarios',
  },
  {
    code: 'usuario.crear',
    description: 'Permite registrar nuevos usuarios',
    module: 'Usuarios',
  },
  {
    code: 'rol.ver',
    description: 'Permite listar roles y permisos',
    module: 'Seguridad',
  },
  {
    code: 'rol.editar',
    description: 'Permite modificar roles y permisos',
    module: 'Seguridad',
  },
];

const initialRoles: RoleDto[] = [
  {
    id: 'role-admin',
    code: 'ADMINISTRATOR',
    name: 'Administrador',
    description: 'Acceso total y configuración del sistema',
    isPredefined: true,
    status: 'ACTIVE',
    deactivatedAt: null,
    userCount: 3,
    permissions: [
      { permissionCode: 'usuario.ver', scope: 'GLOBAL' },
      { permissionCode: 'usuario.crear', scope: 'GLOBAL' },
      { permissionCode: 'rol.ver', scope: 'GLOBAL' },
      { permissionCode: 'rol.editar', scope: 'GLOBAL' },
    ],
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
    permissions: [{ permissionCode: 'usuario.ver', scope: 'OWN' }],
    updatedAt: '2026-11-06T10:00:00.000Z',
  },
  {
    id: 'role-archived',
    code: 'ARCHIVED_ASSISTANT',
    name: 'Asistente Antiguo',
    description: 'Rol inactivo en desuso',
    isPredefined: false,
    status: 'INACTIVE',
    deactivatedAt: '2026-11-01T12:00:00.000Z',
    userCount: 0,
    permissions: [],
    updatedAt: '2026-11-01T12:00:00.000Z',
  },
];

function setupRolesFlowMsw() {
  const roles = JSON.parse(JSON.stringify(initialRoles)) as RoleDto[];

  server.use(
    http.get('http://localhost:3000/roles', () => {
      const response: ListRolesResponse = { items: roles };
      return HttpResponse.json(response);
    }),

    http.get('http://localhost:3000/roles/:id', ({ params }) => {
      const role = roles.find((r) => r.id === params.id);
      if (!role) {
        return HttpResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Rol no encontrado' } },
          { status: 404 },
        );
      }
      return HttpResponse.json(role);
    }),

    http.get('http://localhost:3000/permissions', () => {
      const response: ListPermissionsResponse = { items: mockPermissionsCatalog };
      return HttpResponse.json(response);
    }),

    http.post('http://localhost:3000/roles', async ({ request }) => {
      const body = (await request.json()) as { name: string; description?: string };
      const generatedCode = body.name.toUpperCase().replace(/\s+/g, '_');
      const newRole: RoleDto = {
        id: `role-${generatedCode.toLowerCase()}`,
        code: generatedCode,
        name: body.name,
        description: body.description ?? null,
        isPredefined: false,
        status: 'ACTIVE',
        deactivatedAt: null,
        userCount: 0,
        permissions: [],
        updatedAt: '2026-11-06T12:00:00.000Z',
      };
      roles.push(newRole);
      return HttpResponse.json(newRole, { status: 201 });
    }),

    http.patch('http://localhost:3000/roles/:id', async ({ params, request }) => {
      const role = roles.find((r) => r.id === params.id);
      if (!role) {
        return HttpResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Rol no encontrado' } },
          { status: 404 },
        );
      }
      const body = (await request.json()) as { name?: string; description?: string };
      if (body.name !== undefined) role.name = body.name;
      if (body.description !== undefined) role.description = body.description;
      return HttpResponse.json(role);
    }),

    http.patch('http://localhost:3000/roles/:id/status', async ({ params, request }) => {
      const role = roles.find((r) => r.id === params.id);
      if (!role) {
        return HttpResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Rol no encontrado' } },
          { status: 404 },
        );
      }
      const body = (await request.json()) as { status: 'ACTIVE' | 'INACTIVE'; confirmed?: boolean };
      if (body.status === 'INACTIVE' && role.userCount > 0 && !body.confirmed) {
        return HttpResponse.json(
          {
            error: {
              code: 'CONFLICT',
              message: `El rol está asignado a ${role.userCount} usuario(s).`,
            },
          },
          { status: 409 },
        );
      }
      role.status = body.status;
      role.deactivatedAt = body.status === 'INACTIVE' ? '2026-11-06T12:00:00.000Z' : null;
      return HttpResponse.json(role);
    }),

    http.put('http://localhost:3000/roles/:id/permissions', async ({ params, request }) => {
      const role = roles.find((r) => r.id === params.id);
      if (!role) {
        return HttpResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Rol no encontrado' } },
          { status: 404 },
        );
      }
      const body = (await request.json()) as UpdateRolePermissionsRequest;
      role.permissions = body.permissions;
      return HttpResponse.json(role);
    }),
  );

  return {
    getRoles: () => roles,
  };
}

describe('Roles Management Flows (HU-006, T-006-34)', () => {
  it('CA1 Flow: lists roles with badges, user counts and permission counts', async () => {
    setupRolesFlowMsw();

    renderWithProviders(<RolesPage />);

    expect(await screen.findByRole('heading', { name: 'Roles' })).toBeInTheDocument();
    expect(
      screen.getByText('Administra los grupos de permisos de FISME-SIGOA'),
    ).toBeInTheDocument();

    // Verificación de Administrador
    expect(await screen.findByText('Administrador')).toBeInTheDocument();

    // Verificación de Docente
    expect(screen.getByText('Docente')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument(); // 45 usuarios

    // Verificación de rol inactivo
    expect(screen.getByText('Asistente Antiguo')).toBeInTheDocument();
    expect(screen.getByText('Inactivo')).toBeInTheDocument();

    // Enlaces de acciones
    expect(screen.getByRole('link', { name: 'Permisos del rol Administrador' })).toHaveAttribute(
      'href',
      '/roles/role-admin/permisos',
    );
    expect(screen.getByRole('link', { name: 'Editar rol Administrador' })).toHaveAttribute(
      'href',
      '/roles/role-admin/editar',
    );
  });

  it('CA2 Flow: edits role permissions matrix and saves updated assignments', async () => {
    const store = setupRolesFlowMsw();
    const user = userEvent.setup();

    renderWithProviders(<RolePermissionsPage roleId="role-teacher" />);

    expect(
      await screen.findByRole('heading', { name: 'Permisos del rol: Docente' }),
    ).toBeInTheDocument();

    // Modificar permiso: seleccionar GLOBAL para "usuario.ver"
    const userViewSelect = screen.getByLabelText('Acceso a usuario.ver');
    expect(userViewSelect).toHaveValue('OWN');

    await user.selectOptions(userViewSelect, 'GLOBAL');
    expect(userViewSelect).toHaveValue('GLOBAL');

    // Asignar permiso de Seguridad: "rol.ver" -> GLOBAL
    const roleViewSelect = screen.getByLabelText('Acceso a rol.ver');
    expect(roleViewSelect).toHaveValue('NONE');

    await user.selectOptions(roleViewSelect, 'GLOBAL');
    expect(roleViewSelect).toHaveValue('GLOBAL');

    // Guardar cambios
    const saveBtn = screen.getByRole('button', { name: /Guardar cambios/i });
    await user.click(saveBtn);

    expect(await screen.findByText('Los permisos se guardaron exitosamente.')).toBeInTheDocument();

    const updatedTeacher = store.getRoles().find((r) => r.id === 'role-teacher');
    expect(updatedTeacher?.permissions).toEqual(
      expect.arrayContaining([
        { permissionCode: 'usuario.ver', scope: 'GLOBAL' },
        { permissionCode: 'rol.ver', scope: 'GLOBAL' },
      ]),
    );
  });

  it('CA3 Flow: deactivates active role with confirmation of assigned users count', async () => {
    const store = setupRolesFlowMsw();
    const user = userEvent.setup();

    renderWithProviders(<RolesPage />);

    expect(await screen.findByText('Docente')).toBeInTheDocument();

    // 1. Abrir diálogo de confirmación para Docente (45 usuarios)
    const deactivateBtn = screen.getByRole('button', { name: 'Inactivar rol Docente' });
    await user.click(deactivateBtn);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent(
      '¿Inactivar el rol Docente? Está asignado a 45 usuario(s); perderán sus permisos en su siguiente petición, y podrás reactivarlo después.',
    );

    // 2. Cancelar con el botón Cancelar
    const cancelBtn = within(dialog).getByRole('button', { name: 'Cancelar' });
    await user.click(cancelBtn);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // 3. Volver a abrir y confirmar
    await user.click(screen.getByRole('button', { name: 'Inactivar rol Docente' }));
    const confirmDialog = await screen.findByRole('dialog');
    const confirmBtn = within(confirmDialog).getByRole('button', { name: 'Inactivar' });
    await user.click(confirmBtn);

    // 4. Confirmación visual y actualización de estado
    expect(
      await screen.findByText("Se inactivó el rol 'Docente' correctamente."),
    ).toBeInTheDocument();

    const teacherRole = store.getRoles().find((r) => r.id === 'role-teacher');
    expect(teacherRole?.status).toBe('INACTIVE');
  });

  it('Reactivation Flow: reactivates inactive role after confirmation dialog', async () => {
    const store = setupRolesFlowMsw();
    const user = userEvent.setup();

    renderWithProviders(<RolesPage />);

    expect(await screen.findByText('Asistente Antiguo')).toBeInTheDocument();

    const reactivateBtn = screen.getByRole('button', { name: 'Reactivar rol Asistente Antiguo' });
    await user.click(reactivateBtn);

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Reactivar' }));

    expect(
      await screen.findByText("Se reactivó el rol 'Asistente Antiguo' correctamente."),
    ).toBeInTheDocument();

    const archivedRole = store.getRoles().find((r) => r.id === 'role-archived');
    expect(archivedRole?.status).toBe('ACTIVE');
  });

  it('Create Role Flow: registers institutional role with normalized payload', async () => {
    const store = setupRolesFlowMsw();
    const user = userEvent.setup();

    renderWithProviders(<CreateRolePage />);

    expect(await screen.findByRole('heading', { name: 'Nuevo rol' })).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Nombre del rol/i), 'Auditor de Calidad');
    await user.type(
      screen.getByLabelText(/Descripción/i),
      'Encargado de auditorías internas del programa',
    );

    const submitBtn = screen.getByRole('button', { name: 'Guardar' });
    await user.click(submitBtn);

    await waitFor(() => {
      const created = store.getRoles().find((r) => r.name === 'Auditor de Calidad');
      expect(created).toBeDefined();
      expect(created?.code).toBe('AUDITOR_DE_CALIDAD');
    });
  });

  it('Edit Role Flow: updates name and description while keeping code read-only', async () => {
    const store = setupRolesFlowMsw();
    const user = userEvent.setup();

    renderWithProviders(<EditRolePage roleId="role-teacher" />);

    expect(await screen.findByRole('heading', { name: 'Editar rol: Docente' })).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/Nombre del rol/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Docente Principal');

    const descInput = screen.getByLabelText(/Descripción/i);
    await user.clear(descInput);
    await user.type(descInput, 'Docente principal ordinario');

    const submitBtn = screen.getByRole('button', { name: 'Guardar' });
    await user.click(submitBtn);

    await waitFor(() => {
      const teacher = store.getRoles().find((r) => r.id === 'role-teacher');
      expect(teacher?.name).toBe('Docente Principal');
      expect(teacher?.description).toBe('Docente principal ordinario');
    });
  });
});
