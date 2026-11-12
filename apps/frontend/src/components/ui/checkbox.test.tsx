import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox } from './checkbox';

describe('Checkbox component (T-003-17, D1)', () => {
  it('toggles checked state with keyboard (Space key) and click', async () => {
    const user = userEvent.setup();
    render(
      <label htmlFor="test-checkbox">
        Docente
        <Checkbox id="test-checkbox" />
      </label>,
    );

    const checkbox = screen.getByLabelText('Docente') as HTMLInputElement;
    expect(checkbox).toBeInTheDocument();
    expect(checkbox.checked).toBe(false);

    await user.click(checkbox);
    expect(checkbox.checked).toBe(true);

    checkbox.focus();
    await user.keyboard(' ');
    expect(checkbox.checked).toBe(false);
  });

  it('exposes aria-invalid state with destructive token styling', () => {
    render(<Checkbox aria-label="Casilla inválida" aria-invalid="true" />);

    const checkbox = screen.getByLabelText('Casilla inválida');
    expect(checkbox).toHaveAttribute('aria-invalid', 'true');
    expect(checkbox.className).toContain('aria-invalid:border-destructive');
  });

  it('handles disabled state properly', () => {
    render(<Checkbox aria-label="Casilla deshabilitada" disabled />);

    const checkbox = screen.getByLabelText('Casilla deshabilitada');
    expect(checkbox).toBeDisabled();
  });
});
