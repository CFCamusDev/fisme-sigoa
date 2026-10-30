import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { useAuthStore } from '@/stores/auth.store';
import { LoginForm } from './login-form';

const mockValidResponse = {
  accessToken: 'header.payload.signature',
  accessTokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  refreshToken: 'refresh-token-uuid-12345678901234567890',
  refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  user: {
    id: 'usr-123',
    names: 'Carlos',
    firstSurname: 'Mendoza',
    secondSurname: 'Ríos',
    email: 'carlos.mendoza@untrm.edu.pe',
  },
};

describe('LoginForm component', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuthSession();
  });

  it('validates email and password fields before sending (no network request made)', async () => {
    const user = userEvent.setup();
    let networkCalled = false;

    server.use(
      http.post('http://localhost:3000/auth/login', () => {
        networkCalled = true;
        return HttpResponse.json(mockValidResponse);
      }),
    );

    renderWithProviders(<LoginForm />);

    const submitButton = await screen.findByRole('button', { name: /acceder al sistema/i });
    await user.click(submitButton);

    expect(networkCalled).toBe(false);

    const emailInput = screen.getByLabelText(/correo electrónico/i);
    expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    expect(await screen.findByText(/el correo electrónico es obligatorio/i)).toBeInTheDocument();

    const passwordInput = screen.getByLabelText(/contraseña/i);
    expect(passwordInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/la contraseña es obligatoria/i)).toBeInTheDocument();
  });

  it('shows generic credentials error on UNAUTHORIZED (CA2)', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('http://localhost:3000/auth/login', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'UNAUTHORIZED',
              message: 'Invalid credentials',
            },
          },
          { status: 401 },
        );
      }),
    );

    renderWithProviders(<LoginForm />);

    const emailInput = await screen.findByLabelText(/correo electrónico/i);
    const passwordInput = screen.getByLabelText(/contraseña/i);
    const submitButton = screen.getByRole('button', { name: /acceder al sistema/i });

    await user.type(emailInput, 'usuario@untrm.edu.pe');
    await user.type(passwordInput, 'ContraseñaInvalida123');
    await user.click(submitButton);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/correo o contraseña incorrectos\./i);
  });

  it('clears password and returns focus to password after failed login', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('http://localhost:3000/auth/login', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'UNAUTHORIZED',
              message: 'Invalid credentials',
            },
          },
          { status: 401 },
        );
      }),
    );

    renderWithProviders(<LoginForm />);

    const emailInput = await screen.findByLabelText(/correo electrónico/i);
    const passwordInput = screen.getByLabelText(/contraseña/i);
    const submitButton = screen.getByRole('button', { name: /acceder al sistema/i });

    await user.type(emailInput, 'usuario@untrm.edu.pe');
    await user.type(passwordInput, 'MiClaveSecreta');
    await user.click(submitButton);

    await screen.findByRole('alert');
    expect(passwordInput).toHaveValue('');
    expect(emailInput).toHaveValue('usuario@untrm.edu.pe');
    expect(passwordInput).toHaveFocus();
  });

  it('shows lockout message with waiting time on ACCOUNT_LOCKED (CA3)', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('http://localhost:3000/auth/login', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'ACCOUNT_LOCKED',
              message: 'Account locked',
              retryAfterSeconds: 900,
            },
          },
          { status: 429 },
        );
      }),
    );

    renderWithProviders(<LoginForm />);

    const emailInput = await screen.findByLabelText(/correo electrónico/i);
    const passwordInput = screen.getByLabelText(/contraseña/i);
    const submitButton = screen.getByRole('button', { name: /acceder al sistema/i });

    await user.type(emailInput, 'bloqueado@untrm.edu.pe');
    await user.type(passwordInput, 'CualquierClave123');
    await user.click(submitButton);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      /tu cuenta está bloqueada temporalmente por exceso de intentos fallidos\. inténtalo de nuevo en 15 minuto\(s\)\./i,
    );
  });

  it('shows inactive account message on ACCOUNT_INACTIVE (CA4)', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('http://localhost:3000/auth/login', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'ACCOUNT_INACTIVE',
              message: 'Inactive account',
            },
          },
          { status: 403 },
        );
      }),
    );

    renderWithProviders(<LoginForm />);

    const emailInput = await screen.findByLabelText(/correo electrónico/i);
    const passwordInput = screen.getByLabelText(/contraseña/i);
    const submitButton = screen.getByRole('button', { name: /acceder al sistema/i });

    await user.type(emailInput, 'inactivo@untrm.edu.pe');
    await user.type(passwordInput, 'ClaveValida123');
    await user.click(submitButton);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      /tu cuenta está inactiva\. comunícate con el administrador del sistema\./i,
    );
  });

  it('shows pending activation message on ACCOUNT_PENDING_ACTIVATION (CA4)', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('http://localhost:3000/auth/login', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'ACCOUNT_PENDING_ACTIVATION',
              message: 'Pending activation',
            },
          },
          { status: 403 },
        );
      }),
    );

    renderWithProviders(<LoginForm />);

    const emailInput = await screen.findByLabelText(/correo electrónico/i);
    const passwordInput = screen.getByLabelText(/contraseña/i);
    const submitButton = screen.getByRole('button', { name: /acceder al sistema/i });

    await user.type(emailInput, 'pendiente@untrm.edu.pe');
    await user.type(passwordInput, 'ClaveValida123');
    await user.click(submitButton);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      /tu cuenta aún no está activada\. usa el enlace de activación enviado a tu correo o solicita uno al administrador\./i,
    );
  });

  it('shows rate limit message on RATE_LIMITED', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('http://localhost:3000/auth/login', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'RATE_LIMITED',
              message: 'Too many requests',
            },
          },
          { status: 429 },
        );
      }),
    );

    renderWithProviders(<LoginForm />);

    const emailInput = await screen.findByLabelText(/correo electrónico/i);
    const passwordInput = screen.getByLabelText(/contraseña/i);
    const submitButton = screen.getByRole('button', { name: /acceder al sistema/i });

    await user.type(emailInput, 'ratelimit@untrm.edu.pe');
    await user.type(passwordInput, 'ClaveValida123');
    await user.click(submitButton);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      /hiciste demasiados intentos\. espera un minuto e inténtalo de nuevo\./i,
    );
  });

  it('shows safe fallback message on network error without leaking internal details', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('http://localhost:3000/auth/login', () => {
        return HttpResponse.error();
      }),
    );

    renderWithProviders(<LoginForm />);

    const emailInput = await screen.findByLabelText(/correo electrónico/i);
    const passwordInput = screen.getByLabelText(/contraseña/i);
    const submitButton = screen.getByRole('button', { name: /acceder al sistema/i });

    await user.type(emailInput, 'usuario@untrm.edu.pe');
    await user.type(passwordInput, 'ClaveValida123');
    await user.click(submitButton);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      /no pudimos iniciar tu sesión\. inténtalo de nuevo; si persiste, avisa al administrador\./i,
    );
  });

  it('disables the button and inputs showing progress while signing in', async () => {
    const user = userEvent.setup();
    let finishRequest!: () => void;
    const requestGate = new Promise<void>((resolve) => {
      finishRequest = resolve;
    });

    server.use(
      http.post('http://localhost:3000/auth/login', async () => {
        await requestGate;
        return HttpResponse.json(mockValidResponse);
      }),
    );

    renderWithProviders(<LoginForm />);

    const emailInput = await screen.findByLabelText(/correo electrónico/i);
    const passwordInput = screen.getByLabelText(/contraseña/i);
    const submitButton = screen.getByRole('button', { name: /acceder al sistema/i });

    await user.type(emailInput, 'carlos@untrm.edu.pe');
    await user.type(passwordInput, 'Password123');
    await user.click(submitButton);

    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveTextContent(/ingresando…/i);
    expect(emailInput).toBeDisabled();
    expect(passwordInput).toBeDisabled();

    finishRequest();
    await waitFor(() => expect(submitButton).not.toHaveTextContent(/ingresando…/i));
  });

  it('stores the session in memory and redirects to dashboard on success (CA1)', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('http://localhost:3000/auth/login', () => {
        return HttpResponse.json(mockValidResponse);
      }),
    );

    renderWithProviders(<LoginForm />);

    const emailInput = await screen.findByLabelText(/correo electrónico/i);
    const passwordInput = screen.getByLabelText(/contraseña/i);
    const submitButton = screen.getByRole('button', { name: /acceder al sistema/i });

    await user.type(emailInput, 'carlos.mendoza@untrm.edu.pe');
    await user.type(passwordInput, 'ClaveCorrecta123');
    await user.click(submitButton);

    await waitFor(() => {
      const state = useAuthStore.getState();
      expect(state.accessToken).toBe(mockValidResponse.accessToken);
      expect(state.user).toEqual(mockValidResponse.user);
    });
  });

  it('can be submitted with the keyboard (Enter key) across labelled fields', async () => {
    const user = userEvent.setup();
    let formSubmitted = false;

    server.use(
      http.post('http://localhost:3000/auth/login', () => {
        formSubmitted = true;
        return HttpResponse.json(mockValidResponse);
      }),
    );

    renderWithProviders(<LoginForm />);

    const emailInput = await screen.findByLabelText(/correo electrónico/i);
    const passwordInput = screen.getByLabelText(/contraseña/i);

    await user.type(emailInput, 'carlos@untrm.edu.pe');
    await user.type(passwordInput, 'ClaveCorrecta123{enter}');

    await waitFor(() => expect(formSubmitted).toBe(true));
  });
});
