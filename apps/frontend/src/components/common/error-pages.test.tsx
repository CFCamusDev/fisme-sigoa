import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NotFoundPage } from './not-found-page';
import { ForbiddenPage } from './forbidden-page';
import { UnexpectedErrorPage } from './unexpected-error-page';
import { renderWithProviders } from '@/test/render';

describe('Error Pages (404, 403, Unexpected Error)', () => {
  it('renders NotFoundPage with institutional copy, illustration and back link', async () => {
    const { container } = renderWithProviders(<NotFoundPage />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Página no encontrada' }),
    ).toBeInTheDocument();
    expect(screen.getByText('La ruta solicitada no existe o ha sido movida.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/');

    // Logo institucional presente
    expect(
      screen.getByAltText(/Universidad Nacional Toribio Rodríguez de Mendoza/i),
    ).toBeInTheDocument();

    // Ilustración decorativa presente
    const illustration = container.querySelector('img[aria-hidden="true"]');
    expect(illustration).toBeInTheDocument();
    expect(illustration).toHaveAttribute('alt', '');
  });

  it('renders ForbiddenPage with 403 institutional copy and link to dashboard', async () => {
    const { container } = renderWithProviders(<ForbiddenPage />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'No tienes acceso a esta sección' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/No cuentas con los permisos necesarios/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver al panel' })).toHaveAttribute('href', '/');

    const illustration = container.querySelector('img[aria-hidden="true"]');
    expect(illustration).toBeInTheDocument();
    expect(illustration).toHaveAttribute('alt', '');
  });

  it('renders UnexpectedErrorPage with generic safe copy and does not leak stack traces or internal errors', async () => {
    const secretTrace = 'InternalSecretError: /var/secrets/key.pem leaked in line 42';
    const handleRetry = vi.fn();
    const user = userEvent.setup();

    const { container } = renderWithProviders(<UnexpectedErrorPage onRetry={handleRetry} />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Algo salió mal' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'No pudimos completar la acción. Inténtalo de nuevo; si persiste, avisa al administrador.',
      ),
    ).toBeInTheDocument();

    // RNF-024 / RNF-037: Nunca debe existir la traza o mensaje interno en el DOM
    expect(screen.queryByText(new RegExp(secretTrace, 'i'))).not.toBeInTheDocument();
    expect(container.innerHTML).not.toContain('/var/secrets');

    const retryBtn = screen.getByRole('button', { name: 'Reintentar' });
    expect(retryBtn).toBeInTheDocument();
    await user.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledTimes(1);

    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/');
  });
});
