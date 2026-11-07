import * as React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
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
  description: 'Rol desactivado',
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

    const deactivateBtn = await screen.findByRole('button', { name: 'Desactivar rol Docente' });
    await user.click(deactivateBtn);

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(
      screen.getByText(
        '¿Desactivar el rol Docente? Está asignado a 8 usuario(s); perderán sus permisos en su siguiente petición, y podrás reactivarlo después.',
      ),
    ).toBeInTheDocument();
  });

  it('says the role has no users when it has none', async () => {
    const user = userEvent.setup();
    renderActions(<RoleRowActions role={mockActiveRoleWithoutUsers} />);

    const deactivateBtn = await screen.findByRole('button', {
      name: 'Desactivar rol Rol Vacío',
    });
    await user.click(deactivateBtn);

    expect(
      screen.getByText('¿Desactivar el rol Rol Vacío? No tiene usuarios asignados.'),
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

    const deactivateBtn = await screen.findByRole('button', { name: 'Desactivar rol Docente' });
    await user.click(deactivateBtn);

    const confirmBtn = screen.getByRole('button', {
      name: 'Confirmar desactivación del rol Docente',
    });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith("Se desactivó el rol 'Docente' correctamente.");
    });

    expect(capturedBody).toEqual({
      status: 'INACTIVE',
      confirmed: true,
    });
  });

  it('cancels with Escape and returns the focus', async () => {
    const user = userEvent.setup();
    renderActions(<RoleRowActions role={mockActiveRoleWithUsers} />);

    const triggerBtn = await screen.findByRole('button', { name: 'Desactivar rol Docente' });
    await user.click(triggerBtn);

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desactivar rol Docente' })).toHaveFocus();
  });

  it('reactivates without confirmation', async () => {
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

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith("Se reactivó el rol 'Rol Inactivo' correctamente.");
    });

    expect(capturedBody).toEqual({ status: 'ACTIVE' });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('does not offer deactivation for the administrator role', async () => {
    renderActions(<RoleRowActions role={mockAdminRole} />);

    await screen.findByRole('link', { name: 'Permisos del rol Administrador' });
    expect(screen.queryByRole('button', { name: /Desactivar/i })).not.toBeInTheDocument();
  });

  it('disables the buttons while pending', async () => {
    const user = userEvent.setup();

    server.use(
      http.patch('http://localhost:3000/roles/role-inactive/status', async () => {
        await delay(150);
        return HttpResponse.json({ ...mockInactiveRole, status: 'ACTIVE' });
      }),
    );

    renderActions(<RoleRowActions role={mockInactiveRole} />);

    const reactivateBtn = await screen.findByRole('button', {
      name: 'Reactivar rol Rol Inactivo',
    });
    await user.click(reactivateBtn);

    expect(reactivateBtn).toBeDisabled();

    await waitFor(() => {
      expect(reactivateBtn).not.toBeDisabled();
    });
  });

  it('confirms the deactivation once when the confirm button is clicked twice', async () => {
    const user = userEvent.setup();
    let callCount = 0;

    server.use(
      http.patch('http://localhost:3000/roles/role-teacher/status', async () => {
        callCount++;
        await delay(100);
        return HttpResponse.json({ ...mockActiveRoleWithUsers, status: 'INACTIVE' });
      }),
    );

    renderActions(<RoleRowActions role={mockActiveRoleWithUsers} />);

    const deactivateBtn = await screen.findByRole('button', { name: 'Desactivar rol Docente' });
    await user.click(deactivateBtn);

    const confirmBtn = screen.getByRole('button', {
      name: 'Confirmar desactivación del rol Docente',
    });

    await user.click(confirmBtn);
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    expect(callCount).toBe(1);
  });

  it('reactivates once when the button is clicked twice', async () => {
    const user = userEvent.setup();
    let callCount = 0;

    server.use(
      http.patch('http://localhost:3000/roles/role-inactive/status', async () => {
        callCount++;
        await delay(100);
        return HttpResponse.json({ ...mockInactiveRole, status: 'ACTIVE' });
      }),
    );

    renderActions(<RoleRowActions role={mockInactiveRole} />);

    const reactivateBtn = await screen.findByRole('button', {
      name: 'Reactivar rol Rol Inactivo',
    });
    await user.click(reactivateBtn);
    await user.click(reactivateBtn);

    await waitFor(() => {
      expect(reactivateBtn).not.toBeDisabled();
    });

    expect(callCount).toBe(1);
  });

  it('shows the conflict message from the server', async () => {
    const user = userEvent.setup();
    const onError = vi.fn();

    server.use(
      http.patch('http://localhost:3000/roles/role-teacher/status', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'CONFLICT',
              message: 'No se puede desactivar este rol en su estado actual.',
            },
          },
          { status: 409 },
        );
      }),
    );

    renderActions(<RoleRowActions role={mockActiveRoleWithUsers} onStatusChangeError={onError} />);

    const deactivateBtn = await screen.findByRole('button', { name: 'Desactivar rol Docente' });
    await user.click(deactivateBtn);

    const confirmBtn = screen.getByRole('button', {
      name: 'Confirmar desactivación del rol Docente',
    });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('No se puede desactivar este rol en su estado actual.');
    });
  });
});
