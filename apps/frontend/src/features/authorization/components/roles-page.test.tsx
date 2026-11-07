import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RolesPage } from './roles-page';

describe('RolesPage (HU-006, T-006-02)', () => {
  it('renders the title and the empty state', () => {
    render(<RolesPage />);

    expect(screen.getByRole('heading', { name: 'Roles', level: 1 })).toBeInTheDocument();
    expect(
      screen.getByText('Administra los grupos de permisos de FISME-SIGOA'),
    ).toBeInTheDocument();
    expect(screen.getByText('No hay roles registrados')).toBeInTheDocument();
    expect(screen.getByText('Aún no se han configurado roles en el sistema.')).toBeInTheDocument();
  });
});
