import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoginPage } from './login-page';

describe('LoginPage component', () => {
  it('renders login header and access button', () => {
    render(<LoginPage />);

    expect(screen.getByRole('heading', { name: /iniciar sesión/i })).toBeInTheDocument();
    expect(
      screen.getByText(/ingresa tus credenciales institucionales para acceder al sistema/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /acceder al sistema/i })).toBeInTheDocument();
  });
});
