import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-error';
import { renderWithProviders } from '@/test/render';
import { CommitteeForm } from './committee-form';

describe('CommitteeForm (HU-081, T-081-19)', () => {
  it('shows degree, single president and linked user errors next to the fields', async () => {
    const user = userEvent.setup();

    const { rerender } = renderWithProviders(
      <CommitteeForm
        mode="create"
        isSubmitting={false}
        serverError={null}
        serverErrorDetail={null}
        onCancel={vi.fn()}
        onSubmitCreate={vi.fn()}
        onSubmitEdit={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText('Fecha de inicio'), '2026-01-01');
    await user.type(screen.getByLabelText('Fecha de fin'), '2027-12-31');

    const member1 = screen.getByRole('group', { name: 'Miembro 1' });
    await user.type(within(member1).getByLabelText('Nombre completo'), 'Ana Torres Quispe');
    // Dejamos grado académico vacío a propósito y agregamos un segundo miembro también Presidente
    await user.click(screen.getByRole('button', { name: /Agregar miembro/i }));

    const member2 = screen.getByRole('group', { name: 'Miembro 2' });
    await user.type(within(member2).getByLabelText('Nombre completo'), 'Carlos Méndez');
    await user.type(within(member2).getByLabelText('Grado académico'), 'Mg.');
    await user.selectOptions(within(member2).getByLabelText('Cargo'), 'PRESIDENT');

    await user.click(screen.getByRole('button', { name: 'Guardar Comité' }));

    const degreeInput1 = within(member1).getByLabelText('Grado académico');
    expect(degreeInput1).toHaveAttribute('aria-invalid', 'true');
    expect(within(member1).getByRole('alert')).toHaveTextContent(/grado académico/i);

    const positionSelect1 = within(member1).getByLabelText('Cargo');
    const positionSelect2 = within(member2).getByLabelText('Cargo');
    expect(positionSelect1).toHaveAttribute('aria-invalid', 'true');
    expect(positionSelect2).toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.getByText('El Comité de Calidad debe tener exactamente un Presidente'),
    ).toBeInTheDocument();

    // Error del servidor con details para userEmail
    const serverErr = new ApiError({
      code: 'CONFLICT',
      status: 409,
      message: 'No se encontró ningún usuario con el correo miembro@ejemplo.com.',
      details: [
        {
          path: 'members.0.userEmail',
          message: 'No se encontró ningún usuario con el correo miembro@ejemplo.com.',
        },
      ],
    });

    await user.type(degreeInput1, 'Dr.');
    await user.selectOptions(positionSelect2, 'MEMBER');
    await user.click(screen.getByRole('button', { name: 'Guardar Comité' }));

    rerender(
      <CommitteeForm
        mode="create"
        isSubmitting={false}
        serverError={serverErr.message}
        serverErrorDetail={serverErr}
        onCancel={vi.fn()}
        onSubmitCreate={vi.fn()}
        onSubmitEdit={vi.fn()}
      />,
    );

    const emailInput1 = within(member1).getByLabelText('Correo institucional (opcional)');
    expect(emailInput1).toHaveAttribute('aria-invalid', 'true');
    expect(within(member1).getByRole('alert')).toHaveTextContent(
      'No se encontró ningún usuario con el correo miembro@ejemplo.com.',
    );
  });
});
