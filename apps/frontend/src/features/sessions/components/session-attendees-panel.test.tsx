import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, delay, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { SAMPLE_SESSION_DTO, makeSessionAttendeesResponse } from '../test/sessions-fixtures';
import { SessionAttendeesPanel } from './session-attendees-panel';

describe('SessionAttendeesPanel (HU-033, T-033-14)', () => {
  it('marks attendees and saves their position', async () => {
    const user = userEvent.setup();
    let capturedBody: unknown = null;

    server.use(
      http.get('*/sessions/sess-1/attendees', () =>
        HttpResponse.json(makeSessionAttendeesResponse(), { status: 200 }),
      ),
      http.put('*/sessions/sess-1/attendees', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(
          makeSessionAttendeesResponse({
            attendeeCount: 2,
            items: [
              {
                listMemberId: 'mem-1',
                fullName: 'Ana Pérez',
                institution: 'Empresa A',
                memberPosition: 'Analista',
                attended: true,
                position: 'Gerente de TI',
              },
              {
                listMemberId: 'mem-2',
                fullName: 'Luis Torres',
                institution: 'Empresa B',
                memberPosition: 'Jefe de Área',
                attended: true,
                position: 'Director Ejecutivo',
              },
            ],
          }),
          { status: 200 },
        );
      }),
    );

    const onSaved = vi.fn();
    renderWithProviders(
      <SessionAttendeesPanel session={SAMPLE_SESSION_DTO} onSaved={onSaved} onCancel={vi.fn()} />,
    );

    const luisCheckbox = await screen.findByRole('checkbox', { name: /Luis Torres/i });
    expect(luisCheckbox).not.toBeChecked();

    await user.click(luisCheckbox);
    expect(luisCheckbox).toBeChecked();

    const luisPositionInput = screen.getByLabelText(/Cargo de Luis Torres/i);
    expect(luisPositionInput).toHaveValue('Jefe de Área');
    await user.clear(luisPositionInput);
    await user.type(luisPositionInput, 'Director Ejecutivo');

    await user.click(screen.getByRole('button', { name: 'Guardar asistentes' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(capturedBody).toEqual({
      attendees: [
        { listMemberId: 'mem-1', position: 'Gerente de TI' },
        { listMemberId: 'mem-2', position: 'Director Ejecutivo' },
      ],
    });
  });

  it('points to the list when the person is not in it', async () => {
    server.use(
      http.get('*/sessions/sess-1/attendees', () =>
        HttpResponse.json(makeSessionAttendeesResponse(), { status: 200 }),
      ),
    );

    renderWithProviders(
      <SessionAttendeesPanel session={SAMPLE_SESSION_DTO} onSaved={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(await screen.findByText(/Agrégala primero a la lista del Anexo 3/i)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Listas de constituyentes' });
    expect(link).toHaveAttribute('href', '/listas-constituyentes');
  });

  it('explains that the session has no list', async () => {
    const sessionWithoutList = { ...SAMPLE_SESSION_DTO, stakeholderListId: null };
    server.use(
      http.get('*/sessions/sess-1/attendees', () =>
        HttpResponse.json(
          makeSessionAttendeesResponse({ stakeholderListId: null, attendeeCount: 0, items: [] }),
          { status: 200 },
        ),
      ),
    );

    renderWithProviders(
      <SessionAttendeesPanel session={sessionWithoutList} onSaved={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(await screen.findByText(/Esta sesión no tiene lista del Anexo 3/i)).toBeInTheDocument();
  });

  it('shows loading, empty and error states', async () => {
    server.use(
      http.get('*/sessions/sess-1/attendees', async () => {
        await delay(40);
        return HttpResponse.json({ message: 'Error temporal' }, { status: 500 });
      }),
    );

    renderWithProviders(
      <SessionAttendeesPanel session={SAMPLE_SESSION_DTO} onSaved={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(await screen.findByText('Cargando asistentes…')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    server.use(
      http.get('*/sessions/sess-1/attendees', () =>
        HttpResponse.json(makeSessionAttendeesResponse({ attendeeCount: 0, items: [] }), {
          status: 200,
        }),
      ),
    );

    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('La lista no tiene miembros.')).toBeInTheDocument();
  });

  it('shows the server error', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('*/sessions/sess-1/attendees', () =>
        HttpResponse.json(makeSessionAttendeesResponse(), { status: 200 }),
      ),
      http.put('*/sessions/sess-1/attendees', () =>
        HttpResponse.json(
          {
            error: {
              code: 'CONFLICT',
              message: 'La ejecución está cerrada y no admite cambios.',
            },
          },
          { status: 409 },
        ),
      ),
    );

    renderWithProviders(
      <SessionAttendeesPanel session={SAMPLE_SESSION_DTO} onSaved={vi.fn()} onCancel={vi.fn()} />,
    );

    const saveButton = await screen.findByRole('button', { name: 'Guardar asistentes' });
    await user.click(saveButton);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La ejecución está cerrada y no admite cambios.',
    );
  });

  it('sends one request on double click', async () => {
    const user = userEvent.setup();
    let putCalls = 0;

    server.use(
      http.get('*/sessions/sess-1/attendees', () =>
        HttpResponse.json(makeSessionAttendeesResponse(), { status: 200 }),
      ),
      http.put('*/sessions/sess-1/attendees', async () => {
        putCalls += 1;
        await delay(40);
        return HttpResponse.json(makeSessionAttendeesResponse(), { status: 200 });
      }),
    );

    const onSaved = vi.fn();
    renderWithProviders(
      <SessionAttendeesPanel session={SAMPLE_SESSION_DTO} onSaved={onSaved} onCancel={vi.fn()} />,
    );

    const saveButton = await screen.findByRole('button', { name: 'Guardar asistentes' });
    await user.dblClick(saveButton);

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(putCalls).toBe(1);
  });
});
