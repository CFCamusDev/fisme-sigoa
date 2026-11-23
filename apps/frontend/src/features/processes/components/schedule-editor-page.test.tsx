import { StrictMode } from 'react';
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, delay, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { ScheduleEditorPage } from './schedule-editor-page';

const SAMPLE_PENDING = {
  id: 'act-1',
  processExecutionId: 'exec-1',
  number: 1,
  activity: 'Elaborar cronograma',
  responsible: 'Presidente',
  goal: 'Anexo 1',
  indicator: '1 cronograma',
  startDate: '2027-03-01',
  endDate: '2027-03-15',
  status: 'PENDING' as const,
  actualEndDate: null,
  isOverdue: false,
  createdAt: '2027-03-01T10:00:00.000Z',
  updatedAt: '2027-03-01T10:00:00.000Z',
};

const SAMPLE_OVERDUE = {
  ...SAMPLE_PENDING,
  id: 'act-2',
  number: 2,
  activity: 'Convocar al Comité Consultivo',
  endDate: '2020-01-10',
  isOverdue: true,
};

const ALL_PERMS = [
  { code: 'cronograma.ver', scope: 'GLOBAL' as const },
  { code: 'cronograma.editar', scope: 'GLOBAL' as const },
];

describe('ScheduleEditorPage (HU-028, T-028-24)', () => {
  beforeEach(() => {
    server.use(
      http.get('*/me/permissions', () => HttpResponse.json({ permissions: ALL_PERMS })),
      http.get('*/process-executions/exec-1/next-transition', () =>
        HttpResponse.json({
          executionId: 'exec-1',
          status: 'PLANNED',
          nextStatus: 'IN_PROGRESS',
          preconditions: [],
          canAdvance: false,
        }),
      ),
    );
  });

  it('shows the loading, error and empty states', async () => {
    let shouldFail = false;
    server.use(
      http.get('*/process-executions/exec-1/schedule', async () => {
        await delay(40);
        if (shouldFail) {
          return HttpResponse.json(
            { error: { code: 'INTERNAL_ERROR', message: 'Error interno' } },
            { status: 500 },
          );
        }
        return HttpResponse.json({ items: [] });
      }),
    );

    renderWithProviders(<ScheduleEditorPage executionId="exec-1" />, { permissions: ALL_PERMS });

    expect(await screen.findByRole('status')).toHaveTextContent(/Cargando cronograma/i);
    expect(await screen.findByText(/Aún no hay actividades en el cronograma/i)).toBeInTheDocument();

    cleanup();
    shouldFail = true;
    renderWithProviders(<ScheduleEditorPage executionId="exec-1" />, { permissions: ALL_PERMS });

    expect(await screen.findByText(/No se pudo cargar el cronograma/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reintentar/i })).toBeInTheDocument();
  });

  it('loads the proposed activities', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('*/process-executions/exec-1/schedule', () => HttpResponse.json({ items: [] })),
      http.post('*/process-executions/exec-1/schedule/propose', () =>
        HttpResponse.json({ items: [SAMPLE_PENDING, SAMPLE_OVERDUE] }, { status: 201 }),
      ),
    );

    renderWithProviders(<ScheduleEditorPage executionId="exec-1" />, { permissions: ALL_PERMS });

    const proposeBtn = await screen.findByRole('button', { name: /Proponer actividades/i });
    await user.click(proposeBtn);

    expect(await screen.findByLabelText('Actividad 1')).toHaveValue('Elaborar cronograma');
    expect(screen.getByLabelText('Actividad 2')).toHaveValue('Convocar al Comité Consultivo');
  });

  it('shows the status badge with icon and text and the overdue badge', async () => {
    server.use(
      http.get('*/process-executions/exec-1/schedule', () =>
        HttpResponse.json({ items: [SAMPLE_PENDING, SAMPLE_OVERDUE] }),
      ),
    );

    renderWithProviders(<ScheduleEditorPage executionId="exec-1" />, { permissions: ALL_PERMS });

    expect(await screen.findAllByText('Pendiente')).toHaveLength(2);
    expect(screen.getByText('Vencida')).toBeInTheDocument();
  });

  it('marks an activity as in progress and then completed with the actual end date', async () => {
    const user = userEvent.setup();
    let current = { ...SAMPLE_PENDING };

    server.use(
      http.get('*/process-executions/exec-1/schedule', () =>
        HttpResponse.json({ items: [current] }),
      ),
      http.patch('*/schedule-activities/act-1/status', async ({ request }) => {
        const body = (await request.json()) as { status: string; actualEndDate?: string };
        if (body.status === 'IN_PROGRESS') {
          current = { ...current, status: 'IN_PROGRESS' as never };
        } else {
          current = {
            ...current,
            status: 'COMPLETED' as never,
            actualEndDate: (body.actualEndDate ?? '2027-03-10') as never,
          };
        }
        return HttpResponse.json(current);
      }),
    );

    renderWithProviders(<ScheduleEditorPage executionId="exec-1" />, { permissions: ALL_PERMS });

    const startBtn = await screen.findByRole('button', { name: /Iniciar/i });
    await user.click(startBtn);

    expect(await screen.findByText('En curso')).toBeInTheDocument();

    const completeBtn = screen.getByRole('button', { name: /Completar/i });
    await user.click(completeBtn);

    const dateInput = screen.getByLabelText(/Fecha real de término/i);
    await user.type(dateInput, '2027-03-12');
    await user.click(screen.getByRole('button', { name: /Confirmar/i }));

    expect(await screen.findByText('Completada')).toBeInTheDocument();
    expect(screen.getByText(/Real: 12\/03\/2027/)).toBeInTheDocument();
  });

  it('blocks the status buttons while there are unsaved changes', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('*/process-executions/exec-1/schedule', () =>
        HttpResponse.json({ items: [SAMPLE_PENDING] }),
      ),
    );

    renderWithProviders(<ScheduleEditorPage executionId="exec-1" />, { permissions: ALL_PERMS });

    const activityInput = await screen.findByLabelText('Actividad 1');
    await user.type(activityInput, ' modificada');

    expect(screen.getByText(/Guarda los cambios antes de cambiar el estado/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Iniciar/i })).toBeDisabled();
  });

  it('adds, removes and moves activities with the keyboard buttons', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('*/process-executions/exec-1/schedule', () =>
        HttpResponse.json({ items: [SAMPLE_PENDING, SAMPLE_OVERDUE] }),
      ),
    );

    renderWithProviders(<ScheduleEditorPage executionId="exec-1" />, { permissions: ALL_PERMS });

    await screen.findByLabelText('Actividad 1');

    await user.click(screen.getByRole('button', { name: 'Subir actividad 2' }));
    expect(screen.getByLabelText('Actividad 1')).toHaveValue('Convocar al Comité Consultivo');
    expect(screen.getByLabelText('Actividad 2')).toHaveValue('Elaborar cronograma');

    await user.click(screen.getByRole('button', { name: /Agregar actividad/i }));
    expect(screen.getByLabelText('Actividad 3')).toHaveValue('');

    await user.click(screen.getByRole('button', { name: 'Quitar actividad 3' }));
    expect(screen.queryByLabelText('Actividad 3')).not.toBeInTheDocument();
  });

  it('saves the whole schedule', async () => {
    const user = userEvent.setup();
    let savedBody: unknown = null;

    server.use(
      http.get('*/process-executions/exec-1/schedule', () =>
        HttpResponse.json({ items: [SAMPLE_PENDING] }),
      ),
      http.put('*/process-executions/exec-1/schedule', async ({ request }) => {
        savedBody = await request.json();
        return HttpResponse.json({
          items: [{ ...SAMPLE_PENDING, activity: 'Elaborar cronograma v2' }],
        });
      }),
    );

    renderWithProviders(<ScheduleEditorPage executionId="exec-1" />, { permissions: ALL_PERMS });

    const input = await screen.findByLabelText('Actividad 1');
    await user.clear(input);
    await user.type(input, 'Elaborar cronograma v2');

    await user.click(screen.getByRole('button', { name: /Guardar cronograma/i }));

    await waitFor(() => expect(savedBody).not.toBeNull());
    expect(savedBody).toEqual({
      activities: [
        {
          id: 'act-1',
          activity: 'Elaborar cronograma v2',
          responsible: 'Presidente',
          goal: 'Anexo 1',
          indicator: '1 cronograma',
          startDate: '2027-03-01',
          endDate: '2027-03-15',
        },
      ],
    });
  });

  it('shows the server message on a 409', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('*/process-executions/exec-1/schedule', () =>
        HttpResponse.json({ items: [SAMPLE_PENDING] }),
      ),
      http.put('*/process-executions/exec-1/schedule', () =>
        HttpResponse.json(
          { error: { code: 'CONFLICT', message: 'La ejecución está en estado Cerrada.' } },
          { status: 409 },
        ),
      ),
    );

    renderWithProviders(<ScheduleEditorPage executionId="exec-1" />, { permissions: ALL_PERMS });

    await screen.findByLabelText('Actividad 1');
    await user.click(screen.getByRole('button', { name: /Guardar cronograma/i }));

    expect(await screen.findByText('La ejecución está en estado Cerrada.')).toBeInTheDocument();
  });

  it('hides the editing actions without cronograma.editar', async () => {
    const viewOnlyPerms = [{ code: 'cronograma.ver', scope: 'GLOBAL' as const }];
    server.use(
      http.get('*/me/permissions', () => HttpResponse.json({ permissions: viewOnlyPerms })),
      http.get('*/process-executions/exec-1/schedule', () =>
        HttpResponse.json({ items: [SAMPLE_PENDING] }),
      ),
    );

    renderWithProviders(<ScheduleEditorPage executionId="exec-1" />, {
      permissions: viewOnlyPerms,
    });

    expect(await screen.findByText('Elaborar cronograma')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Guardar cronograma/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Agregar actividad/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Iniciar/i })).not.toBeInTheDocument();
  });

  it('disables the actions while a request is in flight', async () => {
    const user = userEvent.setup();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    server.use(
      http.get('*/process-executions/exec-1/schedule', () => HttpResponse.json({ items: [] })),
      http.post('*/process-executions/exec-1/schedule/propose', async () => {
        await gate;
        return HttpResponse.json({ items: [SAMPLE_PENDING] }, { status: 201 });
      }),
    );

    renderWithProviders(<ScheduleEditorPage executionId="exec-1" />, { permissions: ALL_PERMS });

    const proposeBtn = await screen.findByRole('button', { name: /Proponer actividades/i });
    await user.click(proposeBtn);

    expect(await screen.findByRole('button', { name: /Proponiendo/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Agregar actividad/i })).toBeDisabled();

    release();
    expect(await screen.findByLabelText('Actividad 1')).toBeInTheDocument();
  });

  it('requests the schedule once under StrictMode', async () => {
    let getCalls = 0;
    server.use(
      http.get('*/process-executions/exec-1/schedule', () => {
        getCalls += 1;
        return HttpResponse.json({ items: [SAMPLE_PENDING] });
      }),
    );

    renderWithProviders(
      <StrictMode>
        <ScheduleEditorPage executionId="exec-1" />
      </StrictMode>,
      { permissions: ALL_PERMS },
    );

    expect(await screen.findByLabelText('Actividad 1')).toBeInTheDocument();
    expect(getCalls).toBe(1);
  });

  it('shows saved confirmation and refreshes preconditions', async () => {
    const user = userEvent.setup();
    let nextTransitionCalls = 0;

    server.use(
      http.get('*/process-executions/exec-1/next-transition', () => {
        nextTransitionCalls += 1;
        return HttpResponse.json({
          executionId: 'exec-1',
          status: 'PLANNED',
          nextStatus: 'IN_PROGRESS',
          preconditions: [
            {
              code: 'SCHEDULE_DEFINED',
              label: 'Cronograma definido',
              met: nextTransitionCalls > 1,
            },
          ],
          canAdvance: nextTransitionCalls > 1,
        });
      }),
      http.get('*/process-executions/exec-1/schedule', () =>
        HttpResponse.json({ items: [SAMPLE_PENDING] }),
      ),
      http.put('*/process-executions/exec-1/schedule', () =>
        HttpResponse.json({ items: [SAMPLE_PENDING] }),
      ),
    );

    renderWithProviders(<ScheduleEditorPage executionId="exec-1" />, { permissions: ALL_PERMS });

    const input = await screen.findByLabelText('Actividad 1');
    const callsBeforeSave = nextTransitionCalls;
    await user.click(screen.getByRole('button', { name: /Guardar cronograma/i }));

    expect(await screen.findByText('Cronograma guardado')).toBeInTheDocument();
    await waitFor(() => expect(nextTransitionCalls).toBeGreaterThan(callsBeforeSave));

    await user.type(input, ' editada');
    expect(screen.queryByText('Cronograma guardado')).not.toBeInTheDocument();
  });

  it('marks missing start date and indicator with field errors and focuses alert summary', async () => {
    const user = userEvent.setup();
    let putCalls = 0;

    server.use(
      http.get('*/process-executions/exec-1/schedule', () =>
        HttpResponse.json({
          items: [
            {
              ...SAMPLE_PENDING,
              indicator: null,
              startDate: null,
              endDate: null,
            },
          ],
        }),
      ),
      http.put('*/process-executions/exec-1/schedule', () => {
        putCalls += 1;
        return HttpResponse.json({ items: [] });
      }),
    );

    renderWithProviders(<ScheduleEditorPage executionId="exec-1" />, { permissions: ALL_PERMS });

    await screen.findByLabelText('Actividad 1');
    await user.click(screen.getByRole('button', { name: /Guardar cronograma/i }));

    const alertSummary = await screen.findByRole('alert');
    expect(alertSummary).toHaveTextContent('Indica el indicador de la actividad 1');
    expect(alertSummary).toHaveTextContent('Indica la fecha de inicio de la actividad 1');
    expect(alertSummary).toHaveTextContent('Indica la fecha de fin de la actividad 1');
    expect(alertSummary).toHaveFocus();
    expect(screen.getByLabelText('Indicador 1')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Fecha de inicio 1')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Fecha de fin 1')).toHaveAttribute('aria-invalid', 'true');
    expect(putCalls).toBe(0);
  });

  it('sends a single save request on double submit', async () => {
    const user = userEvent.setup();
    let putCalls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    server.use(
      http.get('*/process-executions/exec-1/schedule', () =>
        HttpResponse.json({ items: [SAMPLE_PENDING] }),
      ),
      http.put('*/process-executions/exec-1/schedule', async () => {
        putCalls += 1;
        await gate;
        return HttpResponse.json({ items: [SAMPLE_PENDING] });
      }),
    );

    renderWithProviders(<ScheduleEditorPage executionId="exec-1" />, { permissions: ALL_PERMS });

    await screen.findByLabelText('Actividad 1');
    const saveButton = screen.getByRole('button', { name: /Guardar cronograma/i });
    await user.dblClick(saveButton);

    expect(await screen.findByRole('button', { name: /Guardando/i })).toBeDisabled();
    expect(putCalls).toBe(1);

    release();
    expect(await screen.findByText('Cronograma guardado')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Guardar cronograma/i })).toBeEnabled(),
    );
  });

  it('locks every control when the execution is voided', async () => {
    server.use(
      http.get('*/process-executions/exec-1/next-transition', () =>
        HttpResponse.json({
          executionId: 'exec-1',
          status: 'VOIDED',
          nextStatus: null,
          preconditions: [],
          canAdvance: false,
        }),
      ),
      http.get('*/process-executions/exec-1/schedule', () =>
        HttpResponse.json({ items: [SAMPLE_PENDING, SAMPLE_OVERDUE] }),
      ),
    );

    renderWithProviders(<ScheduleEditorPage executionId="exec-1" />, { permissions: ALL_PERMS });

    expect(
      await screen.findByText(/La ejecución está Anulada; el cronograma es de solo lectura/i),
    ).toBeInTheDocument();

    expect(screen.getByLabelText('Actividad 1')).toBeDisabled();
    expect(screen.getByLabelText('Responsable 1')).toBeDisabled();
    expect(screen.getByLabelText('Meta 1')).toBeDisabled();
    expect(screen.getByLabelText('Indicador 1')).toBeDisabled();
    expect(screen.getByLabelText('Fecha de inicio 1')).toBeDisabled();
    expect(screen.getByLabelText('Fecha de fin 1')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Subir actividad 2' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Bajar actividad 1' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Quitar actividad 1' })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: /Iniciar/i })[0]).toBeDisabled();
    expect(screen.getByRole('button', { name: /Agregar actividad/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Guardar cronograma/i })).toBeDisabled();
  });

  it('locks every control when the execution is closed', async () => {
    server.use(
      http.get('*/process-executions/exec-1/next-transition', () =>
        HttpResponse.json({
          executionId: 'exec-1',
          status: 'CLOSED',
          nextStatus: null,
          preconditions: [],
          canAdvance: false,
        }),
      ),
      http.get('*/process-executions/exec-1/schedule', () => HttpResponse.json({ items: [] })),
    );

    renderWithProviders(<ScheduleEditorPage executionId="exec-1" />, { permissions: ALL_PERMS });

    expect(
      await screen.findByText(/La ejecución está Cerrada; el cronograma es de solo lectura/i),
    ).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Proponer actividades/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Agregar actividad/i })).toBeDisabled();
  });
});
