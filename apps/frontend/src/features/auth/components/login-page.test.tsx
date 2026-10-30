import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { LoginPage } from './login-page';

describe('LoginPage component', () => {
  it('renders login header and form controls', async () => {
    renderWithProviders(<LoginPage />);

    expect(await screen.findByRole('heading', { name: /iniciar sesión/i })).toBeInTheDocument();
    expect(
      screen.getByText(/ingresa tus credenciales institucionales para acceder al sistema/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /acceder al sistema/i })).toBeInTheDocument();
  });
});
