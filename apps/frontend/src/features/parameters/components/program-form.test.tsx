import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { ProgramDto } from '@sigoa/shared';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { ProgramForm } from './program-form';

const mockProgram: ProgramDto = {
  id: 'cm3programcuid1234567890',
  code: 'EPIS',
  name: 'Escuela Profesional de Ingeniería de Sistemas',
  faculty: 'Facultad de Ingeniería de Sistemas y Mecánica Eléctrica',
  updatedAt: '2026-11-09T12:00:00.000Z',
};

describe('ProgramForm component (HU-009, T-009-17, CA1, CA2)', () => {
  it('renders program data in form fields and enables editing with permission (CA1)', async () => {
    renderWithProviders(<ProgramForm program={mockProgram} />, { withRouter: false });

    const codeInput = screen.getByLabelText(/código del programa/i);
    const nameInput = screen.getByLabelText(/nombre del programa/i);
    const facultyInput = screen.getByLabelText(/facultad/i);
    const saveButton = screen.getByRole('button', { name: /guardar cambios/i });

    expect(codeInput).toHaveValue(mockProgram.code);
    expect(codeInput).not.toHaveAttribute('readonly');
    expect(nameInput).toHaveValue(mockProgram.name);
    expect(facultyInput).toHaveValue(mockProgram.faculty);
    expect(saveButton).toBeInTheDocument();
    expect(saveButton).toBeEnabled();
  });

  it('sends only modified fields when saving (D6, CA2)', async () => {
    const user = userEvent.setup();
    let sentBody: unknown;

    server.use(
      http.patch('http://localhost:3000/program', async ({ request }) => {
        sentBody = await request.json();
        return HttpResponse.json({
          ...mockProgram,
          name: 'Ingeniería de Sistemas',
          updatedAt: '2026-11-09T14:00:00.000Z',
        });
      }),
    );

    renderWithProviders(<ProgramForm program={mockProgram} />, { withRouter: false });

    const nameInput = screen.getByLabelText(/nombre del programa/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Ingeniería de Sistemas');

    const saveButton = screen.getByRole('button', { name: /guardar cambios/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(
        screen.getByText('Los datos del programa han sido actualizados exitosamente.'),
      ).toBeInTheDocument();
    });

    expect(sentBody).toEqual({ name: 'Ingeniería de Sistemas' });
  });

  it('does not send request and shows notice when there are no modified fields (D6)', async () => {
    const user = userEvent.setup();
    let patchCalled = false;

    server.use(
      http.patch('http://localhost:3000/program', () => {
        patchCalled = true;
        return HttpResponse.json(mockProgram);
      }),
    );

    renderWithProviders(<ProgramForm program={mockProgram} />, { withRouter: false });

    const saveButton = screen.getByRole('button', { name: /guardar cambios/i });
    await user.click(saveButton);

    expect(await screen.findByText('No hay cambios por guardar.')).toBeInTheDocument();
    expect(patchCalled).toBe(false);
  });

  it('renders form in read-only mode when user lacks parametro.editar permission (D4)', async () => {
    renderWithProviders(<ProgramForm program={mockProgram} />, {
      withRouter: false,
      permissions: [{ code: 'parametro.ver', scope: 'GLOBAL' }],
    });

    const codeInput = screen.getByLabelText(/código del programa/i);
    const nameInput = screen.getByLabelText(/nombre del programa/i);
    const facultyInput = screen.getByLabelText(/facultad/i);

    expect(codeInput).toHaveAttribute('readonly');
    expect(nameInput).toHaveAttribute('readonly');
    expect(facultyInput).toHaveAttribute('readonly');

    expect(screen.getByText(/solo lectura: no tienes permiso para editar/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /guardar cambios/i })).not.toBeInTheDocument();
  });

  it('shows client-side validation error when input does not satisfy schema', async () => {
    const user = userEvent.setup();
    let patchCalled = false;

    server.use(
      http.patch('http://localhost:3000/program', () => {
        patchCalled = true;
        return HttpResponse.json(mockProgram);
      }),
    );

    renderWithProviders(<ProgramForm program={mockProgram} />, { withRouter: false });

    const nameInput = screen.getByLabelText(/nombre del programa/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'ab'); // Menos de 3 caracteres

    const saveButton = screen.getByRole('button', { name: /guardar cambios/i });
    await user.click(saveButton);

    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert).toBeInTheDocument();
    expect(patchCalled).toBe(false);
  });

  it('handles 409 conflict and focuses code input field', async () => {
    const user = userEvent.setup();

    server.use(
      http.patch('http://localhost:3000/program', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'CONFLICT',
              message: 'Ya existe otro programa con el código especificado',
            },
          },
          { status: 409 },
        );
      }),
    );

    renderWithProviders(<ProgramForm program={mockProgram} />, { withRouter: false });

    const codeInput = screen.getByLabelText(/código del programa/i);
    await user.clear(codeInput);
    await user.type(codeInput, 'DUPLICADO');

    const saveButton = screen.getByRole('button', { name: /guardar cambios/i });
    await user.click(saveButton);

    const errorMessage = await screen.findByText(
      'Ya existe otro programa con el código especificado',
    );
    expect(errorMessage).toBeInTheDocument();
    expect(codeInput).toHaveFocus();
  });

  it('handles generic server error and displays danger alert', async () => {
    const user = userEvent.setup();

    server.use(
      http.patch('http://localhost:3000/program', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Error inesperado del servidor',
            },
          },
          { status: 500 },
        );
      }),
    );

    renderWithProviders(<ProgramForm program={mockProgram} />, { withRouter: false });

    const nameInput = screen.getByLabelText(/nombre del programa/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Nombre Modificado');

    const saveButton = screen.getByRole('button', { name: /guardar cambios/i });
    await user.click(saveButton);

    expect(await screen.findByText('Error inesperado del servidor')).toBeInTheDocument();
  });

  it('sends one request when the save button is clicked repeatedly while pending (Concurrency & AGENTS §5)', async () => {
    const user = userEvent.setup();
    let requestCount = 0;
    let resolvePatch!: () => void;
    const patchPending = new Promise<void>((resolve) => {
      resolvePatch = resolve;
    });

    server.use(
      http.patch('http://localhost:3000/program', async () => {
        requestCount += 1;
        await patchPending;
        return HttpResponse.json({
          ...mockProgram,
          name: 'Nombre Concurrente',
        });
      }),
    );

    renderWithProviders(<ProgramForm program={mockProgram} />, { withRouter: false });

    const nameInput = screen.getByLabelText(/nombre del programa/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Nombre Concurrente');

    const saveButton = screen.getByRole('button', { name: /guardar cambios/i });

    // Clic inicial
    await user.click(saveButton);

    // Mientras la mutación está en vuelo, el botón debe estar deshabilitado
    expect(saveButton).toBeDisabled();

    // Intentos de clic subsiguientes mientras está deshabilitado
    await user.click(saveButton);
    await user.click(saveButton);

    resolvePatch();

    await waitFor(() => {
      expect(
        screen.getByText('Los datos del programa han sido actualizados exitosamente.'),
      ).toBeInTheDocument();
    });

    expect(requestCount).toBe(1);
  });
});
