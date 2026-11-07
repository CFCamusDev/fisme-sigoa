import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { CreateRolePage } from './create-role-page';

describe('CreateRolePage component (T-006-21c)', () => {
  it('renders header and role creation form', async () => {
    renderWithProviders(<CreateRolePage />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Nuevo rol' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Nombre del rol/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Descripción/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancelar/i })).toBeInTheDocument();
  });
});
