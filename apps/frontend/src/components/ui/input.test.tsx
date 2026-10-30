import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Input } from './input';

describe('Input component', () => {
  it('renders input with default type text and base styling', () => {
    render(<Input placeholder="Ingresa texto" />);

    const input = screen.getByPlaceholderText('Ingresa texto');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveClass('h-10', 'rounded-md', 'border-input');
  });

  it('renders with custom type email and handles aria-invalid', () => {
    render(<Input type="email" aria-invalid="true" aria-label="Correo" />);

    const input = screen.getByLabelText('Correo');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveClass('aria-invalid:border-destructive');
  });

  it('renders disabled state correctly', () => {
    render(<Input disabled aria-label="Deshabilitado" />);

    const input = screen.getByLabelText('Deshabilitado');
    expect(input).toBeDisabled();
    expect(input).toHaveClass('disabled:cursor-not-allowed', 'disabled:bg-muted');
  });
});
