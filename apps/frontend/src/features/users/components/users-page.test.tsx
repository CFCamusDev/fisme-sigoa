import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { UsersPage } from './users-page';

describe('UsersPage component (T-003-02)', () => {
  it('renders the title and the empty state', async () => {
    renderWithProviders(<UsersPage />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Usuarios' })).toBeInTheDocument();
    expect(screen.getByText('Administra quién accede a FISME-SIGOA')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Usuarios del sistema' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('La lista de usuarios estará disponible en la siguiente entrega.'),
    ).toBeInTheDocument();
  });
});
