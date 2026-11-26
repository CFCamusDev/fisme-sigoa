import * as React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import type { RoleDto } from '@sigoa/shared';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { RoleForm } from './role-form';

const mockInitialRole: RoleDto = {
  id: 'role-123',
  code: 'DOCENTE_EVALUADOR',
  name: 'Docente Evaluador',
  description: 'Evalúa asignaturas del semestre',
  isPredefined: false,
  status: 'ACTIVE',
  deactivatedAt: null,
  userCount: 0,
  permissions: [],
  updatedAt: '2026-11-06T12:00:00.000Z',
};

function renderForm(ui: React.ReactElement) {
  return renderWithProviders(ui, { withRouter: false });
}

describe('RoleForm component (T-006-21b)', () => {
  it('validates name length and description length in Spanish', async () => {
    const user = userEvent.setup();
    renderForm(<RoleForm mode="create" />);

    const nameInput = screen.getByLabelText(/Nombre del rol/i);
    const descInput = screen.getByLabelText(/Descripción/i);
    const submitBtn = screen.getByRole('button', { name: /Guardar/i });

    // Nombre muy corto (< 3)
    await user.type(nameInput, 'ab');
    await user.click(submitBtn);

    expect(
      await screen.findByText('El nombre de rol debe tener al menos 3 caracteres'),
    ).toBeInTheDocument();
    expect(nameInput).toHaveAttribute('aria-invalid', 'true');
    expect(nameInput).toHaveAttribute('aria-describedby', 'role-name-error');

    // Nombre muy largo (> 80)
    fireEvent.change(nameInput, { target: { value: 'a'.repeat(81) } });
    await user.click(submitBtn);

    expect(
      await screen.findByText('El nombre de rol no puede exceder 80 caracteres'),
    ).toBeInTheDocument();

    // Descripción muy larga (> 255)
    fireEvent.change(nameInput, { target: { value: 'Rol Válido' } });
    fireEvent.change(descInput, { target: { value: 'd'.repeat(256) } });
    await user.click(submitBtn);

    expect(
      await screen.findByText('La descripción no puede exceder 255 caracteres'),
    ).toBeInTheDocument();
    expect(descInput).toHaveAttribute('aria-invalid', 'true');
    expect(descInput).toHaveAttribute('aria-describedby', 'role-description-error');
  });

  it('creates a role and reports success', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    let capturedBody: unknown = null;

    server.use(
      http.post('http://localhost:3000/roles', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(mockInitialRole, { status: 201 });
      }),
    );

    renderForm(<RoleForm mode="create" onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText(/Nombre del rol/i), 'Coordinador de Calidad');
    await user.type(screen.getByLabelText(/Descripción/i), 'Supervisa procesos');
    await user.click(screen.getByRole('button', { name: /Guardar/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(mockInitialRole);
    });

    expect(capturedBody).toEqual({
      name: 'Coordinador de Calidad',
      description: 'Supervisa procesos',
      permissions: [],
    });
  });

  it('edits only name and description', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    let capturedBody: unknown = null;

    server.use(
      http.patch('http://localhost:3000/roles/role-123', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ ...mockInitialRole, name: 'Docente Principal' });
      }),
    );

    renderForm(<RoleForm mode="edit" initialRole={mockInitialRole} onSuccess={onSuccess} />);

    const nameInput = screen.getByLabelText(/Nombre del rol/i);
    expect(nameInput).toHaveValue('Docente Evaluador');

    await user.clear(nameInput);
    await user.type(nameInput, 'Docente Principal');
    await user.click(screen.getByRole('button', { name: /Guardar/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });

    expect(capturedBody).toEqual({
      name: 'Docente Principal',
      description: 'Evalúa asignaturas del semestre',
    });
  });

  it('clears the description with an empty value', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    let capturedBody: unknown = null;

    server.use(
      http.patch('http://localhost:3000/roles/role-123', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ ...mockInitialRole, description: null });
      }),
    );

    renderForm(<RoleForm mode="edit" initialRole={mockInitialRole} onSuccess={onSuccess} />);

    const descInput = screen.getByLabelText(/Descripción/i);
    await user.clear(descInput);
    await user.click(screen.getByRole('button', { name: /Guardar/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });

    expect(capturedBody).toEqual({
      name: 'Docente Evaluador',
      description: null,
    });
  });

  it('shows a duplicated-name error on the name field (409)', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('http://localhost:3000/roles', () => {
        return HttpResponse.json(
          {
            statusCode: 409,
            code: 'CONFLICT',
            message: 'Ya existe un rol con este nombre.',
          },
          { status: 409 },
        );
      }),
    );

    renderForm(<RoleForm mode="create" />);

    await user.type(screen.getByLabelText(/Nombre del rol/i), 'Docente');
    await user.click(screen.getByRole('button', { name: /Guardar/i }));

    expect(await screen.findByText('Ya existe un rol con este nombre.')).toBeInTheDocument();
    const nameInput = screen.getByLabelText(/Nombre del rol/i);
    expect(nameInput).toHaveAttribute('aria-invalid', 'true');
    expect(nameInput).toHaveFocus();
  });

  it('shows the server error in an alert', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('http://localhost:3000/roles', () => {
        return HttpResponse.json(
          {
            statusCode: 500,
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Fallo inesperado del servidor.',
          },
          { status: 500 },
        );
      }),
    );

    renderForm(<RoleForm mode="create" />);

    await user.type(screen.getByLabelText(/Nombre del rol/i), 'Administrador');
    await user.click(screen.getByRole('button', { name: /Guardar/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('disables the button while saving', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('http://localhost:3000/roles', async () => {
        await delay(150);
        return HttpResponse.json(mockInitialRole, { status: 201 });
      }),
    );

    renderForm(<RoleForm mode="create" />);

    await user.type(screen.getByLabelText(/Nombre del rol/i), 'Nuevo Rol');
    const submitBtn = screen.getByRole('button', { name: /Guardar/i });
    await user.click(submitBtn);

    expect(screen.getByRole('button', { name: /Guardando…/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Guardando…/i })).toHaveAttribute(
      'aria-busy',
      'true',
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Guardar/i })).not.toBeDisabled();
    });
  });

  it('submits once when the button is clicked twice', async () => {
    const user = userEvent.setup();
    let callCount = 0;

    server.use(
      http.post('http://localhost:3000/roles', async () => {
        callCount++;
        await delay(100);
        return HttpResponse.json(mockInitialRole, { status: 201 });
      }),
    );

    renderForm(<RoleForm mode="create" />);

    await user.type(screen.getByLabelText(/Nombre del rol/i), 'Rol Concurrente');
    const submitBtn = screen.getByRole('button', { name: /Guardar/i });

    await user.click(submitBtn);
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Guardar/i })).not.toBeDisabled();
    });

    expect(callCount).toBe(1);
  });

  it('submits once when Enter is pressed twice', async () => {
    const user = userEvent.setup();
    let callCount = 0;

    server.use(
      http.post('http://localhost:3000/roles', async () => {
        callCount++;
        await delay(100);
        return HttpResponse.json(mockInitialRole, { status: 201 });
      }),
    );

    renderForm(<RoleForm mode="create" />);

    const nameInput = screen.getByLabelText(/Nombre del rol/i);
    await user.type(nameInput, 'Rol Concurrente{Enter}{Enter}');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Guardar/i })).not.toBeDisabled();
    });

    expect(callCount).toBe(1);
  });

  it('is keyboard accessible', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    renderForm(<RoleForm mode="create" onCancel={onCancel} />);

    const nameInput = screen.getByLabelText(/Nombre del rol/i);
    const descInput = screen.getByLabelText(/Descripción/i);
    const submitBtn = screen.getByRole('button', { name: /Guardar/i });
    const cancelBtn = screen.getByRole('button', { name: /Cancelar/i });

    await user.tab();
    expect(nameInput).toHaveFocus();

    await user.tab();
    expect(descInput).toHaveFocus();

    await user.tab();
    expect(cancelBtn).toHaveFocus();

    await user.tab();
    expect(submitBtn).toHaveFocus();

    await user.tab();
    // Avanzar no cambia el estado; volvemos al cancelar para probar Enter.
    cancelBtn.focus();
    await user.keyboard('{Enter}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
