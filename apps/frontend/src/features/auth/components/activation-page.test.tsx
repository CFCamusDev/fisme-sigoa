import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { ActivationPage } from './activation-page';

const validToken = 'd7a4f9b2c3e1456789abcdef0123456789abcdef0123456789abcdef01234567';
const validPassword = 'StrongPassword123*';
const mockSuccessResponse = { status: 'ACTIVE' };

describe('ActivationPage component (HU-004, T-004-16, CA1, CA2, CA3)', () => {
  it('renders the form with labelled fields, the policy hint and new-password autocomplete', async () => {
    renderWithProviders(<ActivationPage token={validToken} />);

    expect(
      await screen.findByRole('heading', { level: 1, name: /activar tu cuenta/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/define tu contraseña para activar tu acceso al sistema/i),
    ).toBeInTheDocument();

    const passwordInput = screen.getByLabelText(/nueva contraseña/i);
    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(passwordInput).toHaveAttribute('autocomplete', 'new-password');

    const confirmInput = screen.getByLabelText(/confirmar contraseña/i);
    expect(confirmInput).toBeInTheDocument();
    expect(confirmInput).toHaveAttribute('type', 'password');
    expect(confirmInput).toHaveAttribute('autocomplete', 'new-password');

    expect(screen.getByText(/mínimo 10 caracteres, con letras y números/i)).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /activar cuenta/i })).toBeInTheDocument();
  });

  it('shows every violated policy rule and does not call the API (CA3)', async () => {
    const user = userEvent.setup();
    let apiCalled = false;

    server.use(
      http.post('http://localhost:3000/auth/activate', () => {
        apiCalled = true;
        return HttpResponse.json(mockSuccessResponse);
      }),
    );

    renderWithProviders(<ActivationPage token={validToken} />);

    const passwordInput = await screen.findByLabelText(/nueva contraseña/i);
    const confirmInput = screen.getByLabelText(/confirmar contraseña/i);

    // Contraseña débil (<10 chars, sin números)
    await user.type(passwordInput, 'abc');
    await user.type(confirmInput, 'abc');

    const submitBtn = screen.getByRole('button', { name: /activar cuenta/i });
    await user.click(submitBtn);

    expect(apiCalled).toBe(false);

    expect(
      await screen.findByText(/la contraseña debe tener al menos 10 caracteres/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/la contraseña debe incluir al menos un número/i)).toBeInTheDocument();
  });

  it('shows a mismatch error when confirmation does not match', async () => {
    const user = userEvent.setup();
    let apiCalled = false;

    server.use(
      http.post('http://localhost:3000/auth/activate', () => {
        apiCalled = true;
        return HttpResponse.json(mockSuccessResponse);
      }),
    );

    renderWithProviders(<ActivationPage token={validToken} />);

    const passwordInput = await screen.findByLabelText(/nueva contraseña/i);
    const confirmInput = screen.getByLabelText(/confirmar contraseña/i);

    await user.type(passwordInput, validPassword);
    await user.type(confirmInput, 'DifferentPassword123*');

    await user.click(screen.getByRole('button', { name: /activar cuenta/i }));

    expect(apiCalled).toBe(false);
    expect(await screen.findByText(/las contraseñas no coinciden/i)).toBeInTheDocument();
  });

  it('activates the account, sends only token and password and shows success state (CA1)', async () => {
    const user = userEvent.setup();
    let capturedBody: unknown = null;

    server.use(
      http.post('http://localhost:3000/auth/activate', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(mockSuccessResponse, { status: 200 });
      }),
    );

    renderWithProviders(<ActivationPage token={validToken} />);

    const passwordInput = await screen.findByLabelText(/nueva contraseña/i);
    const confirmInput = screen.getByLabelText(/confirmar contraseña/i);

    await user.type(passwordInput, validPassword);
    await user.type(confirmInput, validPassword);

    await user.click(screen.getByRole('button', { name: /activar cuenta/i }));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /cuenta activada/i }),
      ).toBeInTheDocument();
    });

    expect(capturedBody).toEqual({
      token: validToken,
      password: validPassword,
    });
    // La confirmación nunca se envía al backend
    expect((capturedBody as Record<string, unknown>).confirmPassword).toBeUndefined();

    expect(
      screen.getByText(/tu cuenta está activa\. ya puedes iniciar sesión\./i),
    ).toBeInTheDocument();
    const loginLink = screen.getByRole('link', { name: /ir a iniciar sesión/i });
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute('href', '/login');

    // El formulario ya no debe existir
    expect(screen.queryByLabelText(/nueva contraseña/i)).not.toBeInTheDocument();
  });

  it('sends a single request when the form is submitted twice quickly (D6)', async () => {
    const user = userEvent.setup();
    let callCount = 0;

    server.use(
      http.post('http://localhost:3000/auth/activate', async () => {
        callCount++;
        await delay(50);
        return HttpResponse.json(mockSuccessResponse, { status: 200 });
      }),
    );

    renderWithProviders(<ActivationPage token={validToken} />);

    const passwordInput = await screen.findByLabelText(/nueva contraseña/i);
    const confirmInput = screen.getByLabelText(/confirmar contraseña/i);

    await user.type(passwordInput, validPassword);
    await user.type(confirmInput, validPassword);

    const submitBtn = screen.getByRole('button', { name: /activar cuenta/i });
    await user.dblClick(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /cuenta activada/i }),
      ).toBeInTheDocument();
    });

    expect(callCount).toBe(1);
  });

  it('disables the fields and shows Activando… while pending', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('http://localhost:3000/auth/activate', async () => {
        await delay(100);
        return HttpResponse.json(mockSuccessResponse, { status: 200 });
      }),
    );

    renderWithProviders(<ActivationPage token={validToken} />);

    const passwordInput = await screen.findByLabelText(/nueva contraseña/i);
    const confirmInput = screen.getByLabelText(/confirmar contraseña/i);
    await user.type(passwordInput, validPassword);
    await user.type(confirmInput, validPassword);

    const submitBtn = screen.getByRole('button', { name: /activar cuenta/i });
    await user.click(submitBtn);

    expect(await screen.findByRole('button', { name: /activando…/i })).toBeDisabled();
    expect(passwordInput).toBeDisabled();
    expect(confirmInput).toBeDisabled();

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /cuenta activada/i }),
      ).toBeInTheDocument();
    });
  });

  it('shows the invalid link state with the CA2 text and guidance (INVALID_ACTIVATION_TOKEN)', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('http://localhost:3000/auth/activate', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'INVALID_ACTIVATION_TOKEN',
              message: 'El enlace no es válido o venció.',
            },
          },
          { status: 400 },
        );
      }),
    );

    renderWithProviders(<ActivationPage token={validToken} />);

    const passwordInput = await screen.findByLabelText(/nueva contraseña/i);
    const confirmInput = screen.getByLabelText(/confirmar contraseña/i);

    await user.type(passwordInput, validPassword);
    await user.type(confirmInput, validPassword);

    await user.click(screen.getByRole('button', { name: /activar cuenta/i }));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /el enlace no es válido o venció\./i }),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/solicita uno nuevo al administrador del sistema\./i),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ir a iniciar sesión/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/nueva contraseña/i)).not.toBeInTheDocument();
  });

  it('shows the invalid link state without calling the API when the token is oversized', async () => {
    let apiCalled = false;
    server.use(
      http.post('http://localhost:3000/auth/activate', () => {
        apiCalled = true;
        return HttpResponse.json(mockSuccessResponse);
      }),
    );

    const oversizedToken = 'a'.repeat(129);
    renderWithProviders(<ActivationPage token={oversizedToken} />);

    expect(apiCalled).toBe(false);
    expect(
      await screen.findByRole('heading', { level: 1, name: /el enlace no es válido o venció\./i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/solicita uno nuevo al administrador del sistema\./i),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/nueva contraseña/i)).not.toBeInTheDocument();
  });

  it('shows a recoverable alert for rate limit, clears fields and focuses password (D7)', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('http://localhost:3000/auth/activate', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'RATE_LIMITED',
              message: 'Has excedido el límite de solicitudes.',
            },
          },
          { status: 429 },
        );
      }),
    );

    renderWithProviders(<ActivationPage token={validToken} />);

    const passwordInput = await screen.findByLabelText(/nueva contraseña/i);
    const confirmInput = screen.getByLabelText(/confirmar contraseña/i);
    await user.type(passwordInput, validPassword);
    await user.type(confirmInput, validPassword);

    await user.click(screen.getByRole('button', { name: /activar cuenta/i }));

    expect(
      await screen.findByText(
        /hiciste demasiados intentos\. espera un minuto e inténtalo de nuevo\./i,
      ),
    ).toBeInTheDocument();

    // Campos vaciados y foco devuelto
    expect(passwordInput).toHaveValue('');
    expect(confirmInput).toHaveValue('');
    expect(passwordInput).toHaveFocus();
  });

  it('maps server password details to the field', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('http://localhost:3000/auth/activate', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'La solicitud contiene errores de validación.',
              details: [
                {
                  path: 'body.password',
                  message: 'La contraseña fue rechazada por la política del servidor.',
                },
              ],
            },
          },
          { status: 400 },
        );
      }),
    );

    renderWithProviders(<ActivationPage token={validToken} />);

    const passwordInput = await screen.findByLabelText(/nueva contraseña/i);
    const confirmInput = screen.getByLabelText(/confirmar contraseña/i);
    await user.type(passwordInput, validPassword);
    await user.type(confirmInput, validPassword);

    await user.click(screen.getByRole('button', { name: /activar cuenta/i }));

    expect(
      await screen.findByText(/la contraseña fue rechazada por la política del servidor\./i),
    ).toBeInTheDocument();
  });

  it('moves focus to the status heading in the final states', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('http://localhost:3000/auth/activate', () => {
        return HttpResponse.json(mockSuccessResponse, { status: 200 });
      }),
    );

    renderWithProviders(<ActivationPage token={validToken} />);

    const passwordInput = await screen.findByLabelText(/nueva contraseña/i);
    const confirmInput = screen.getByLabelText(/confirmar contraseña/i);
    await user.type(passwordInput, validPassword);
    await user.type(confirmInput, validPassword);

    await user.click(screen.getByRole('button', { name: /activar cuenta/i }));

    const successHeading = await screen.findByRole('heading', {
      level: 1,
      name: /cuenta activada/i,
    });
    expect(successHeading).toHaveFocus();
  });

  it('does not render the token anywhere in the page DOM', async () => {
    const secretToken = 'secret-token-1234567890abcdef-uniquely-identifiable';
    const { container } = renderWithProviders(<ActivationPage token={secretToken} />);

    await screen.findByRole('heading', { level: 1, name: /activar tu cuenta/i });
    expect(screen.queryByText(new RegExp(secretToken, 'i'))).not.toBeInTheDocument();
    expect(container.innerHTML.includes(secretToken)).toBe(false);
  });
});
