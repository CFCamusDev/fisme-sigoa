import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './empty-state';

describe('EmptyState component', () => {
  it('renders default empty illustration with decorative attributes and title', () => {
    const { container } = render(
      <EmptyState
        title="No hay constituyentes registrados"
        description="Añada el primer constituyente para iniciar el proceso."
      />,
    );

    const heading = screen.getByRole('heading', {
      level: 3,
      name: 'No hay constituyentes registrados',
    });
    expect(heading).toBeInTheDocument();
    expect(
      screen.getByText('Añada el primer constituyente para iniciar el proceso.'),
    ).toBeInTheDocument();

    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders action element when passed', () => {
    render(
      <EmptyState title="Sin registros" action={<button type="button">Crear registro</button>} />,
    );

    expect(screen.getByRole('button', { name: 'Crear registro' })).toBeInTheDocument();
  });

  it('renders icon instead of illustration when icon prop is provided', () => {
    const { container } = render(
      <EmptyState title="Tabla vacía" icon={<span data-testid="custom-icon">ICON</span>} />,
    );

    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    expect(container.querySelector('img')).not.toBeInTheDocument();
  });
});
