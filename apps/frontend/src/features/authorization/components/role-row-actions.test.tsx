import * as React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { PROTECTED_ROLE_CODE, type RoleDto } from '@sigoa/shared';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { RoleRowActions } from './role-row-actions';

const mockActiveRoleWithUsers: RoleDto = {
  id: 'role-teacher',
  code: 'TEACHER',
  name: 'Docente',
  description: 'Docente evaluador',
  isPredefined: false,
  status: 'ACTIVE',
  deactivatedAt: null,
  userCount: 8,
  permissions: [],
  updatedAt: '2026-11-06T12:00:00.000Z',
};

const mockActiveRoleWithoutUsers: RoleDto = {
  id: 'role-empty',
  code: 'EMPTY_ROLE',
  name: 'Rol Vacío',
  description: 'Sin usuarios asignados',
  isPredefined: false,
  status: 'ACTIVE',
  deactivatedAt: null,
  userCount: 0,
  permissions: [],
  updatedAt: '2026-11-06T12:00:00.000Z',
};

const mockInactiveRole: RoleDto = {
  id: 'role-inactive',
  code: 'INACTIVE_ROLE',
  name: 'Rol Inactivo',
  description: 'Rol inactivo',
  isPredefined: false,
  status: 'INACTIVE',
  deactivatedAt: '2026-11-06T12:00:00.000Z',
  userCount: 0,
  permissions: [],
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
  permissions: [],
  updatedAt: '2026-11-06T12:00:00.000Z',
};

function renderActions(ui: React.ReactElement) {
  return renderWithProviders(ui);
}

describe('RoleRowActions component (U1, CA3)', () => {
  it('asks for confirmation with the number of users', async () => {
    const user = userEvent.setup();
    renderActions(<RoleRowActions role={mockActiveRoleWithUsers} />);

    const deactivateBtn = await screen.findByRole('button', { name: 'Inactivar rol Docente' });
    await user.click(deactivateBtn);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Inactivar rol');
    expect(dialog).toHaveTextContent(
      '¿Inactivar el rol Docente? Está asignado a 8 usuario(s); perderán sus permisos en su siguiente petición, y podrás reactivarlo después.',
    );
  });

  it('says the role has no users when it has none', async () => {
    const user = userEvent.setup();
    renderActions(<RoleRowActions role={mockActiveRoleWithoutUsers} />);

    const deactivateBtn = await screen.findByRole('button', {
      name: 'Inactivar rol Rol Vacío',
    });
    await user.click(deactivateBtn);

    expect(
      await screen.findByText('¿Inactivar el rol Rol Vacío? No tiene usuarios asignados.'),
    ).toBeInTheDocument();
  });

  it('sends confirmed true on confirmation', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    let capturedBody: unknown = null;

    server.use(
      http.patch('http://localhost:3000/roles/role-teacher/status', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ ...mockActiveRoleWithUsers, status: 'INACTIVE' });
      }),
    );

    renderActions(
      <RoleRowActions role={mockActiveRoleWithUsers} onStatusChangeSuccess={onSuccess} />,
    );

    await user.click(await screen.findByRole('button', { name: 'Inactivar rol Docente' }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Inactivar' }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith("Se inactivó el rol 'Docente' correctamente.");
    });

    expect(capturedBody).toEqual({
      status: 'INACTIVE',
      confirmed: true,
    });
  });

  it('cancels with Escape and returns the focus', async () => {
    const user = userEvent.setup();
    renderActions(<RoleRowActions role={mockActiveRoleWithUsers} />);

    const triggerBtn = await screen.findByRole('button', { name: 'Inactivar rol Docente' });
    await user.click(triggerBtn);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Inactivar rol Docente' })).toHaveFocus();
  });

  it('asks for confirmation before Reactivar', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    let capturedBody: unknown = null;

    server.use(
      http.patch('http://localhost:3000/roles/role-inactive/status', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ ...mockInactiveRole, status: 'ACTIVE' });
      }),
    );

    renderActions(<RoleRowActions role={mockInactiveRole} onStatusChangeSuccess={onSuccess} />);

    const reactivateBtn = await screen.findByRole('button', {
      name: 'Reactivar rol Rol Inactivo',
    });
    await user.click(reactivateBtn);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Reactivar rol');
    expect(dialog).toHaveTextContent('¿Reactivar el rol Rol Inactivo?');

    await user.click(within(dialog).getByRole('button', { name: 'Reactivar' }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith("Se reactivó el rol 'Rol Inactivo' correctamente.");
    });

    expect(capturedBody).toEqual({ status: 'ACTIVE' });
  });

  it('does not offer inactivation for the administrator role', async () => {
    renderActions(<RoleRowActions role={mockAdminRole} />);

    await screen.findByRole('link', { name: 'Permisos del rol Administrador' });
    expect(screen.queryByRole('button', { name: /Inactivar/i })).not.toBeInTheDocument();
  });

  it('confirms the inactivation once when clicked twice while pending', async () => {
    const user = userEvent.setup();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let callCount = 0;

    server.use(
      http.patch('http://localhost:3000/roles/role-teacher/status', async () => {
        callCount++;
        await gate;
        return HttpResponse.json({ ...mockActiveRoleWithUsers, status: 'INACTIVE' });
      }),
    );

    renderActions(<RoleRowActions role={mockActiveRoleWithUsers} />);

    await user.click(await screen.findByRole('button', { name: 'Inactivar rol Docente' }));
    const dialog = await screen.findByRole('dialog');
    const confirmBtn = within(dialog).getByRole('button', { name: 'Inactivar' });

    await user.click(confirmBtn);
    const pendingBtn = await within(dialog).findByRole('button', { name: 'Inactivando…' });
    expect(pendingBtn).toBeDisabled();
    await user.click(pendingBtn);

    expect(callCount).toBe(1);
    release();

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(callCount).toBe(1);
  });

  it('shows the conflict message from the server inside the dialog', async () => {
    const user = userEvent.setup();
    const onError = vi.fn();

    server.use(
      http.patch('http://localhost:3000/roles/role-teacher/status', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'CONFLICT',
              message: 'No se puede inactivar este rol en su estado actual.',
            },
          },
          { status: 409 },
        );
      }),
    );

    renderActions(<RoleRowActions role={mockActiveRoleWithUsers} onStatusChangeError={onError} />);

    await user.click(await screen.findByRole('button', { name: 'Inactivar rol Docente' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Inactivar' }));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('No se puede inactivar este rol en su estado actual.');
    });
    expect(screen.getByRole('dialog')).toHaveTextContent(
      'No se puede inactivar este rol en su estado actual.',
    );
  });
});
