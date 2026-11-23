import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, delay, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import {
  INSTITUTION_STAKEHOLDER,
  PERSON_STAKEHOLDER,
  VOIDED_STAKEHOLDER,
  makeListResponse,
} from '../test/stakeholders-fixtures';
import { StakeholdersPage } from './stakeholders-page';

const FULL_PERMS = [
  { code: 'constituyente.ver', scope: 'GLOBAL' as const },
  { code: 'constituyente.editar', scope: 'GLOBAL' as const },
];

const VIEW_ONLY_PERMS = [{ code: 'constituyente.ver', scope: 'GLOBAL' as const }];

describe('StakeholdersPage (HU-021, T-021-17, T-021-29)', () => {
  it('renders loading, empty, error and data states', async () => {
    server.use(
      http.get('*/stakeholders', async () => {
        await delay(20);
        return HttpResponse.json(makeListResponse([]));
      }),
    );

    const first = renderWithProviders(<StakeholdersPage />, {
      withRouter: false,
      permissions: FULL_PERMS,
    });
    expect(screen.getAllByText(/cargando registro de constituyentes/i).length).toBeGreaterThan(0);
    expect(await screen.findByText(/no hay constituyentes registrados/i)).toBeInTheDocument();
    first.unmount();

    server.use(
      http.get('*/stakeholders', () =>
        HttpResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Falla' } }, { status: 500 }),
      ),
    );
    const second = renderWithProviders(<StakeholdersPage />, {
      withRouter: false,
      permissions: FULL_PERMS,
    });
    expect(await screen.findByText(/no se pudo cargar el registro/i)).toBeInTheDocument();
    second.unmount();

    server.use(
      http.get('*/stakeholders', () =>
        HttpResponse.json(makeListResponse([PERSON_STAKEHOLDER, INSTITUTION_STAKEHOLDER])),
      ),
    );
    renderWithProviders(<StakeholdersPage />, {
      withRouter: false,
      permissions: FULL_PERMS,
    });
    expect(await screen.findByText('Ana Lucia Torres')).toBeInTheDocument();
    expect(screen.getByText('Tech Amazonas SAC')).toBeInTheDocument();
    expect(screen.queryByText('ana.torres@example.com')).not.toBeInTheDocument();
    expect(screen.queryByText('987654321')).not.toBeInTheDocument();
  });

  it('shows a no-permission state on 403', async () => {
    server.use(
      http.get('*/stakeholders', () =>
        HttpResponse.json({ error: { code: 'FORBIDDEN', message: 'Denegado' } }, { status: 403 }),
      ),
    );

    renderWithProviders(<StakeholdersPage />, {
      withRouter: false,
      permissions: VIEW_ONLY_PERMS,
    });
    expect(await screen.findByText(/acceso denegado/i)).toBeInTheDocument();
  });

  it('searches by text and filters by type and status', async () => {
    const user = userEvent.setup();
    const seenQueries: URLSearchParams[] = [];

    server.use(
      http.get('*/stakeholders', ({ request }) => {
        seenQueries.push(new URL(request.url).searchParams);
        return HttpResponse.json(makeListResponse([PERSON_STAKEHOLDER]));
      }),
    );

    renderWithProviders(<StakeholdersPage />, {
      withRouter: false,
      permissions: FULL_PERMS,
    });
    await screen.findByText('Ana Lucia Torres');

    await user.type(screen.getByLabelText(/buscar por nombre, dni o ruc/i), 'Ana');
    await user.click(screen.getByRole('button', { name: /^buscar$/i }));
    await user.selectOptions(screen.getByLabelText(/^tipo$/i), 'PERSON');
    await user.selectOptions(screen.getByLabelText(/^estado$/i), 'ACTIVE');

    await waitFor(() => {
      const last = seenQueries[seenQueries.length - 1];
      expect(last?.get('search')).toBe('Ana');
      expect(last?.get('kind')).toBe('PERSON');
      expect(last?.get('status')).toBe('ACTIVE');
    });
  });

  it('paginates', async () => {
    const user = userEvent.setup();
    const seenPages: string[] = [];

    server.use(
      http.get('*/stakeholders', ({ request }) => {
        const page = new URL(request.url).searchParams.get('page') ?? '1';
        seenPages.push(page);
        return HttpResponse.json(
          makeListResponse([PERSON_STAKEHOLDER], {
            page: Number(page),
            pageSize: 20,
            total: 25,
            totalPages: 2,
          }),
        );
      }),
    );

    renderWithProviders(<StakeholdersPage />, {
      withRouter: false,
      permissions: FULL_PERMS,
    });
    await screen.findByText(/página 1 de 2/i);

    await user.click(screen.getByRole('button', { name: /siguiente/i }));
    await waitFor(() => {
      expect(seenPages).toContain('2');
    });
  });

  it('hides register, edit and void actions without constituyente.editar and does not offer to delete', async () => {
    server.use(
      http.get('*/stakeholders', () => HttpResponse.json(makeListResponse([PERSON_STAKEHOLDER]))),
    );

    renderWithProviders(<StakeholdersPage />, {
      withRouter: false,
      permissions: VIEW_ONLY_PERMS,
    });
    await screen.findByText('Ana Lucia Torres');

    expect(
      screen.queryByRole('button', { name: /registrar constituyente/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /anular/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /eliminar/i })).not.toBeInTheDocument();
  });

  it('registers a person and shows the success message with focus (CA1)', async () => {
    const user = userEvent.setup();
    let list = [INSTITUTION_STAKEHOLDER];

    server.use(
      http.get('*/stakeholders', () => HttpResponse.json(makeListResponse(list))),
      http.post('*/stakeholders', () => {
        list = [PERSON_STAKEHOLDER, INSTITUTION_STAKEHOLDER];
        return HttpResponse.json(PERSON_STAKEHOLDER, { status: 201 });
      }),
    );

    renderWithProviders(<StakeholdersPage />, {
      withRouter: false,
      permissions: FULL_PERMS,
    });
    await screen.findByText('Tech Amazonas SAC');

    await user.click(screen.getByRole('button', { name: /registrar constituyente/i }));
    await user.type(screen.getByLabelText(/nombres y apellidos/i), 'Ana Lucia Torres');
    await user.type(screen.getByLabelText(/^dni$/i), '45678912');
    await user.click(screen.getByRole('button', { name: /guardar constituyente/i }));

    const successBanner = await screen.findByText(/registrado correctamente/i);
    expect(successBanner.closest('[role="status"]')).toHaveFocus();
  });

  it('voids with a reason, shows the voided status badge and never deletes (CA3)', async () => {
    const user = userEvent.setup();
    let current = PERSON_STAKEHOLDER;

    server.use(
      http.get('*/stakeholders', () => HttpResponse.json(makeListResponse([current]))),
      http.post('*/stakeholders/:id/void', () => {
        current = VOIDED_STAKEHOLDER;
        return HttpResponse.json(VOIDED_STAKEHOLDER);
      }),
    );

    renderWithProviders(<StakeholdersPage />, {
      withRouter: false,
      permissions: FULL_PERMS,
    });
    await screen.findByText('Ana Lucia Torres');

    expect(screen.queryByRole('button', { name: /eliminar/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /anular/i }));

    await user.type(
      screen.getByLabelText(/motivo de la anulación/i),
      'Constituyente dado de baja por solicitud expresa',
    );
    await user.click(screen.getByRole('button', { name: /confirmar anulación/i }));

    const successBanner = await screen.findByText(/anulado correctamente/i);
    expect(successBanner.closest('[role="status"]')).toHaveFocus();
    expect(await screen.findByText(/motivo de anulación:/i)).toBeInTheDocument();
    expect(screen.getAllByText('Anulado').length).toBeGreaterThanOrEqual(2);
  });

  it('registers and edits a stakeholder in a dialog', async () => {
    const user = userEvent.setup();
    let current = PERSON_STAKEHOLDER;

    server.use(
      http.get('*/stakeholders', () => HttpResponse.json(makeListResponse([current]))),
      http.patch('*/stakeholders/:id', () => {
        current = { ...PERSON_STAKEHOLDER, fullName: 'Ana Lucia Editada' };
        return HttpResponse.json(current);
      }),
    );

    renderWithProviders(<StakeholdersPage />, {
      withRouter: false,
      permissions: FULL_PERMS,
    });
    await screen.findByText('Ana Lucia Torres');

    await user.click(screen.getByRole('button', { name: /registrar constituyente/i }));
    const registerDialog = await screen.findByRole('dialog');
    expect(registerDialog).toHaveClass('w-[640px]');
    expect(registerDialog).toHaveTextContent('Registrar constituyente');
    await user.click(screen.getByRole('button', { name: /^cancelar$/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /editar/i }));
    const editDialog = await screen.findByRole('dialog');
    expect(editDialog).toHaveClass('w-[640px]');
    expect(editDialog).toHaveTextContent('Editar constituyente');

    const nameInput = screen.getByLabelText(/nombres y apellidos/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Ana Lucia Editada');
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText(/actualizado correctamente/i)).toBeInTheDocument();
  });

  it('switches the dialog to edit mode for a duplicate', async () => {
    const user = userEvent.setup();

    server.use(
      http.get('*/stakeholders', () => HttpResponse.json(makeListResponse([PERSON_STAKEHOLDER]))),
      http.post('*/stakeholders', () =>
        HttpResponse.json(
          { error: { code: 'DUPLICATE_DOCUMENT', message: 'Ya existe un constituyente.' } },
          { status: 409 },
        ),
      ),
    );

    renderWithProviders(<StakeholdersPage />, {
      withRouter: false,
      permissions: FULL_PERMS,
    });
    await screen.findByText('Ana Lucia Torres');

    await user.click(screen.getByRole('button', { name: /registrar constituyente/i }));
    const dialog = await screen.findByRole('dialog');
    await user.type(screen.getByLabelText(/nombres y apellidos/i), 'Ana Lucia Duplicada');
    await user.type(screen.getByLabelText(/^dni$/i), '45678912');
    await user.click(screen.getByRole('button', { name: /guardar constituyente/i }));

    const editExistingBtn = await screen.findByRole('button', {
      name: /editar este constituyente/i,
    });
    await user.click(editExistingBtn);

    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(dialog).toHaveTextContent('Editar constituyente');
  });
});
