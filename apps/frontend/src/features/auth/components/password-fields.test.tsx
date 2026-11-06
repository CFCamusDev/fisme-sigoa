import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { PasswordFields } from './password-fields';
import type { PasswordConfirmationFormData } from '../schemas/password-confirmation-schema';

function TestWrapper({ idPrefix }: { idPrefix: string }) {
  const {
    register,
    formState: { errors },
  } = useForm<PasswordConfirmationFormData>({
    defaultValues: { password: '', confirmPassword: '' },
  });

  return <PasswordFields idPrefix={idPrefix} register={register} errors={errors} />;
}

describe('PasswordFields component (HU-005, T-005-11, D3)', () => {
  it('renders password and confirm password inputs with given idPrefix', () => {
    render(<TestWrapper idPrefix="reset" />);

    const passwordInput = screen.getByLabelText(/nueva contraseña/i);
    const confirmInput = screen.getByLabelText(/confirmar contraseña/i);

    expect(passwordInput).toHaveAttribute('id', 'reset-password');
    expect(confirmInput).toHaveAttribute('id', 'reset-confirm-password');
    expect(screen.getByText(/mínimo 10 caracteres, con letras y números\./i)).toBeInTheDocument();
  });
});
