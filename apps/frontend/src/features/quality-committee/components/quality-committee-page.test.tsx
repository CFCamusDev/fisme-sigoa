import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, delay, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import {
  SAMPLE_CURRENT_COMMITTEE,
  SAMPLE_FINISHED_COMMITTEE,
  makeCommitteeListResponse,
  makeCurrentCommitteeResponse,
} from '../test/quality-committee-fixtures';
import { QualityCommitteePage } from './quality-committee-page';

describe('QualityCommitteePage (HU-025, T-025-28)', () => {
  it('shows loading, empty and error states', async () => {
    let shouldFail = false;

    server.use(
      http.get('*/quality-committees/current', async () => {
        await delay(25);
        if (shouldFail) {
          return HttpResponse.json({ message: 'Error de servidor' }, { status: 500 });
        }
        return HttpResponse.json(makeCurrentCommitteeResponse({ committee: null }));
      }),
      http.get('*/quality-committees', () =>
        HttpResponse.json(makeCommitteeListResponse({ items: [], total: 0 })),
      ),
    );

    renderWithProviders(<QualityCommitteePage />, {
      withRouter: true,
      permissions: [
        { code: 'comite.ver', scope: 'GLOBAL' },
        { code: 'comite.editar', scope: 'GLOBAL' },
      ],
    });

    expect(await screen.findByText('Cargando el Comité de Calidad…')).toBeInTheDocument();
    expect(
      await screen.findByText('No hay un Comité vigente. Registra el Comité del periodo actual.'),
    ).toBeInTheDocument();

    shouldFail = true;
    const { unmount } = renderWithProviders(<QualityCommitteePage />, {
      withRouter: true,
      permissions: [{ code: 'comite.ver', scope: 'GLOBAL' }],
    });
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    unmount();
  });

  it('shows the committee in force with degree and position', async () => {
    server.use(
      http.get('*/quality-committees/current', () =>
        HttpResponse.json(makeCurrentCommitteeResponse()),
      ),
      http.get('*/quality-committees', () => HttpResponse.json(makeCommitteeListResponse())),
    );

    renderWithProviders(<QualityCommitteePage />, {
      withRouter: true,
      permissions: [{ code: 'comite.ver', scope: 'GLOBAL' }],
    });

    expect(await screen.findByText('Ana Torres')).toBeInTheDocument();
    expect(screen.getByText('Dr.')).toBeInTheDocument();
    expect(screen.getByText('Presidente')).toBeInTheDocument();
    expect(screen.getByText('Carlos Méndez')).toBeInTheDocument();
    expect(screen.getByText('Mg.')).toBeInTheDocument();
    expect(screen.getByText('Miembro')).toBeInTheDocument();
    expect(screen.getByText('Vinculado a Ana Torres Quispe')).toBeInTheDocument();
  });

  it('registers a committee with degree and position', async () => {
    const user = userEvent.setup();
    let capturedBody: unknown = null;

    server.use(
      http.get('*/quality-committees/current', () =>
        HttpResponse.json(makeCurrentCommitteeResponse({ committee: null })),
      ),
      http.get('*/quality-committees', () =>
        HttpResponse.json(makeCommitteeListResponse({ items: [], total: 0 })),
      ),
      http.post('*/quality-committees', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(SAMPLE_CURRENT_COMMITTEE, { status: 201 });
      }),
    );

    renderWithProviders(<QualityCommitteePage />, {
      withRouter: true,
      permissions: [
        { code: 'comite.ver', scope: 'GLOBAL' },
        { code: 'comite.editar', scope: 'GLOBAL' },
      ],
    });

    await user.click(await screen.findByRole('button', { name: /Registrar Comité/i }));

    await user.type(screen.getByLabelText('Fecha de inicio'), '2027-01-01');
    await user.type(screen.getByLabelText('Fecha de fin'), '2027-12-31');

    const firstRow = screen.getByRole('group', { name: 'Miembro 1' });
    await user.type(within(firstRow).getByLabelText('Nombre completo'), 'Ana Torres');
    await user.type(within(firstRow).getByLabelText('Grado académico'), 'Dr.');

    await user.click(screen.getByRole('button', { name: /Agregar miembro/i }));
    const secondRow = screen.getByRole('group', { name: 'Miembro 2' });
    await user.type(within(secondRow).getByLabelText('Nombre completo'), 'Carlos Méndez');
    await user.type(within(secondRow).getByLabelText('Grado académico'), 'Mg.');

    await user.click(screen.getByRole('button', { name: 'Guardar Comité' }));

    expect(
      await screen.findByText('Comité de Calidad registrado correctamente.'),
    ).toBeInTheDocument();
    expect(capturedBody).toEqual({
      periodStart: '2027-01-01',
      periodEnd: '2027-12-31',
      members: [
        { fullName: 'Ana Torres', degree: 'Dr.', position: 'PRESIDENT' },
        { fullName: 'Carlos Méndez', degree: 'Mg.', position: 'MEMBER' },
      ],
    });
  });

  it('links a member by institutional email', async () => {
    const user = userEvent.setup();
    let capturedBody: unknown = null;

    server.use(
      http.get('*/quality-committees/current', () =>
        HttpResponse.json(makeCurrentCommitteeResponse({ committee: null })),
      ),
      http.get('*/quality-committees', () =>
        HttpResponse.json(makeCommitteeListResponse({ items: [], total: 0 })),
      ),
      http.post('*/quality-committees', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(SAMPLE_CURRENT_COMMITTEE, { status: 201 });
      }),
    );

    renderWithProviders(<QualityCommitteePage />, {
      withRouter: true,
      permissions: [
        { code: 'comite.ver', scope: 'GLOBAL' },
        { code: 'comite.editar', scope: 'GLOBAL' },
      ],
    });

    await user.click(await screen.findByRole('button', { name: /Registrar Comité/i }));
    await user.type(screen.getByLabelText('Fecha de inicio'), '2027-01-01');
    await user.type(screen.getByLabelText('Fecha de fin'), '2027-12-31');

    const row = screen.getByRole('group', { name: 'Miembro 1' });
    await user.type(within(row).getByLabelText('Nombre completo'), 'Ana Torres');
    await user.type(within(row).getByLabelText('Grado académico'), 'Dr.');
    await user.type(
      within(row).getByLabelText('Correo institucional (opcional)'),
      'ana.torres@example.test',
    );

    await user.click(screen.getByRole('button', { name: 'Guardar Comité' }));

    await waitFor(() => expect(capturedBody).not.toBeNull());
    expect(capturedBody).toEqual({
      periodStart: '2027-01-01',
      periodEnd: '2027-12-31',
      members: [
        {
          fullName: 'Ana Torres',
          degree: 'Dr.',
          position: 'PRESIDENT',
          userEmail: 'ana.torres@example.test',
        },
      ],
    });
  });

  it('shows that the actor is a current member', async () => {
    server.use(
      http.get('*/quality-committees/current', () =>
        HttpResponse.json(
          makeCurrentCommitteeResponse({
            actorMembership: { memberId: 'mem-1', position: 'PRESIDENT' },
          }),
        ),
      ),
      http.get('*/quality-committees', () => HttpResponse.json(makeCommitteeListResponse())),
    );

    renderWithProviders(<QualityCommitteePage />, {
      withRouter: true,
      permissions: [{ code: 'comite.ver', scope: 'GLOBAL' }],
    });

    expect(
      await screen.findByText('Eres miembro vigente del Comité (Presidente).'),
    ).toBeInTheDocument();
  });

  it('shows the alert only to who can edit users', async () => {
    const withAlerts = makeCurrentCommitteeResponse({
      alerts: [{ userId: 'usr-old', fullName: 'Pedro Salas' }],
    });

    server.use(
      http.get('*/quality-committees/current', () => HttpResponse.json(withAlerts)),
      http.get('*/quality-committees', () => HttpResponse.json(makeCommitteeListResponse())),
    );

    const withoutEditUsers = renderWithProviders(<QualityCommitteePage />, {
      withRouter: true,
      permissions: [{ code: 'comite.ver', scope: 'GLOBAL' }],
    });
    expect(await screen.findByText('Ana Torres')).toBeInTheDocument();
    expect(
      screen.queryByText(/Pedro Salas tiene el rol Presidente pero no es el Presidente vigente/i),
    ).not.toBeInTheDocument();
    withoutEditUsers.unmount();

    renderWithProviders(<QualityCommitteePage />, {
      withRouter: true,
      permissions: [
        { code: 'comite.ver', scope: 'GLOBAL' },
        { code: 'usuario.editar', scope: 'GLOBAL' },
      ],
    });
    expect(
      await screen.findByText(
        /Pedro Salas tiene el rol Presidente pero no es el Presidente vigente del Comité/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir a Usuarios' })).toHaveAttribute(
      'href',
      '/usuarios',
    );
  });

  it('hides register and edit actions without comite.editar', async () => {
    server.use(
      http.get('*/quality-committees/current', () =>
        HttpResponse.json(makeCurrentCommitteeResponse()),
      ),
      http.get('*/quality-committees', () => HttpResponse.json(makeCommitteeListResponse())),
    );

    renderWithProviders(<QualityCommitteePage />, {
      withRouter: true,
      permissions: [{ code: 'comite.ver', scope: 'GLOBAL' }],
    });

    expect(await screen.findByText('Ana Torres')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Registrar Comité/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar miembros/i })).not.toBeInTheDocument();
  });

  it('hides editing for a finished committee and keeps existing userId link on edit', async () => {
    const user = userEvent.setup();
    let capturedPutBody: unknown = null;

    server.use(
      http.get('*/quality-committees/current', () =>
        HttpResponse.json(makeCurrentCommitteeResponse()),
      ),
      http.get('*/quality-committees', () =>
        HttpResponse.json(
          makeCommitteeListResponse({
            items: [SAMPLE_CURRENT_COMMITTEE, SAMPLE_FINISHED_COMMITTEE],
            total: 2,
          }),
        ),
      ),
      http.put('*/quality-committees/com-2027/members', async ({ request }) => {
        capturedPutBody = await request.json();
        return HttpResponse.json(SAMPLE_CURRENT_COMMITTEE, { status: 200 });
      }),
    );

    renderWithProviders(<QualityCommitteePage />, {
      withRouter: true,
      permissions: [
        { code: 'comite.ver', scope: 'GLOBAL' },
        { code: 'comite.editar', scope: 'GLOBAL' },
      ],
    });

    expect(await screen.findByText('Solo lectura')).toBeInTheDocument();

    const editButtons = screen.getAllByRole('button', { name: /Editar miembros/i });
    expect(editButtons.length).toBeGreaterThanOrEqual(1);
    await user.click(editButtons[0]!);

    expect(screen.getByText(/Periodo \(solo lectura\)/i)).toBeInTheDocument();
    expect(screen.getAllByText('Vinculado a Ana Torres Quispe').length).toBeGreaterThanOrEqual(1);

    await user.click(screen.getByRole('button', { name: 'Guardar Comité' }));
    await waitFor(() => expect(capturedPutBody).not.toBeNull());
    expect(capturedPutBody).toEqual({
      members: [
        { fullName: 'Ana Torres', degree: 'Dr.', position: 'PRESIDENT', userId: 'usr-1' },
        { fullName: 'Carlos Méndez', degree: 'Mg.', position: 'MEMBER' },
      ],
    });
  });

  it('shows the server error when registration fails with 409', async () => {
    const user = userEvent.setup();

    server.use(
      http.get('*/quality-committees/current', () =>
        HttpResponse.json(makeCurrentCommitteeResponse({ committee: null })),
      ),
      http.get('*/quality-committees', () =>
        HttpResponse.json(makeCommitteeListResponse({ items: [], total: 0 })),
      ),
      http.post('*/quality-committees', () =>
        HttpResponse.json(
          {
            error: {
              code: 'CONFLICT',
              message: 'El periodo indicado se solapa con un Comité de Calidad ya registrado.',
            },
          },
          { status: 409 },
        ),
      ),
    );

    renderWithProviders(<QualityCommitteePage />, {
      withRouter: true,
      permissions: [
        { code: 'comite.ver', scope: 'GLOBAL' },
        { code: 'comite.editar', scope: 'GLOBAL' },
      ],
    });

    await user.click(await screen.findByRole('button', { name: /Registrar Comité/i }));
    await user.type(screen.getByLabelText('Fecha de inicio'), '2027-01-01');
    await user.type(screen.getByLabelText('Fecha de fin'), '2027-12-31');
    const row = screen.getByRole('group', { name: 'Miembro 1' });
    await user.type(within(row).getByLabelText('Nombre completo'), 'Ana Torres');
    await user.type(within(row).getByLabelText('Grado académico'), 'Dr.');
    await user.click(screen.getByRole('button', { name: 'Guardar Comité' }));

    expect(
      await screen.findByText(
        'El periodo indicado se solapa con un Comité de Calidad ya registrado.',
      ),
    ).toBeInTheDocument();
  });

  it('sends one request on double click', async () => {
    const user = userEvent.setup();
    let postCalls = 0;

    server.use(
      http.get('*/quality-committees/current', () =>
        HttpResponse.json(makeCurrentCommitteeResponse({ committee: null })),
      ),
      http.get('*/quality-committees', () =>
        HttpResponse.json(makeCommitteeListResponse({ items: [], total: 0 })),
      ),
      http.post('*/quality-committees', async () => {
        postCalls += 1;
        await delay(40);
        return HttpResponse.json(SAMPLE_CURRENT_COMMITTEE, { status: 201 });
      }),
    );

    renderWithProviders(<QualityCommitteePage />, {
      withRouter: true,
      permissions: [
        { code: 'comite.ver', scope: 'GLOBAL' },
        { code: 'comite.editar', scope: 'GLOBAL' },
      ],
    });

    await user.click(await screen.findByRole('button', { name: /Registrar Comité/i }));
    await user.type(screen.getByLabelText('Fecha de inicio'), '2027-01-01');
    await user.type(screen.getByLabelText('Fecha de fin'), '2027-12-31');
    const row = screen.getByRole('group', { name: 'Miembro 1' });
    await user.type(within(row).getByLabelText('Nombre completo'), 'Ana Torres');
    await user.type(within(row).getByLabelText('Grado académico'), 'Dr.');

    const submitButton = screen.getByRole('button', { name: 'Guardar Comité' });
    await user.dblClick(submitButton);

    expect(
      await screen.findByText('Comité de Calidad registrado correctamente.'),
    ).toBeInTheDocument();
    expect(postCalls).toBe(1);
  });

  it('is keyboard operable', async () => {
    const user = userEvent.setup();

    server.use(
      http.get('*/quality-committees/current', () =>
        HttpResponse.json(makeCurrentCommitteeResponse({ committee: null })),
      ),
      http.get('*/quality-committees', () =>
        HttpResponse.json(makeCommitteeListResponse({ items: [], total: 0 })),
      ),
    );

    renderWithProviders(<QualityCommitteePage />, {
      withRouter: true,
      permissions: [
        { code: 'comite.ver', scope: 'GLOBAL' },
        { code: 'comite.editar', scope: 'GLOBAL' },
      ],
    });

    const registerButton = await screen.findByRole('button', { name: /Registrar Comité/i });
    registerButton.focus();
    expect(registerButton).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(screen.getByLabelText('Fecha de inicio')).toBeInTheDocument();
    await user.tab();
    expect(document.activeElement).not.toBe(document.body);
  });

  it('renders the title with the shared page header', async () => {
    server.use(
      http.get('*/quality-committees/current', () =>
        HttpResponse.json(makeCurrentCommitteeResponse({ committee: null })),
      ),
      http.get('*/quality-committees', () =>
        HttpResponse.json(makeCommitteeListResponse({ items: [], total: 0 })),
      ),
    );

    renderWithProviders(<QualityCommitteePage />, {
      withRouter: true,
      permissions: [{ code: 'comite.ver', scope: 'GLOBAL' }],
    });

    const heading = await screen.findByRole('heading', { level: 1, name: 'Comité de Calidad' });
    expect(heading).toHaveClass('text-h2', 'sm:text-h1');
  });
});
