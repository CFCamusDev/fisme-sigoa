import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select } from './select';

describe('Select component (T-003-16, D1)', () => {
  it('renders select element with options and is keyboard operable', async () => {
    const user = userEvent.setup();
    render(
      <label htmlFor="test-select">
        Rol
        <Select id="test-select" defaultValue="ADMIN">
          <option value="ADMIN">Administrador</option>
          <option value="TEACHER">Docente</option>
        </Select>
      </label>,
    );

    const select = screen.getByLabelText('Rol') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.value).toBe('ADMIN');

    await user.selectOptions(select, 'TEACHER');
    expect(select.value).toBe('TEACHER');
  });

  it('exposes aria-invalid state with destructive token styling', () => {
    render(
      <Select aria-label="Estado inválido" aria-invalid="true">
        <option value="1">Opción</option>
      </Select>,
    );

    const select = screen.getByLabelText('Estado inválido');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select.className).toContain('aria-invalid:border-destructive');
  });

  it('handles disabled state properly', () => {
    render(
      <Select aria-label="Deshabilitado" disabled>
        <option value="1">Opción</option>
      </Select>,
    );

    const select = screen.getByLabelText('Deshabilitado');
    expect(select).toBeDisabled();
  });
});
