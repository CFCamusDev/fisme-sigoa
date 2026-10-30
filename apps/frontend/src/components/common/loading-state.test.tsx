import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoadingState } from './loading-state';

describe('LoadingState component', () => {
  it('renders role="status" with polite aria-live and spinner', () => {
    const { container } = render(<LoadingState message="Cargando evidencias..." />);

    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('Cargando evidencias...');

    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
    expect(spinner?.className).toContain('border-brand-200');
    expect(spinner?.className).toContain('border-t-brand-700');
  });
});
