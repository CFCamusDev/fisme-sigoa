import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { RoleDto } from '@sigoa/shared';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { EditRolePage } from './edit-role-page';

const mockRoles: RoleDto[] = [
  {
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
  },
];

describe('EditRolePage component (T-006-21c)', () => {
  it('shows loading state while fetching roles', async () => {
    let resolveRequest: () => void;
    const requestPromise = new Promise<void>((resolve) => {
      resolveRequest = resolve;
    });

    server.use(
      http.get('http://localhost:3000/roles', async () => {
        await requestPromise;
        return HttpResponse.json({ items: mockRoles });
      }),
    );

    renderWithProviders(<EditRolePage roleId="role-123" />);

    const loadingSpans = await screen.findAllByText('Cargando datos del rol...');
    expect(loadingSpans.length).toBeGreaterThan(0);
    resolveRequest!();
  });

  it('shows not found error when roleId does not exist', async () => {
    server.use(
      http.get('http://localhost:3000/roles', () => {
        return HttpResponse.json({ items: mockRoles });
      }),
    );

    renderWithProviders(<EditRolePage roleId="non-existent-role" />);

    expect(await screen.findByText('No se encontró el rol')).toBeInTheDocument();
    expect(
      screen.getByText('El rol solicitado no existe o fue eliminado del sistema.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a la lista' })).toBeInTheDocument();
  });

  it('renders role data in form when found', async () => {
    server.use(
      http.get('http://localhost:3000/roles', () => {
        return HttpResponse.json({ items: mockRoles });
      }),
    );

    renderWithProviders(<EditRolePage roleId="role-123" />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Editar rol: Docente Evaluador' }),
    ).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/Nombre del rol/i);
    expect(nameInput).toHaveValue('Docente Evaluador');

    const descInput = screen.getByLabelText(/Descripción/i);
    expect(descInput).toHaveValue('Evalúa asignaturas del semestre');
  });
});
