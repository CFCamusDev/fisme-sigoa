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
    expect(screen.queryByText(/tu sesión expiró/i)).not.toBeInTheDocument();
  });

  it('renders a warning banner when the session has expired (CA3)', async () => {
    renderWithProviders(<LoginPage reason="session-expired" />);

    const warningNotice = await screen.findByRole('status');
    expect(warningNotice).toBeInTheDocument();
    expect(warningNotice).toHaveTextContent(/tu sesión expiró\. inicia sesión nuevamente\./i);
  });
});
