import * as React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { PROTECTED_ROLE_CODE, type PermissionDto, type RoleDto } from '@sigoa/shared';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { PermissionMatrixEditor } from './permission-matrix-editor';

const mockCatalog: PermissionDto[] = [
  {
    code: 'usuario.ver',
    description: 'Ver usuarios registrados',
    module: 'M01 Seguridad',
  },
  {
    code: 'usuario.crear',
    description: 'Crear nuevos usuarios',
    module: 'M01 Seguridad',
  },
  {
    code: 'rol.ver',
    description: 'Ver catálogo de roles',
    module: 'M01 Seguridad',
  },
  {
    code: 'rol.editar',
    description: 'Editar permisos de roles',
    module: 'M01 Seguridad',
  },
  {
    code: 'catalogo.ver',
    description: 'Ver catálogo de OE y AG',
    module: 'M02 Catálogo',
  },
];

const mockRole: RoleDto = {
  id: 'role-123',
  code: 'DOCENTE',
  name: 'Docente',
  description: 'Docente evaluador',
  isPredefined: false,
  status: 'ACTIVE',
  deactivatedAt: null,
  userCount: 5,
  permissions: [
    { permissionCode: 'usuario.ver', scope: 'GLOBAL' },
    { permissionCode: 'catalogo.ver', scope: 'OWN' },
  ],
  updatedAt: '2026-11-06T12:00:00.000Z',
};

const mockAdminRole: RoleDto = {
  id: 'role-admin',
  code: PROTECTED_ROLE_CODE,
  name: 'Administrador',
  description: 'Administrador del sistema',
  isPredefined: true,
  status: 'ACTIVE',
  deactivatedAt: null,
  userCount: 2,
  permissions: [
    { permissionCode: 'rol.ver', scope: 'GLOBAL' },
    { permissionCode: 'rol.editar', scope: 'GLOBAL' },
    { permissionCode: 'usuario.ver', scope: 'GLOBAL' },
  ],
  updatedAt: '2026-11-06T12:00:00.000Z',
};

function renderEditor(ui: React.ReactElement) {
  return renderWithProviders(ui);
}

describe('PermissionMatrixEditor component (T-006-22b)', () => {
  it('renders one module at a time with navigation buttons and a select per permission', async () => {
    const user = userEvent.setup();
    renderEditor(<PermissionMatrixEditor role={mockRole} catalog={mockCatalog} />);

    expect(
      await screen.findByRole('heading', { level: 2, name: 'M01 Seguridad' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /M02 Catálogo/i })).toBeInTheDocument();

    for (const permission of mockCatalog.filter((item) => item.module === 'M01 Seguridad')) {
      expect(screen.getByText(permission.code)).toBeInTheDocument();
      expect(screen.getByText(permission.description)).toBeInTheDocument();
      expect(
        screen.getByRole('combobox', { name: `Acceso a ${permission.code}` }),
      ).toBeInTheDocument();
    }

    await user.click(screen.getByRole('button', { name: /M02 Catálogo/i }));
    expect(screen.getByRole('heading', { level: 2, name: 'M02 Catálogo' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Acceso a catalogo.ver' })).toBeInTheDocument();
  });

  it('shows the current scope of each permission', async () => {
    const user = userEvent.setup();
    renderEditor(<PermissionMatrixEditor role={mockRole} catalog={mockCatalog} />);

    expect(await screen.findByRole('combobox', { name: 'Acceso a usuario.ver' })).toHaveValue(
      'GLOBAL',
    );
    expect(screen.getByRole('combobox', { name: 'Acceso a usuario.crear' })).toHaveValue('NONE');
    expect(screen.getByRole('combobox', { name: 'Acceso a rol.ver' })).toHaveValue('NONE');
    expect(screen.getByRole('combobox', { name: 'Acceso a rol.editar' })).toHaveValue('NONE');

    await user.click(screen.getByRole('button', { name: /M02 Catálogo/i }));
    expect(screen.getByRole('combobox', { name: 'Acceso a catalogo.ver' })).toHaveValue('OWN');
  });

  it('marks modified rows with text', async () => {
    const user = userEvent.setup();
    renderEditor(<PermissionMatrixEditor role={mockRole} catalog={mockCatalog} />);

    await screen.findByRole('combobox', { name: 'Acceso a usuario.crear' });
    expect(screen.queryByText('Modificado')).not.toBeInTheDocument();

    const select = await screen.findByRole('combobox', { name: 'Acceso a usuario.crear' });
    await user.selectOptions(select, 'GLOBAL');

    expect(screen.getByText('Modificado')).toBeInTheDocument();
  });

  it('enables save only when there are changes', async () => {
    const user = userEvent.setup();
    renderEditor(<PermissionMatrixEditor role={mockRole} catalog={mockCatalog} />);

    const saveButton = await screen.findByRole('button', { name: 'Guardar cambios' });
    const discardButton = screen.getByRole('button', { name: 'Descartar' });

    expect(saveButton).toBeDisabled();
    expect(discardButton).toBeDisabled();

    const select = await screen.findByRole('combobox', { name: 'Acceso a usuario.crear' });
    await user.selectOptions(select, 'GLOBAL');

    expect(saveButton).not.toBeDisabled();
    expect(discardButton).not.toBeDisabled();
  });

  it('shows the unsaved changes count', async () => {
    const user = userEvent.setup();
    renderEditor(<PermissionMatrixEditor role={mockRole} catalog={mockCatalog} />);

    expect(await screen.findByText('0 cambios sin guardar')).toBeInTheDocument();

    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Acceso a usuario.crear' }),
      'GLOBAL',
    );
    expect(screen.getByText('1 cambio sin guardar')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /M02 Catálogo/i }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Acceso a catalogo.ver' }),
      'NONE',
    );
    expect(screen.getByText('2 cambios sin guardar')).toBeInTheDocument();
  });

  it('discards the changes', async () => {
    const user = userEvent.setup();
    const onDiscard = vi.fn();
    renderEditor(
      <PermissionMatrixEditor role={mockRole} catalog={mockCatalog} onDiscard={onDiscard} />,
    );

    const select = await screen.findByRole('combobox', { name: 'Acceso a usuario.crear' });
    await user.selectOptions(select, 'GLOBAL');
    expect(select).toHaveValue('GLOBAL');

    const discardButton = screen.getByRole('button', { name: 'Descartar' });
    await user.click(discardButton);

    expect(select).toHaveValue('NONE');
    expect(screen.getByText('0 cambios sin guardar')).toBeInTheDocument();
    expect(onDiscard).toHaveBeenCalled();
  });

  it('disables the protected permissions of the administrator role with an explanation', async () => {
    renderEditor(<PermissionMatrixEditor role={mockAdminRole} catalog={mockCatalog} />);

    const rolVerSelect = await screen.findByRole('combobox', { name: 'Acceso a rol.ver' });
    const rolEditarSelect = screen.getByRole('combobox', { name: 'Acceso a rol.editar' });
    const usuarioVerSelect = screen.getByRole('combobox', { name: 'Acceso a usuario.ver' });

    expect(rolVerSelect).toBeDisabled();
    expect(rolEditarSelect).toBeDisabled();
    expect(usuarioVerSelect).not.toBeDisabled();

    const hints = screen.getAllByText(
      'El rol Administrador debe conservar este permiso con alcance Global',
    );
    expect(hints.length).toBe(2);
  });

  it('saves once when the save button is clicked twice', async () => {
    const user = userEvent.setup();
    let callCount = 0;

    server.use(
      http.put('http://localhost:3000/roles/role-123/permissions', async () => {
        callCount++;
        await delay(100);
        return HttpResponse.json(mockRole, { status: 200 });
      }),
    );

    renderEditor(<PermissionMatrixEditor role={mockRole} catalog={mockCatalog} />);

    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Acceso a usuario.crear' }),
      'GLOBAL',
    );

    const saveButton = screen.getByRole('button', { name: 'Guardar cambios' });
    await user.click(saveButton);
    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Los permisos se guardaron exitosamente.')).toBeInTheDocument();
    });

    expect(callCount).toBe(1);
  });

  it('is keyboard accessible', async () => {
    const user = userEvent.setup();
    renderEditor(<PermissionMatrixEditor role={mockRole} catalog={mockCatalog} />);

    const firstSelect = await screen.findByRole('combobox', { name: 'Acceso a usuario.ver' });
    firstSelect.focus();
    expect(firstSelect).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    await user.tab();
    const secondSelect = screen.getByRole('combobox', { name: 'Acceso a usuario.crear' });
    expect(secondSelect).toHaveFocus();
  });
});
