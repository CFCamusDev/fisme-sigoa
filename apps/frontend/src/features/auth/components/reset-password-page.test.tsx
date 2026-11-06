import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { ResetPasswordPage } from './reset-password-page';

const validToken = 'a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890';
const validPassword = 'NewSecurePassword123*';
const mockSuccessResponse = { status: 'PASSWORD_RESET' };

describe('ResetPasswordPage component (HU-005, T-005-17, CA2, RNF-003, RNF-034, RNF-036)', () => {
  it('renders both password fields with the policy hint', async () => {
    renderWithProviders(<ResetPasswordPage token={validToken} />);

    expect(
      await screen.findByRole('heading', { level: 1, name: /restablecer tu contraseña/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/define una nueva contraseña para tu cuenta\./i)).toBeInTheDocument();

    const passwordInput = screen.getByLabelText(/^nueva contraseña/i);
    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(passwordInput).toHaveAttribute('autocomplete', 'new-password');

    const confirmInput = screen.getByLabelText(/^confirmar contraseña/i);
    expect(confirmInput).toBeInTheDocument();
    expect(confirmInput).toHaveAttribute('type', 'password');
    expect(confirmInput).toHaveAttribute('autocomplete', 'new-password');

    expect(screen.getByText(/mínimo 10 caracteres, con letras y números/i)).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /restablecer contraseña/i })).toBeInTheDocument();
  });

  it('shows every unmet rule and sends nothing for a weak password', async () => {
    const user = userEvent.setup();
    let apiCalled = false;

    server.use(
      http.post('http://localhost:3000/auth/reset-password', () => {
        apiCalled = true;
        return HttpResponse.json(mockSuccessResponse);
      }),
    );

    renderWithProviders(<ResetPasswordPage token={validToken} />);

    const passwordInput = await screen.findByLabelText(/^nueva contraseña/i);
    const confirmInput = screen.getByLabelText(/^confirmar contraseña/i);

    // Contraseña débil (<10 caracteres y sin números)
    await user.type(passwordInput, 'abc');
    await user.type(confirmInput, 'abc');

    const submitBtn = screen.getByRole('button', { name: /restablecer contraseña/i });
    await user.click(submitBtn);

    expect(apiCalled).toBe(false);
    expect(
      await screen.findByText(/la contraseña debe tener al menos 10 caracteres/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/la contraseña debe incluir al menos un número/i)).toBeInTheDocument();
  });

  it('shows the confirmation mismatch', async () => {
    const user = userEvent.setup();
    let apiCalled = false;

    server.use(
      http.post('http://localhost:3000/auth/reset-password', () => {
        apiCalled = true;
        return HttpResponse.json(mockSuccessResponse);
      }),
    );

    renderWithProviders(<ResetPasswordPage token={validToken} />);

    const passwordInput = await screen.findByLabelText(/^nueva contraseña/i);
    const confirmInput = screen.getByLabelText(/^confirmar contraseña/i);

    await user.type(passwordInput, validPassword);
    await user.type(confirmInput, 'DifferentPassword456*');

    await user.click(screen.getByRole('button', { name: /restablecer contraseña/i }));

    expect(apiCalled).toBe(false);
    expect(await screen.findByText(/las contraseñas no coinciden/i)).toBeInTheDocument();
  });

  it('shows the success state with the sessions notice after resetting (CA2) and focuses its heading', async () => {
    const user = userEvent.setup();
    let capturedBody: unknown = null;

    server.use(
      http.post('http://localhost:3000/auth/reset-password', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(mockSuccessResponse, { status: 200 });
      }),
    );

    renderWithProviders(<ResetPasswordPage token={validToken} />);

    const passwordInput = await screen.findByLabelText(/^nueva contraseña/i);
    const confirmInput = screen.getByLabelText(/^confirmar contraseña/i);

    await user.type(passwordInput, validPassword);
    await user.type(confirmInput, validPassword);

    await user.click(screen.getByRole('button', { name: /restablecer contraseña/i }));

    const successHeading = await screen.findByRole('heading', {
      level: 1,
      name: /contraseña actualizada/i,
    });
    expect(successHeading).toBeInTheDocument();
    expect(successHeading).toHaveFocus();

    expect(capturedBody).toEqual({
      token: validToken,
      password: validPassword,
    });
    expect((capturedBody as Record<string, unknown>).confirmPassword).toBeUndefined();

    expect(
      screen.getByText(
        /tu contraseña se actualizó y cerramos tus sesiones abiertas\. inicia sesión con la nueva contraseña\./i,
      ),
    ).toBeInTheDocument();

    const loginLink = screen.getByRole('link', { name: /ir a iniciar sesión/i });
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute('href', '/login');

    expect(screen.queryByLabelText(/^nueva contraseña/i)).not.toBeInTheDocument();
  });

  it('shows the invalid link state for INVALID_PASSWORD_RESET_TOKEN', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('http://localhost:3000/auth/reset-password', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'INVALID_PASSWORD_RESET_TOKEN',
              message: 'El token de restablecimiento es inválido o ha expirado.',
            },
          },
          { status: 400 },
        );
      }),
    );

    renderWithProviders(<ResetPasswordPage token={validToken} />);

    const passwordInput = await screen.findByLabelText(/^nueva contraseña/i);
    const confirmInput = screen.getByLabelText(/^confirmar contraseña/i);

    await user.type(passwordInput, validPassword);
    await user.type(confirmInput, validPassword);

    await user.click(screen.getByRole('button', { name: /restablecer contraseña/i }));

    const invalidHeading = await screen.findByRole('heading', {
      level: 1,
      name: /el enlace no es válido o venció\./i,
    });
    expect(invalidHeading).toBeInTheDocument();
    expect(invalidHeading).toHaveFocus();

    expect(
      screen.getByText(/solicita uno nuevo desde «¿olvidaste tu contraseña\?»\./i),
    ).toBeInTheDocument();

    const requestNewLink = screen.getByRole('link', { name: /solicitar un enlace nuevo/i });
    expect(requestNewLink).toBeInTheDocument();
    expect(requestNewLink).toHaveAttribute('href', '/recuperar-contrasena');

    const loginLink = screen.getByRole('link', { name: /ir a iniciar sesión/i });
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute('href', '/login');

    expect(screen.queryByLabelText(/^nueva contraseña/i)).not.toBeInTheDocument();
  });

  it('shows the invalid link state without sending anything for an empty or oversized token', async () => {
    let apiCalled = false;
    server.use(
      http.post('http://localhost:3000/auth/reset-password', () => {
        apiCalled = true;
        return HttpResponse.json(mockSuccessResponse);
      }),
    );

    // Token vacío
    const { unmount } = renderWithProviders(<ResetPasswordPage token="" />);

    expect(apiCalled).toBe(false);
    expect(
      await screen.findByRole('heading', { level: 1, name: /el enlace no es válido o venció\./i }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/^nueva contraseña/i)).not.toBeInTheDocument();
    unmount();

    // Token sobredimensionado (> 128 chars)
    const oversizedToken = 'b'.repeat(129);
    renderWithProviders(<ResetPasswordPage token={oversizedToken} />);

    expect(apiCalled).toBe(false);
    expect(
      await screen.findByRole('heading', { level: 1, name: /el enlace no es válido o venció\./i }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/^nueva contraseña/i)).not.toBeInTheDocument();
  });

  it('shows the policy details returned by the server under the password field', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('http://localhost:3000/auth/reset-password', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'La solicitud contiene errores de validación.',
              details: [
                {
                  path: 'body.password',
                  message: 'La contraseña no cumple con los requisitos del servidor.',
                },
              ],
            },
          },
          { status: 400 },
        );
      }),
    );

    renderWithProviders(<ResetPasswordPage token={validToken} />);

    const passwordInput = await screen.findByLabelText(/^nueva contraseña/i);
    const confirmInput = screen.getByLabelText(/^confirmar contraseña/i);

    await user.type(passwordInput, validPassword);
    await user.type(confirmInput, validPassword);

    await user.click(screen.getByRole('button', { name: /restablecer contraseña/i }));

    expect(
      await screen.findByText(/la contraseña no cumple con los requisitos del servidor\./i),
    ).toBeInTheDocument();
  });

  it('clears the fields and shows a rate limit message on 429', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('http://localhost:3000/auth/reset-password', () => {
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

    renderWithProviders(<ResetPasswordPage token={validToken} />);

    const passwordInput = await screen.findByLabelText(/^nueva contraseña/i);
    const confirmInput = screen.getByLabelText(/^confirmar contraseña/i);

    await user.type(passwordInput, validPassword);
    await user.type(confirmInput, validPassword);

    await user.click(screen.getByRole('button', { name: /restablecer contraseña/i }));

    expect(
      await screen.findByText(
        /hiciste demasiados intentos\. espera un minuto e inténtalo de nuevo\./i,
      ),
    ).toBeInTheDocument();

    expect(passwordInput).toHaveValue('');
    expect(confirmInput).toHaveValue('');
    expect(passwordInput).toHaveFocus();
  });

  it('sends one request when the form is submitted twice quickly under StrictMode', async () => {
    const user = userEvent.setup();
    let callCount = 0;

    server.use(
      http.post('http://localhost:3000/auth/reset-password', async () => {
        callCount++;
        await delay(30);
        return HttpResponse.json(mockSuccessResponse, { status: 200 });
      }),
    );

    renderWithProviders(<ResetPasswordPage token={validToken} />);

    const passwordInput = await screen.findByLabelText(/^nueva contraseña/i);
    const confirmInput = screen.getByLabelText(/^confirmar contraseña/i);

    await user.type(passwordInput, validPassword);
    await user.type(confirmInput, validPassword);

    const submitBtn = screen.getByRole('button', { name: /restablecer contraseña/i });
    await user.dblClick(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /contraseña actualizada/i }),
      ).toBeInTheDocument();
    });

    expect(callCount).toBe(1);
  });
});
