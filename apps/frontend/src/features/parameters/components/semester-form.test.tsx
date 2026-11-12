import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { SemesterForm } from './semester-form';

const editPermissions = [{ code: 'parametro.editar', scope: 'GLOBAL' as const }];

describe('SemesterForm Component (HU-010, T-010-18)', () => {
  it('submits valid data, clears fields, and calls onSuccess callback (CA1)', async () => {
    const onSuccessMock = vi.fn();

    server.use(
      http.post('http://localhost:3000/semesters', async ({ request }) => {
        const body = (await request.json()) as { code: string; startDate: string; endDate: string };
        return HttpResponse.json(
          {
            id: 'sem-created-01',
            code: body.code,
            startDate: body.startDate,
            endDate: body.endDate,
            createdAt: '2026-03-01T00:00:00.000Z',
            updatedAt: '2026-03-01T00:00:00.000Z',
          },
          { status: 201 },
        );
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<SemesterForm onSuccess={onSuccessMock} />, {
      withRouter: false,
      permissions: editPermissions,
    });

    const codeInput = screen.getByLabelText(/código/i);
    const startInput = screen.getByLabelText(/fecha de inicio/i);
    const endInput = screen.getByLabelText(/fecha de fin/i);
    const submitBtn = screen.getByRole('button', { name: /registrar semestre/i });

    await user.type(codeInput, '2027-I');
    await user.type(startInput, '2027-03-15');
    await user.type(endInput, '2027-07-15');

    await user.click(submitBtn);

    expect(await screen.findByText('Semestre registrado exitosamente.')).toBeInTheDocument();
    expect(screen.getByText('Registro exitoso')).toBeInTheDocument();

    await waitFor(() => {
      expect(codeInput).toHaveValue('');
      expect(startInput).toHaveValue('');
      expect(endInput).toHaveValue('');
    });

    expect(onSuccessMock).toHaveBeenCalledTimes(1);
    expect(onSuccessMock).toHaveBeenCalledWith(
      expect.objectContaining({
        code: '2027-I',
      }),
    );
  });

  it('displays danger alert with server message on 409 overlapping date error (CA2)', async () => {
    const conflictMessage =
      'Las fechas del semestre se superponen con un semestre académico existente (2027-I).';

    server.use(
      http.post('http://localhost:3000/semesters', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'CONFLICT',
              message: conflictMessage,
            },
          },
          { status: 409 },
        );
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<SemesterForm />, {
      withRouter: false,
      permissions: editPermissions,
    });

    await user.type(screen.getByLabelText(/código/i), '2027-II');
    await user.type(screen.getByLabelText(/fecha de inicio/i), '2027-06-01');
    await user.type(screen.getByLabelText(/fecha de fin/i), '2027-10-01');

    await user.click(screen.getByRole('button', { name: /registrar semestre/i }));

    expect(await screen.findByText('Conflicto de superposición')).toBeInTheDocument();
    expect(screen.getByText(conflictMessage)).toBeInTheDocument();
  });

  it('sets form error on duplicate semester code conflict (409 CONFLICT)', async () => {
    server.use(
      http.post('http://localhost:3000/semesters', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'CONFLICT',
              message: 'Ya existe un semestre académico con el código 2027-I.',
            },
          },
          { status: 409 },
        );
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<SemesterForm />, {
      withRouter: false,
      permissions: editPermissions,
    });

    await user.type(screen.getByLabelText(/código/i), '2027-I');
    await user.type(screen.getByLabelText(/fecha de inicio/i), '2027-03-15');
    await user.type(screen.getByLabelText(/fecha de fin/i), '2027-07-15');

    await user.click(screen.getByRole('button', { name: /registrar semestre/i }));

    const errorMsg = await screen.findByText(
      'Ya existe un semestre académico con el código 2027-I.',
    );
    expect(errorMsg).toBeInTheDocument();
    expect(screen.getByLabelText(/código/i)).toHaveFocus();
  });

  it('keeps permanent format help visible and displays client validation error for invalid code format (CA3)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SemesterForm />, {
      withRouter: false,
      permissions: editPermissions,
    });

    const helpText = screen.getByText('Formato AAAA-I o AAAA-II, por ejemplo 2027-I');
    expect(helpText).toBeInTheDocument();

    const codeInput = screen.getByLabelText(/código/i);
    await user.type(codeInput, '2027-3');
    await user.type(screen.getByLabelText(/fecha de inicio/i), '2027-03-15');
    await user.type(screen.getByLabelText(/fecha de fin/i), '2027-07-15');

    await user.click(screen.getByRole('button', { name: /registrar semestre/i }));

    expect(
      await screen.findByText(/código del semestre debe tener el formato aaaa-i o aaaa-ii/i),
    ).toBeInTheDocument();
    // La ayuda sigue permanentemente visible
    expect(helpText).toBeInTheDocument();
  });

  it('validates start and end dates order on the client', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SemesterForm />, {
      withRouter: false,
      permissions: editPermissions,
    });

    await user.type(screen.getByLabelText(/código/i), '2027-I');
    await user.type(screen.getByLabelText(/fecha de inicio/i), '2027-07-15');
    await user.type(screen.getByLabelText(/fecha de fin/i), '2027-03-15');

    await user.click(screen.getByRole('button', { name: /registrar semestre/i }));

    expect(
      await screen.findByText(/la fecha de inicio debe ser anterior a la fecha de fin/i),
    ).toBeInTheDocument();
  });

  it('sends one request when the submit button is clicked repeatedly while pending (Concurrency & Idempotency)', async () => {
    let callCount = 0;
    let resolveServerResponse!: () => void;
    const pendingPromise = new Promise<void>((resolve) => {
      resolveServerResponse = resolve;
    });

    server.use(
      http.post('http://localhost:3000/semesters', async () => {
        callCount += 1;
        await pendingPromise;
        return HttpResponse.json(
          {
            id: 'sem-concurr-01',
            code: '2028-I',
            startDate: '2028-03-15',
            endDate: '2028-07-15',
            createdAt: '2026-03-01T00:00:00.000Z',
            updatedAt: '2026-03-01T00:00:00.000Z',
          },
          { status: 201 },
        );
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<SemesterForm />, {
      withRouter: false,
      permissions: editPermissions,
    });

    await user.type(screen.getByLabelText(/código/i), '2028-I');
    await user.type(screen.getByLabelText(/fecha de inicio/i), '2028-03-15');
    await user.type(screen.getByLabelText(/fecha de fin/i), '2028-07-15');

    const submitBtn = screen.getByRole('button', { name: /registrar semestre/i });

    // Clic inicial
    await user.click(submitBtn);

    // El botón cambia de texto y queda deshabilitado
    expect(screen.getByRole('button', { name: /registrando\.\.\./i })).toBeDisabled();

    // Intentos de clic subsiguientes mientras está pendiente
    await user.click(submitBtn);
    await user.click(submitBtn);

    resolveServerResponse();

    expect(await screen.findByText('Semestre registrado exitosamente.')).toBeInTheDocument();
    expect(callCount).toBe(1);
  });
});
