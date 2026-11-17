import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, delay, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import {
  EMPLOYER_LIST_DTO,
  makeStakeholderListsResponse,
} from '../test/stakeholder-lists-fixtures';
import { StakeholderListsPage } from './stakeholder-lists-page';

const EDIT_PERMISSIONS = [
  { code: 'constituyente.ver', scope: 'GLOBAL' as const },
  { code: 'constituyente.editar', scope: 'GLOBAL' as const },
];

const VIEW_ONLY_PERMISSIONS = [{ code: 'constituyente.ver', scope: 'GLOBAL' as const }];

describe('StakeholderListsPage (HU-022, T-022-28)', () => {
  it('renders loading, empty, error and data states', async () => {
    let mode: 'empty' | 'error' | 'data' = 'empty';
    server.use(
      http.get('*/stakeholder-lists', async () => {
        await delay(20);
        if (mode === 'error') {
          return HttpResponse.json(
            { error: { code: 'INTERNAL', message: 'Fallo temporal' } },
            { status: 500 },
          );
        }
        return HttpResponse.json(
          makeStakeholderListsResponse(mode === 'data' ? [EMPLOYER_LIST_DTO] : []),
        );
      }),
    );

    renderWithProviders(<StakeholderListsPage />, { permissions: EDIT_PERMISSIONS });
    expect(screen.getByText(/Cargando lista del Anexo 3/i)).toBeInTheDocument();
    expect(await screen.findByText(/No existe lista de Empleadores/i)).toBeInTheDocument();

    const user = userEvent.setup();
    mode = 'error';
    const yearInput = screen.getByLabelText(/^Año$/i);
    await user.clear(yearInput);
    await user.type(yearInput, '2027');
    await user.click(screen.getByRole('button', { name: /Ver lista/i }));

    expect(await screen.findByRole('button', { name: /Reintentar/i })).toBeInTheDocument();

    mode = 'data';
    await user.click(screen.getByRole('button', { name: /Reintentar/i }));
    expect(await screen.findByText(/Tech Amazonas SAC/i)).toBeInTheDocument();
  });

  it('creates the list for the chosen type and year', async () => {
    const user = userEvent.setup();
    let createdList: typeof EMPLOYER_LIST_DTO | null = null;

    server.use(
      http.get('*/stakeholder-lists', () =>
        HttpResponse.json(makeStakeholderListsResponse(createdList ? [createdList] : [])),
      ),
      http.post('*/stakeholder-lists', () => {
        createdList = { ...EMPLOYER_LIST_DTO, memberCount: 0, members: [] };
        return HttpResponse.json(createdList, { status: 201 });
      }),
    );

    renderWithProviders(<StakeholderListsPage />, { permissions: EDIT_PERMISSIONS });

    const yearInput = screen.getByLabelText(/^Año$/i);
    await user.clear(yearInput);
    await user.type(yearInput, '2027');
    await user.click(screen.getByRole('button', { name: /Ver lista/i }));

    await screen.findByRole('button', { name: /Crear lista/i });
    await user.type(screen.getByLabelText(/N\.° de plan de estudios/i), '2024-II');
    await user.click(screen.getByRole('button', { name: /Crear lista/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/creada correctamente/i);
  });

  it('shows the Annex 3 columns of the employers list (CA1)', async () => {
    server.use(
      http.get('*/stakeholder-lists', () =>
        HttpResponse.json(makeStakeholderListsResponse([EMPLOYER_LIST_DTO])),
      ),
    );

    renderWithProviders(<StakeholderListsPage />, { permissions: EDIT_PERMISSIONS });

    await screen.findByText('Tech Amazonas SAC');
    for (const heading of [
      'Institución',
      'RUC',
      'Sector',
      'Representante',
      'Correo',
      'Celular',
      'Cargo',
    ]) {
      expect(screen.getByRole('columnheader', { name: heading })).toBeInTheDocument();
    }
    expect(screen.getByText('20123456789')).toBeInTheDocument();
    expect(screen.getByText('Carlos Mendoza')).toBeInTheDocument();
    expect(screen.getByText('Gerencia TI')).toBeInTheDocument();
  });

  it('copies the list for a new year and reports the skipped members (CA3)', async () => {
    const user = userEvent.setup();
    let currentYear = 2027;

    server.use(
      http.get('*/stakeholder-lists', ({ request }) => {
        const url = new URL(request.url);
        const year = Number(url.searchParams.get('year'));
        return HttpResponse.json(
          makeStakeholderListsResponse([{ ...EMPLOYER_LIST_DTO, year: year || currentYear }]),
        );
      }),
      http.post('*/stakeholder-lists/:id/copy', () => {
        currentYear = 2028;
        return HttpResponse.json(
          {
            list: { ...EMPLOYER_LIST_DTO, id: 'list-emp-2028', year: 2028 },
            skipped: [
              {
                stakeholderId: 'stk-voided-1',
                fullName: 'Empresa Anulada SAC',
                reason: 'VOIDED',
              },
            ],
          },
          { status: 201 },
        );
      }),
    );

    renderWithProviders(<StakeholderListsPage />, { permissions: EDIT_PERMISSIONS });

    const copyBtn = await screen.findByRole('button', { name: /Copiar para nuevo año/i });
    await user.click(copyBtn);

    const targetYear = screen.getByLabelText(/Año destino/i);
    await user.clear(targetYear);
    await user.type(targetYear, '2028');
    await user.click(screen.getByRole('button', { name: /Copiar lista/i }));

    const alert = await screen.findByRole('status');
    expect(alert).toHaveTextContent(/Se copiaron 1 miembros a la lista 2028/i);
    expect(alert).toHaveTextContent(/Empresa Anulada SAC — Anulado/i);
  });

  it('hides create, add and copy without constituyente.editar', async () => {
    server.use(
      http.get('*/stakeholder-lists', () =>
        HttpResponse.json(makeStakeholderListsResponse([EMPLOYER_LIST_DTO])),
      ),
    );

    renderWithProviders(<StakeholderListsPage />, { permissions: VIEW_ONLY_PERMISSIONS });

    await screen.findByText('Tech Amazonas SAC');
    expect(
      screen.queryByRole('button', { name: /Agregar constituyentes/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Copiar para nuevo año/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Crear lista/i })).not.toBeInTheDocument();
  });

  it('shows access denied without constituyente.ver', async () => {
    server.use(
      http.get('*/stakeholder-lists', () =>
        HttpResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Sin permiso' } },
          { status: 403 },
        ),
      ),
    );

    renderWithProviders(<StakeholderListsPage />, { permissions: [] });

    expect(await screen.findByText(/Acceso denegado/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reintentar/i })).not.toBeInTheDocument();
  });

  it('disables the actions while the request is in flight', async () => {
    const user = userEvent.setup();
    let resolvePost!: () => void;

    server.use(
      http.get('*/stakeholder-lists', () => HttpResponse.json(makeStakeholderListsResponse([]))),
      http.post('*/stakeholder-lists', async () => {
        await new Promise<void>((resolve) => {
          resolvePost = resolve;
        });
        return HttpResponse.json(EMPLOYER_LIST_DTO, { status: 201 });
      }),
    );

    renderWithProviders(<StakeholderListsPage />, { permissions: EDIT_PERMISSIONS });

    const submitButton = await screen.findByRole('button', { name: /Crear lista/i });
    await user.click(submitButton);

    await waitFor(() => expect(screen.getByRole('button', { name: /Guardando…/i })).toBeDisabled());

    resolvePost();
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
  });
});
