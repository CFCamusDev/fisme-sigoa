import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ErrorState } from './error-state';

describe('ErrorState component', () => {
  it('renders alert with error illustration, title and message', () => {
    const { container } = render(
      <ErrorState
        title="Error al cargar la información"
        message="No se pudo obtener la lista de cursos."
      />,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('Error al cargar la información');
    expect(alert).toHaveTextContent('No se pudo obtener la lista de cursos.');

    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveAttribute('aria-hidden', 'true');
  });

  it('triggers onRetry callback when retry button is clicked', async () => {
    const handleRetry = vi.fn();
    const user = userEvent.setup();

    render(<ErrorState message="Fallo temporal de conexión." onRetry={handleRetry} />);

    const retryButton = screen.getByRole('button', { name: /Reintentar/i });
    expect(retryButton).toBeInTheDocument();
    await user.click(retryButton);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });
});
