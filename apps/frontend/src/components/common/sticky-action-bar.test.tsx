import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StickyActionBar } from './sticky-action-bar';

describe('StickyActionBar', () => {
  it('shows the unsaved changes count and its actions', () => {
    render(
      <StickyActionBar status="3 cambios sin guardar">
        <button type="button">Descartar</button>
        <button type="submit">Guardar</button>
      </StickyActionBar>,
    );

    const bar = screen.getByTestId('sticky-action-bar');
    expect(bar).toHaveClass(
      'sticky',
      'bottom-0',
      'z-20',
      'bg-card',
      'text-card-foreground',
      'shadow-md',
    );

    const status = screen.getByText('3 cambios sin guardar');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument();
  });
});
