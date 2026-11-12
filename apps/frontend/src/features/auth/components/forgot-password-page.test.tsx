import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { ForgotPasswordPage } from './forgot-password-page';

describe('ForgotPasswordPage component (HU-005, T-005-17, CA1, RNF-034, RNF-036)', () => {
  it('renders the email field, the submit button and the back link', async () => {
    renderWithProviders(<ForgotPasswordPage />);

    expect(
      await screen.findByRole('heading', { level: 1, name: /¿olvidaste tu contraseña\?/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /ingresa tu correo institucional y te enviaremos un enlace para restablecerla\./i,
      ),
    ).toBeInTheDocument();

    const emailInput = screen.getByLabelText(/correo electrónico/i);
    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toHaveAttribute('type', 'email');
    expect(emailInput).toHaveAttribute('autocomplete', 'email');

    const submitBtn = screen.getByRole('button', { name: /enviar enlace/i });
    expect(submitBtn).toBeInTheDocument();

    const backLink = screen.getByRole('link', { name: /volver a iniciar sesión/i });
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute('href', '/login');
  });

  it('shows the email validation message and sends nothing for an invalid email', async () => {
    const user = userEvent.setup();
    let apiCalled = false;

    server.use(
      http.post('http://localhost:3000/auth/forgot-password', () => {
        apiCalled = true;
        return HttpResponse.json({ status: 'RECEIVED' }, { status: 202 });
      }),
    );

    renderWithProviders(<ForgotPasswordPage />);

    const emailInput = await screen.findByLabelText(/correo electrónico/i);
    await user.type(emailInput, 'correo-invalido');

    const submitBtn = screen.getByRole('button', { name: /enviar enlace/i });
    await user.click(submitBtn);

    expect(apiCalled).toBe(false);
    expect(
      await screen.findByText(/el formato del correo electrónico es inválido/i),
    ).toBeInTheDocument();
  });

  it('shows the generic confirmation after sending (CA1)', async () => {
    const user = userEvent.setup();
    let capturedBody: unknown = null;

    server.use(
      http.post('http://localhost:3000/auth/forgot-password', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ status: 'RECEIVED' }, { status: 202 });
      }),
    );

    renderWithProviders(<ForgotPasswordPage />);

    const emailInput = await screen.findByLabelText(/correo electrónico/i);
    await user.type(emailInput, 'usuario.activo@untrm.edu.pe');

    const submitBtn = screen.getByRole('button', { name: /enviar enlace/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /revisa tu correo/i }),
      ).toBeInTheDocument();
    });

    expect(capturedBody).toEqual({
      email: 'usuario.activo@untrm.edu.pe',
    });

    expect(
      screen.getByText(
        /si el correo existe, recibirás un enlace para restablecer tu contraseña\./i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /el enlace es de un solo uso y vence en 48 horas\. si no lo ves, revisa tu carpeta de correo no deseado\./i,
      ),
    ).toBeInTheDocument();

    const returnBtn = screen.getByRole('link', { name: /volver a iniciar sesión/i });
    expect(returnBtn).toBeInTheDocument();
    expect(returnBtn).toHaveAttribute('href', '/login');

    // El formulario de envío ya no se muestra
    expect(screen.queryByLabelText(/correo electrónico/i)).not.toBeInTheDocument();
  });

  it('shows the same confirmation whatever the email (CA1)', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('http://localhost:3000/auth/forgot-password', () => {
        return HttpResponse.json({ status: 'RECEIVED' }, { status: 202 });
      }),
    );

    renderWithProviders(<ForgotPasswordPage />);

    const emailInput = await screen.findByLabelText(/correo electrónico/i);
    await user.type(emailInput, 'desconocido-completamente@untrm.edu.pe');

    await user.click(screen.getByRole('button', { name: /enviar enlace/i }));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /revisa tu correo/i }),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        /si el correo existe, recibirás un enlace para restablecer tu contraseña\./i,
      ),
    ).toBeInTheDocument();
  });

  it('keeps the email and shows a rate limit message on 429', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('http://localhost:3000/auth/forgot-password', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'RATE_LIMITED',
              message: 'Demasiadas solicitudes.',
            },
          },
          { status: 429 },
        );
      }),
    );

    renderWithProviders(<ForgotPasswordPage />);

    const emailInput = await screen.findByLabelText(/correo electrónico/i);
    await user.type(emailInput, 'ratelimited@untrm.edu.pe');

    await user.click(screen.getByRole('button', { name: /enviar enlace/i }));

    expect(
      await screen.findByText(
        /hiciste demasiados intentos\. espera un minuto e inténtalo de nuevo\./i,
      ),
    ).toBeInTheDocument();

    // Conserva el valor escrito
    expect(emailInput).toHaveValue('ratelimited@untrm.edu.pe');
    expect(emailInput).toHaveFocus();
  });

  it('shows a generic error message on a network failure and keeps the form', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('http://localhost:3000/auth/forgot-password', () => {
        return HttpResponse.error();
      }),
    );

    renderWithProviders(<ForgotPasswordPage />);

    const emailInput = await screen.findByLabelText(/correo electrónico/i);
    await user.type(emailInput, 'networkerror@untrm.edu.pe');

    await user.click(screen.getByRole('button', { name: /enviar enlace/i }));

    expect(
      await screen.findByText(
        /no pudimos procesar tu solicitud\. inténtalo de nuevo; si persiste, avisa al administrador\./i,
      ),
    ).toBeInTheDocument();

    expect(emailInput).toHaveValue('networkerror@untrm.edu.pe');
  });

  it('disables the button and the field while sending', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('http://localhost:3000/auth/forgot-password', async () => {
        await delay(100);
        return HttpResponse.json({ status: 'RECEIVED' }, { status: 202 });
      }),
    );

    renderWithProviders(<ForgotPasswordPage />);

    const emailInput = await screen.findByLabelText(/correo electrónico/i);
    await user.type(emailInput, 'test@untrm.edu.pe');

    const submitBtn = screen.getByRole('button', { name: /enviar enlace/i });
    await user.click(submitBtn);

    expect(await screen.findByRole('button', { name: /enviando…/i })).toBeDisabled();
    expect(emailInput).toBeDisabled();

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /revisa tu correo/i }),
      ).toBeInTheDocument();
    });
  });

  it('moves focus to the confirmation heading', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('http://localhost:3000/auth/forgot-password', () => {
        return HttpResponse.json({ status: 'RECEIVED' }, { status: 202 });
      }),
    );

    renderWithProviders(<ForgotPasswordPage />);

    const emailInput = await screen.findByLabelText(/correo electrónico/i);
    await user.type(emailInput, 'focus@untrm.edu.pe');

    await user.click(screen.getByRole('button', { name: /enviar enlace/i }));

    const confirmationHeading = await screen.findByRole('heading', {
      level: 1,
      name: /revisa tu correo/i,
    });
    expect(confirmationHeading).toHaveFocus();
  });

  it('sends one request when the form is submitted twice quickly under StrictMode', async () => {
    const user = userEvent.setup();
    let callCount = 0;

    server.use(
      http.post('http://localhost:3000/auth/forgot-password', async () => {
        callCount++;
        await delay(30);
        return HttpResponse.json({ status: 'RECEIVED' }, { status: 202 });
      }),
    );

    renderWithProviders(<ForgotPasswordPage />);

    const emailInput = await screen.findByLabelText(/correo electrónico/i);
    await user.type(emailInput, 'concurrent@untrm.edu.pe');

    const submitBtn = screen.getByRole('button', { name: /enviar enlace/i });
    await user.dblClick(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /revisa tu correo/i }),
      ).toBeInTheDocument();
    });

    expect(callCount).toBe(1);
  });
});
