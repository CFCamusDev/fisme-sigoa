import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, delay, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import * as blobDownload from '@/lib/blob-download';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import {
  EMPLOYER_LIST_DTO,
  makeStakeholderListsResponse,
} from '../test/stakeholder-lists-fixtures';
import { INSTITUTION_STAKEHOLDER, makeListResponse } from '../test/stakeholders-fixtures';
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
      http.get('*/me/permissions', () => HttpResponse.json({ permissions: EDIT_PERMISSIONS })),
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

    renderWithProviders(<StakeholderListsPage />, {
      withRouter: false,
      permissions: EDIT_PERMISSIONS,
    });
    expect(screen.getAllByText(/Cargando lista del Anexo 3/i).length).toBeGreaterThan(0);
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
      http.get('*/me/permissions', () => HttpResponse.json({ permissions: EDIT_PERMISSIONS })),
      http.get('*/stakeholder-lists', () =>
        HttpResponse.json(makeStakeholderListsResponse(createdList ? [createdList] : [])),
      ),
      http.post('*/stakeholder-lists', () => {
        createdList = { ...EMPLOYER_LIST_DTO, memberCount: 0, members: [] };
        return HttpResponse.json(createdList, { status: 201 });
      }),
    );

    renderWithProviders(<StakeholderListsPage />, {
      withRouter: false,
      permissions: EDIT_PERMISSIONS,
    });

    const yearInput = screen.getByLabelText(/^Año$/i);
    await user.clear(yearInput);
    await user.type(yearInput, '2027');
    await user.click(screen.getByRole('button', { name: /Ver lista/i }));

    await user.click(await screen.findByRole('button', { name: /Crear lista/i }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveClass('w-[640px]');
    await user.type(within(dialog).getByLabelText(/N\.° de plan de estudios/i), '2024-II');
    await user.click(within(dialog).getByRole('button', { name: /Crear lista/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/creada correctamente/i);
  });

  it('shows the Annex 3 columns of the employers list (CA1)', async () => {
    server.use(
      http.get('*/stakeholder-lists', () =>
        HttpResponse.json(makeStakeholderListsResponse([EMPLOYER_LIST_DTO])),
      ),
    );

    renderWithProviders(<StakeholderListsPage />, {
      withRouter: false,
      permissions: EDIT_PERMISSIONS,
    });

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
      http.get('*/me/permissions', () => HttpResponse.json({ permissions: EDIT_PERMISSIONS })),
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

    renderWithProviders(<StakeholderListsPage />, {
      withRouter: false,
      permissions: EDIT_PERMISSIONS,
    });

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

    renderWithProviders(<StakeholderListsPage />, {
      withRouter: false,
      permissions: VIEW_ONLY_PERMISSIONS,
    });

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

    renderWithProviders(<StakeholderListsPage />, {
      withRouter: false,
      permissions: [],
    });

    expect(await screen.findByText(/Acceso denegado/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reintentar/i })).not.toBeInTheDocument();
  });

  it('disables the actions while the request is in flight', async () => {
    const user = userEvent.setup();
    let resolvePost!: () => void;

    server.use(
      http.get('*/me/permissions', () => HttpResponse.json({ permissions: EDIT_PERMISSIONS })),
      http.get('*/stakeholder-lists', () => HttpResponse.json(makeStakeholderListsResponse([]))),
      http.post('*/stakeholder-lists', async () => {
        await new Promise<void>((resolve) => {
          resolvePost = resolve;
        });
        return HttpResponse.json(EMPLOYER_LIST_DTO, { status: 201 });
      }),
    );

    renderWithProviders(<StakeholderListsPage />, {
      withRouter: false,
      permissions: EDIT_PERMISSIONS,
    });

    await user.click(await screen.findByRole('button', { name: /Crear lista/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Crear lista/i }));

    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: /Guardando…/i })).toBeDisabled(),
    );

    resolvePost();
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
  });

  it('shows the import button only with the import permission and closes with Escape returning focus', async () => {
    const user = userEvent.setup();
    let allowImport = false;
    server.use(
      http.get('*/me/permissions', () =>
        HttpResponse.json({
          permissions: allowImport
            ? [...EDIT_PERMISSIONS, { code: 'constituyente.importar', scope: 'GLOBAL' }]
            : VIEW_ONLY_PERMISSIONS,
        }),
      ),
      http.get('*/stakeholder-lists', () =>
        HttpResponse.json(makeStakeholderListsResponse([EMPLOYER_LIST_DTO])),
      ),
    );

    const { unmount } = renderWithProviders(<StakeholderListsPage />, {
      withRouter: false,
      permissions: VIEW_ONLY_PERMISSIONS,
    });

    await screen.findByText('Tech Amazonas SAC');
    expect(screen.queryByRole('button', { name: /Importar desde Excel/i })).not.toBeInTheDocument();
    unmount();

    allowImport = true;
    renderWithProviders(<StakeholderListsPage />, {
      withRouter: false,
      permissions: [...EDIT_PERMISSIONS, { code: 'constituyente.importar', scope: 'GLOBAL' }],
    });

    const importButton = await screen.findByRole('button', { name: /Importar desde Excel/i });
    await user.click(importButton);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveClass('w-[960px]');
    expect(dialog).toHaveTextContent(/Importar constituyentes desde Excel/i);

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(importButton).toHaveFocus();
  });

  it('downloads the list pdf when the button is pressed', async () => {
    const user = userEvent.setup();
    const saveSpy = vi.spyOn(blobDownload, 'saveBlobFile').mockImplementation(() => {});
    const pdfPermissions = [
      ...VIEW_ONLY_PERMISSIONS,
      { code: 'documento.descargar', scope: 'GLOBAL' as const },
    ];

    server.use(
      http.get('*/me/permissions', () => HttpResponse.json({ permissions: pdfPermissions })),
      http.get('*/stakeholder-lists', () =>
        HttpResponse.json(makeStakeholderListsResponse([EMPLOYER_LIST_DTO])),
      ),
      http.get('*/stakeholder-lists/:id/pdf', () => {
        return new HttpResponse('%PDF-1.4\nAnexo 3', {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="fo-03-2027-v1.pdf"',
          },
        });
      }),
    );

    renderWithProviders(<StakeholderListsPage />, {
      withRouter: false,
      permissions: pdfPermissions,
    });

    const downloadButton = await screen.findByRole('button', { name: /Descargar PDF/i });
    await user.click(downloadButton);

    await waitFor(() => {
      expect(saveSpy).toHaveBeenCalledTimes(1);
    });
    expect(saveSpy.mock.calls[0]?.[1]).toBe('fo-03-2027-v1.pdf');
    expect(downloadButton).toBeEnabled();
    saveSpy.mockRestore();
  });

  it('sends a single request on a double click and disables the button while loading', async () => {
    const user = userEvent.setup();
    const saveSpy = vi.spyOn(blobDownload, 'saveBlobFile').mockImplementation(() => {});
    const pdfPermissions = [
      ...VIEW_ONLY_PERMISSIONS,
      { code: 'documento.descargar', scope: 'GLOBAL' as const },
    ];

    let pdfRequests = 0;
    let releaseResponse!: () => void;
    const responseGate = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });

    server.use(
      http.get('*/me/permissions', () => HttpResponse.json({ permissions: pdfPermissions })),
      http.get('*/stakeholder-lists', () =>
        HttpResponse.json(makeStakeholderListsResponse([EMPLOYER_LIST_DTO])),
      ),
      http.get('*/stakeholder-lists/:id/pdf', async () => {
        pdfRequests += 1;
        await responseGate;
        return new HttpResponse('%PDF-1.4\nAnexo 3', {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="fo-03-2027-v1.pdf"',
          },
        });
      }),
    );

    renderWithProviders(<StakeholderListsPage />, {
      withRouter: false,
      permissions: pdfPermissions,
    });

    const downloadButton = await screen.findByRole('button', { name: /Descargar PDF/i });
    await user.dblClick(downloadButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Generando PDF…/i })).toBeDisabled();
    });
    expect(screen.getByRole('button', { name: /Generando PDF…/i })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(pdfRequests).toBe(1);

    releaseResponse();
    await waitFor(() => {
      expect(saveSpy).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByRole('button', { name: /Descargar PDF/i })).toBeEnabled();
    saveSpy.mockRestore();
  });

  it('shows the error and keeps the button usable when the download fails', async () => {
    const user = userEvent.setup();
    const pdfPermissions = [
      ...VIEW_ONLY_PERMISSIONS,
      { code: 'documento.descargar', scope: 'GLOBAL' as const },
    ];

    server.use(
      http.get('*/me/permissions', () => HttpResponse.json({ permissions: pdfPermissions })),
      http.get('*/stakeholder-lists', () =>
        HttpResponse.json(makeStakeholderListsResponse([EMPLOYER_LIST_DTO])),
      ),
      http.get('*/stakeholder-lists/:id/pdf', () =>
        HttpResponse.json(
          {
            error: {
              code: 'CONFLICT',
              message: 'Ya hay una descarga de anexo en curso para este usuario.',
            },
          },
          { status: 409 },
        ),
      ),
    );

    renderWithProviders(<StakeholderListsPage />, {
      withRouter: false,
      permissions: pdfPermissions,
    });

    const downloadButton = await screen.findByRole('button', { name: /Descargar PDF/i });
    await user.click(downloadButton);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/No se pudo descargar el PDF/i);
    expect(alert).toHaveTextContent(/descarga de anexo en curso/i);
    expect(downloadButton).toBeEnabled();
  });

  it('hides the button without documento.descargar', async () => {
    server.use(
      http.get('*/me/permissions', () => HttpResponse.json({ permissions: VIEW_ONLY_PERMISSIONS })),
      http.get('*/stakeholder-lists', () =>
        HttpResponse.json(makeStakeholderListsResponse([EMPLOYER_LIST_DTO])),
      ),
    );

    renderWithProviders(<StakeholderListsPage />, {
      withRouter: false,
      permissions: VIEW_ONLY_PERMISSIONS,
    });

    await screen.findByText('Tech Amazonas SAC');
    expect(screen.queryByRole('button', { name: /Descargar PDF/i })).not.toBeInTheDocument();
  });

  it('disables pdf download with zero members and explains why', async () => {
    const pdfPermissions = [
      ...VIEW_ONLY_PERMISSIONS,
      { code: 'documento.descargar', scope: 'GLOBAL' as const },
    ];

    server.use(
      http.get('*/me/permissions', () => HttpResponse.json({ permissions: pdfPermissions })),
      http.get('*/stakeholder-lists', () =>
        HttpResponse.json(
          makeStakeholderListsResponse([{ ...EMPLOYER_LIST_DTO, memberCount: 0, members: [] }]),
        ),
      ),
    );

    renderWithProviders(<StakeholderListsPage />, {
      withRouter: false,
      permissions: pdfPermissions,
    });

    const downloadButton = await screen.findByRole('button', { name: /Descargar PDF/i });
    const reason = screen.getByText(/Agrega al menos un miembro para descargar el PDF/i);
    expect(downloadButton).toBeDisabled();
    expect(downloadButton).toHaveAttribute('aria-describedby', reason.id);
  });

  it('adds members in a 640px side panel without closing it', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('*/me/permissions', () => HttpResponse.json({ permissions: EDIT_PERMISSIONS })),
      http.get('*/stakeholder-lists', () =>
        HttpResponse.json(makeStakeholderListsResponse([EMPLOYER_LIST_DTO])),
      ),
      http.get('*/stakeholders', () =>
        HttpResponse.json(
          makeListResponse([
            {
              ...INSTITUTION_STAKEHOLDER,
              id: 'sh-extra',
              fullName: 'Selva Soft SAC',
              ruc: '20987654321',
            },
          ]),
        ),
      ),
      http.post('*/stakeholder-lists/:id/members', () =>
        HttpResponse.json(
          {
            ...EMPLOYER_LIST_DTO.members[0],
            id: 'mem-new',
            stakeholderId: 'sh-extra',
            fullName: 'Selva Soft SAC',
            ruc: '20987654321',
          },
          { status: 201 },
        ),
      ),
    );

    renderWithProviders(<StakeholderListsPage />, {
      withRouter: false,
      permissions: EDIT_PERMISSIONS,
    });

    await user.click(await screen.findByRole('button', { name: /Agregar constituyentes/i }));
    const sheet = await screen.findByRole('dialog');
    expect(sheet).toHaveClass('w-[640px]');

    await user.click(
      await within(sheet).findByRole('button', { name: /Agregar Selva Soft SAC a la lista/i }),
    );
    await user.type(within(sheet).getByLabelText(/Representante legal/i), 'Carlos Mendoza');
    await user.click(within(sheet).getByRole('button', { name: /^Confirmar$/i }));
    expect(await screen.findByText(/Se agregó "Selva Soft SAC" a la lista/i)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBe(sheet);
  });

  it('copies a list in a 480px side panel', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('*/me/permissions', () => HttpResponse.json({ permissions: EDIT_PERMISSIONS })),
      http.get('*/stakeholder-lists', () =>
        HttpResponse.json(makeStakeholderListsResponse([EMPLOYER_LIST_DTO])),
      ),
    );

    renderWithProviders(<StakeholderListsPage />, {
      withRouter: false,
      permissions: EDIT_PERMISSIONS,
    });

    await user.click(await screen.findByRole('button', { name: /Copiar para nuevo año/i }));
    const sheet = await screen.findByRole('dialog');
    expect(sheet).toHaveClass('w-[480px]');
    expect(sheet).toHaveTextContent(/Copiar lista de Empleadores/i);
  });
});
