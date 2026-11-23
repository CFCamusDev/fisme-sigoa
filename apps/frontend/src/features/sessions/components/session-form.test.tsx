import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { SAMPLE_OPEN_EXECUTIONS, SAMPLE_SESSION_DTO } from '../test/sessions-fixtures';
import { SessionForm } from './session-form';

function setupBaseHandlers(options?: { includeClosedExecution?: boolean; listsStatus?: number }) {
  const closedExec = {
    ...SAMPLE_OPEN_EXECUTIONS[0]!,
    id: 'exec-closed',
    name: 'Ejecución Cerrada 2025',
    status: 'CLOSED' as const,
  };

  server.use(
    http.get('*/process-executions', ({ request }) => {
      const url = new URL(request.url);
      const status = url.searchParams.get('status');
      const items =
        status === 'PLANNED'
          ? SAMPLE_OPEN_EXECUTIONS.filter((item) => item.status === 'PLANNED')
          : status === 'IN_PROGRESS'
            ? SAMPLE_OPEN_EXECUTIONS.filter((item) => item.status === 'IN_PROGRESS')
            : options?.includeClosedExecution
              ? [...SAMPLE_OPEN_EXECUTIONS, closedExec]
              : [...SAMPLE_OPEN_EXECUTIONS];
      return HttpResponse.json({
        items,
        page: 1,
        pageSize: 100,
        total: items.length,
        totalPages: 1,
      });
    }),
    http.get('*/stakeholder-lists', () => {
      if (options?.listsStatus === 403) {
        return HttpResponse.json({ message: 'Sin permiso' }, { status: 403 });
      }
      return HttpResponse.json({
        items: [
          {
            id: 'list-emp-2026',
            programId: 'prog-1',
            type: 'EMPLOYER',
            year: 2026,
            studyPlanNumber: null,
            version: '1',
            memberCount: 5,
            members: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });
    }),
  );
}

const FULL_PERMISSIONS = [
  { code: 'sesion.editar', scope: 'GLOBAL' as const },
  { code: 'constituyente.ver', scope: 'GLOBAL' as const },
];

describe('SessionForm (HU-032, T-032-25)', () => {
  it('registers one session for three executions', async () => {
    const user = userEvent.setup();
    setupBaseHandlers();
    let capturedBody: Record<string, unknown> | null = null;

    server.use(
      http.post('*/sessions', async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(SAMPLE_SESSION_DTO, { status: 201 });
      }),
    );

    const onSaved = vi.fn();
    renderWithProviders(
      <SessionForm defaultExecutionId="exec-1" onSaved={onSaved} onCancel={vi.fn()} />,
      { withRouter: false, permissions: FULL_PERMISSIONS },
    );

    const exec2 = await screen.findByLabelText('Medición OE 2026');
    const exec3 = await screen.findByLabelText('Medición indirecta AG 2026');
    await user.click(exec2);
    await user.click(exec3);

    await user.click(screen.getByRole('button', { name: 'Registrar sesión' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(capturedBody?.['executionIds']).toEqual(['exec-1', 'exec-2', 'exec-3']);
  });

  it('requires at least one execution', async () => {
    const user = userEvent.setup();
    setupBaseHandlers();
    let postCalls = 0;
    server.use(
      http.post('*/sessions', () => {
        postCalls += 1;
        return HttpResponse.json(SAMPLE_SESSION_DTO, { status: 201 });
      }),
    );

    renderWithProviders(<SessionForm onSaved={vi.fn()} onCancel={vi.fn()} />, {
      withRouter: false,
      permissions: FULL_PERMISSIONS,
    });

    await screen.findByLabelText('Revisión OE 2026');
    await user.click(screen.getByRole('button', { name: 'Registrar sesión' }));

    expect(await screen.findByText('Selecciona al menos una ejecución')).toBeInTheDocument();
    expect(postCalls).toBe(0);
  });

  it('asks for both links when the modality is virtual', async () => {
    const user = userEvent.setup();
    setupBaseHandlers();

    renderWithProviders(
      <SessionForm defaultExecutionId="exec-1" onSaved={vi.fn()} onCancel={vi.fn()} />,
      { withRouter: false, permissions: FULL_PERMISSIONS },
    );

    await screen.findByLabelText('Revisión OE 2026');
    await user.selectOptions(screen.getByLabelText('Modalidad'), 'VIRTUAL');

    const meetingInput = screen.getByLabelText('Enlace de la reunión (obligatorio)');
    const recordingInput = screen.getByLabelText('Enlace de la grabación (obligatorio)');
    expect(meetingInput).toHaveAttribute('aria-required', 'true');
    expect(recordingInput).toHaveAttribute('aria-required', 'true');

    await user.click(screen.getByRole('button', { name: 'Registrar sesión' }));
    expect(
      await screen.findByText('El enlace de la reunión es obligatorio para sesiones virtuales'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('El enlace de la grabación es obligatorio para sesiones virtuales'),
    ).toBeInTheDocument();
  });

  it('does not require links for an in-person session', async () => {
    const user = userEvent.setup();
    setupBaseHandlers();
    let postCalls = 0;
    server.use(
      http.post('*/sessions', () => {
        postCalls += 1;
        return HttpResponse.json(
          { ...SAMPLE_SESSION_DTO, modality: 'IN_PERSON', meetingUrl: null, recordingUrl: null },
          { status: 201 },
        );
      }),
    );

    const onSaved = vi.fn();
    renderWithProviders(
      <SessionForm defaultExecutionId="exec-1" onSaved={onSaved} onCancel={vi.fn()} />,
      { withRouter: false, permissions: FULL_PERMISSIONS },
    );

    await screen.findByLabelText('Revisión OE 2026');
    await user.click(screen.getByRole('button', { name: 'Registrar sesión' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(postCalls).toBe(1);
  });

  it('offers only PLANNED and IN_PROGRESS executions', async () => {
    setupBaseHandlers({ includeClosedExecution: true });

    renderWithProviders(<SessionForm onSaved={vi.fn()} onCancel={vi.fn()} />, {
      withRouter: false,
      permissions: FULL_PERMISSIONS,
    });

    expect(await screen.findByLabelText('Revisión OE 2026')).toBeInTheDocument();
    expect(screen.getByLabelText('Medición OE 2026')).toBeInTheDocument();
    expect(screen.queryByLabelText('Ejecución Cerrada 2025')).not.toBeInTheDocument();
  });

  it('offers the stakeholder list of the chosen type and year', async () => {
    setupBaseHandlers();

    renderWithProviders(<SessionForm onSaved={vi.fn()} onCancel={vi.fn()} />, {
      withRouter: false,
      permissions: FULL_PERMISSIONS,
    });

    const listSelect = await screen.findByLabelText('Lista del Anexo 3 (opcional)');
    expect(listSelect).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: /Empleadores — 2026/i })).toBeInTheDocument();
  });

  it('hides the stakeholder list when the user lacks constituyente.ver', async () => {
    setupBaseHandlers({ listsStatus: 403 });

    renderWithProviders(<SessionForm onSaved={vi.fn()} onCancel={vi.fn()} />, {
      withRouter: false,
      permissions: [{ code: 'sesion.editar', scope: 'GLOBAL' }],
    });

    await screen.findByLabelText('Revisión OE 2026');
    expect(screen.queryByLabelText('Lista del Anexo 3 (opcional)')).not.toBeInTheDocument();
    expect(screen.getByText(/puedes registrar la sesión sin lista/i)).toBeInTheDocument();
  });

  it('loads the session when editing and sends the full body', async () => {
    const user = userEvent.setup();
    setupBaseHandlers();
    let patchBody: Record<string, unknown> | null = null;

    server.use(
      http.patch('*/sessions/sess-1', async ({ request }) => {
        patchBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...SAMPLE_SESSION_DTO, startTime: '11:45' }, { status: 200 });
      }),
    );

    const onSaved = vi.fn();
    renderWithProviders(
      <SessionForm session={SAMPLE_SESSION_DTO} onSaved={onSaved} onCancel={vi.fn()} />,
      { withRouter: false, permissions: FULL_PERMISSIONS },
    );

    const timeInput = screen.getByLabelText('Hora de inicio');
    await user.clear(timeInput);
    await user.type(timeInput, '11:45');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(patchBody).toMatchObject({
      stakeholderType: 'EMPLOYER',
      sessionDate: '2026-11-20',
      startTime: '11:45',
      modality: 'VIRTUAL',
      executionIds: ['exec-1', 'exec-2', 'exec-3'],
    });
  });

  it('shows the server message when the session already exists', async () => {
    const user = userEvent.setup();
    setupBaseHandlers();
    server.use(
      http.post('*/sessions', () =>
        HttpResponse.json(
          {
            error: {
              code: 'CONFLICT',
              message: 'Ya existe una sesión de ese tipo a esa fecha y hora.',
            },
          },
          { status: 409 },
        ),
      ),
    );

    renderWithProviders(
      <SessionForm defaultExecutionId="exec-1" onSaved={vi.fn()} onCancel={vi.fn()} />,
      { withRouter: false, permissions: FULL_PERMISSIONS },
    );

    await screen.findByLabelText('Revisión OE 2026');
    await user.click(screen.getByRole('button', { name: 'Registrar sesión' }));

    expect(
      await screen.findByText('Ya existe una sesión de ese tipo a esa fecha y hora.'),
    ).toBeInTheDocument();
  });

  it('sends a single request on double submit', async () => {
    const user = userEvent.setup();
    setupBaseHandlers();
    let postCalls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post('*/sessions', async () => {
        postCalls += 1;
        await gate;
        return HttpResponse.json(SAMPLE_SESSION_DTO, { status: 201 });
      }),
    );

    const onSaved = vi.fn();
    renderWithProviders(
      <SessionForm defaultExecutionId="exec-1" onSaved={onSaved} onCancel={vi.fn()} />,
      { withRouter: false, permissions: FULL_PERMISSIONS },
    );

    await screen.findByLabelText('Revisión OE 2026');
    const submitButton = screen.getByRole('button', { name: 'Registrar sesión' });
    await user.dblClick(submitButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
    });
    expect(postCalls).toBe(1);

    release();

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Registrar sesión' })).toBeEnabled();
    });
  });

  it('shows only the links that apply for each modality and marks required fields', async () => {
    const user = userEvent.setup();
    setupBaseHandlers();

    renderWithProviders(
      <SessionForm defaultExecutionId="exec-1" onSaved={vi.fn()} onCancel={vi.fn()} />,
      { withRouter: false, permissions: FULL_PERMISSIONS },
    );

    await screen.findByLabelText('Revisión OE 2026');

    expect(screen.queryByLabelText(/Enlace de la reunión/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Enlace de la grabación/i)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Modalidad'), 'HYBRID');
    const hybridMeeting = screen.getByLabelText('Enlace de la reunión (obligatorio)');
    const hybridRecording = screen.getByLabelText('Enlace de la grabación (opcional)');
    expect(hybridMeeting).toHaveAttribute('aria-required', 'true');
    expect(hybridRecording).toHaveAttribute('aria-required', 'false');

    await user.selectOptions(screen.getByLabelText('Modalidad'), 'VIRTUAL');
    expect(screen.getByLabelText('Enlace de la reunión (obligatorio)')).toHaveAttribute(
      'aria-required',
      'true',
    );
    expect(screen.getByLabelText('Enlace de la grabación (obligatorio)')).toHaveAttribute(
      'aria-required',
      'true',
    );
  });

  it('sends nulls for in person when switching from virtual', async () => {
    const user = userEvent.setup();
    setupBaseHandlers();
    let patchBody: Record<string, unknown> | null = null;

    server.use(
      http.patch('*/sessions/sess-1', async ({ request }) => {
        patchBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { ...SAMPLE_SESSION_DTO, modality: 'IN_PERSON', meetingUrl: null, recordingUrl: null },
          { status: 200 },
        );
      }),
    );

    const onSaved = vi.fn();
    renderWithProviders(
      <SessionForm session={SAMPLE_SESSION_DTO} onSaved={onSaved} onCancel={vi.fn()} />,
      { withRouter: false, permissions: FULL_PERMISSIONS },
    );

    await user.selectOptions(screen.getByLabelText('Modalidad'), 'IN_PERSON');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(patchBody).toMatchObject({
      modality: 'IN_PERSON',
      meetingUrl: null,
      recordingUrl: null,
    });
  });

  it('labels every field, groups the executions in a fieldset and is operable by keyboard', async () => {
    const user = userEvent.setup();
    setupBaseHandlers();

    renderWithProviders(<SessionForm onSaved={vi.fn()} onCancel={vi.fn()} />, {
      withRouter: false,
      permissions: FULL_PERMISSIONS,
    });

    expect(screen.getByLabelText('Tipo de constituyente')).toBeInTheDocument();
    expect(screen.getByLabelText('Modalidad')).toBeInTheDocument();
    expect(screen.getByLabelText('Fecha')).toBeInTheDocument();
    expect(screen.getByLabelText('Hora de inicio')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Ejecuciones vinculadas' })).toBeInTheDocument();

    await user.tab();
    expect(screen.getByLabelText('Tipo de constituyente')).toHaveFocus();
  });
});
