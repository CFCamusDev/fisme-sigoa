import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Textarea } from './textarea';

describe('Textarea component', () => {
  it('renders textarea with placeholder and base styling', () => {
    render(<Textarea placeholder="Ingresa descripción" />);

    const textarea = screen.getByPlaceholderText('Ingresa descripción');
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveClass('min-h-[80px]', 'rounded-md', 'border-input');
  });

  it('renders with custom aria-invalid', () => {
    render(<Textarea aria-invalid="true" aria-label="Descripción" />);

    const textarea = screen.getByLabelText('Descripción');
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
    expect(textarea).toHaveClass('aria-invalid:border-destructive');
  });

  it('renders disabled state correctly', () => {
    render(<Textarea disabled aria-label="Deshabilitado" />);

    const textarea = screen.getByLabelText('Deshabilitado');
    expect(textarea).toBeDisabled();
    expect(textarea).toHaveClass('disabled:cursor-not-allowed', 'disabled:bg-muted');
  });
});
