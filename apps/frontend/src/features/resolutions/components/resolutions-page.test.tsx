import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { ResolutionDto } from '@sigoa/shared';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { buildCatalogVersionsResponse } from '@/test/catalog-fixtures';
import {
  buildApprovedResolution,
  buildResolution,
  buildResolutionsResponse,
} from '@/test/resolution-fixtures';
import { ResolutionsPage } from './resolutions-page';

const RESOLUTIONS = 'http://localhost:3000/resolutions';
const VERSIONS = 'http://localhost:3000/catalog-versions';

const viewer = [
  { code: 'resolucion.ver', scope: 'GLOBAL' as const },
  { code: 'catalogo.ver', scope: 'GLOBAL' as const },
];
const president = [
  ...viewer,
  { code: 'resolucion.registrar', scope: 'GLOBAL' as const },
  { code: 'resolucion.aprobar', scope: 'GLOBAL' as const },
];

function pdfFile(name = 'resolucion.pdf', size?: number) {
  const content = size === undefined ? '%PDF-1.4\n' : new Uint8Array(size);
  return new File([content], name, { type: 'application/pdf' });
}

/** Servidor con estado: el listado refleja lo que registran y aprueban las peticiones. */
function useResolutionsServer(initial: ResolutionDto[] = [], versions = 'IN_VALIDATION' as const) {
  const state = { items: [...initial], approveRequests: 0, contentType: '' as string | null };
  server.use(
    http.get(VERSIONS, () => HttpResponse.json(buildCatalogVersionsResponse({ open: versions }))),
    http.get(RESOLUTIONS, () =>
      HttpResponse.json(buildResolutionsResponse([...state.items].reverse())),
    ),
  );
  return state;
}

describe('ResolutionsPage Component (HU-048, T-048-23, CA1-CA3)', () => {
  it('renders the loading state while the resolutions are fetching', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(VERSIONS, () => HttpResponse.json(buildCatalogVersionsResponse())),
      http.get(RESOLUTIONS, async () => {
        await gate;
        return HttpResponse.json(buildResolutionsResponse([buildResolution()]));
      }),
    );

    renderWithProviders(<ResolutionsPage />, { permissions: viewer });

    expect((await screen.findAllByText(/cargando resoluciones/i)).length).toBeGreaterThan(0);
    release();
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('renders the empty state without a table', async () => {
    useResolutionsServer();

    renderWithProviders(<ResolutionsPage />, { permissions: president });

    expect(await screen.findByText('Aún no hay resoluciones registradas')).toBeInTheDocument();
    expect(screen.getByText(/Usa «Registrar resolución»/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('hides the register hint without the register permission', async () => {
    useResolutionsServer();

    renderWithProviders(<ResolutionsPage />, { permissions: viewer });

    expect(await screen.findByText('Aún no hay resoluciones registradas')).toBeInTheDocument();
    expect(screen.queryByText(/Usa «Registrar resolución»/i)).not.toBeInTheDocument();
    expect(
      screen.getByText('Cuando se registren resoluciones del Decano aparecerán aquí.'),
    ).toBeInTheDocument();
  });

  it('shows the resolutions in an accessible table with status and pdf text', async () => {
    useResolutionsServer([
      buildApprovedResolution({ id: 'res-2', type: 'GRADUATE_ATTRIBUTE', number: 'RD-020/2027' }),
      buildResolution({ id: 'res-1' }),
    ]);

    renderWithProviders(<ResolutionsPage />, { permissions: viewer });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Resoluciones' }),
    ).toBeInTheDocument();
    const table = await screen.findByRole('table', { name: /resoluciones del decano/i });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Tipo', 'Número', 'Fecha', 'Versión', 'Estado', 'PDF firmado', 'Acciones']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    const [first, second] = rows.map((row) => within(row).getAllByRole('cell'));
    expect(first?.map((cell) => cell.textContent)).toEqual([
      'Objetivos educacionales',
      'RD-012/2027-FISME',
      '10/11/2026',
      'V2',
      'Registrada',
      'Pendiente',
      '',
    ]);
    expect(second?.map((cell) => cell.textContent)).toEqual([
      'Atributos del graduado',
      'RD-020/2027',
      '10/11/2026',
      'V2',
      'Aprobada',
      'Adjunto',
      '',
    ]);
  });

  it('shows the error state with a retry that loads the list', async () => {
    let attempts = 0;
    server.use(
      http.get(VERSIONS, () => HttpResponse.json(buildCatalogVersionsResponse())),
      http.get(RESOLUTIONS, () => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.json({ error: { code: 'INTERNAL', message: 'Falla' } }, { status: 500 })
          : HttpResponse.json(buildResolutionsResponse([buildResolution()]));
      }),
    );
    const user = userEvent.setup();

    renderWithProviders(<ResolutionsPage />, { permissions: viewer });

    expect(await screen.findByText('Error al cargar las resoluciones')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('shows access denied for a 403', async () => {
    server.use(
      http.get(VERSIONS, () => HttpResponse.json(buildCatalogVersionsResponse())),
      http.get(RESOLUTIONS, () =>
        HttpResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Sin permiso' } },
          { status: 403 },
        ),
      ),
    );

    renderWithProviders(<ResolutionsPage />, { permissions: viewer });

    expect(await screen.findByText('Acceso denegado')).toBeInTheDocument();
  });

  it('hides the register and approve actions without their permissions', async () => {
    useResolutionsServer([buildResolution()]);

    renderWithProviders(<ResolutionsPage />, { permissions: viewer });

    await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: /registrar resolución/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /aprobar/i })).not.toBeInTheDocument();
  });

  describe('register (CA1)', () => {
    async function openForm(user: ReturnType<typeof userEvent.setup>) {
      await screen.findByText('Aún no hay resoluciones registradas');
      await user.click(await screen.findByRole('button', { name: 'Registrar resolución' }));
      return await screen.findByRole('form', { name: 'Registrar resolución' });
    }

    it('registers a resolution, shows the confirmation and refreshes the list', async () => {
      const state = useResolutionsServer();
      let body: unknown = null;
      server.use(
        http.post(RESOLUTIONS, async ({ request }) => {
          body = await request.json();
          const created = buildResolution({ number: 'RD-030/2027' });
          state.items.push(created);
          return HttpResponse.json(created, { status: 201 });
        }),
      );
      const user = userEvent.setup();
      renderWithProviders(<ResolutionsPage />, { permissions: president });

      const form = await openForm(user);
      await waitFor(() =>
        expect(within(form).getByLabelText('Versión del catálogo')).toHaveValue('cv-2'),
      );
      await user.type(within(form).getByLabelText('Número de resolución'), 'RD-030/2027');
      await user.type(within(form).getByLabelText('Fecha de la resolución'), '2026-11-10');
      await user.click(within(form).getByRole('button', { name: 'Registrar resolución' }));

      expect(await screen.findByText(/Se registró la resolución RD-030\/2027/)).toBeInTheDocument();
      expect(body).toEqual({
        type: 'EDUCATIONAL_OBJECTIVE',
        number: 'RD-030/2027',
        issuedOn: '2026-11-10',
        catalogVersionId: 'cv-2',
      });
      expect(await screen.findByRole('table')).toBeInTheDocument();
      expect(screen.queryByRole('form', { name: 'Registrar resolución' })).not.toBeInTheDocument();
    });

    it('validates the required fields before sending', async () => {
      useResolutionsServer();
      let posts = 0;
      server.use(
        http.post(RESOLUTIONS, () => {
          posts += 1;
          return HttpResponse.json(buildResolution(), { status: 201 });
        }),
      );
      const user = userEvent.setup();
      renderWithProviders(<ResolutionsPage />, { permissions: president });

      const form = await openForm(user);
      await user.click(within(form).getByRole('button', { name: 'Registrar resolución' }));

      expect(
        await within(form).findByText(/número de resolución es obligatorio/i),
      ).toBeInTheDocument();
      expect(posts).toBe(0);
    });

    it('shows the server message when the resolution is a duplicate (409)', async () => {
      useResolutionsServer();
      server.use(
        http.post(RESOLUTIONS, () =>
          HttpResponse.json(
            { error: { code: 'CONFLICT', message: 'Ya existe una resolución con ese número.' } },
            { status: 409 },
          ),
        ),
      );
      const user = userEvent.setup();
      renderWithProviders(<ResolutionsPage />, { permissions: president });

      const form = await openForm(user);
      await waitFor(() =>
        expect(within(form).getByLabelText('Versión del catálogo')).toHaveValue('cv-2'),
      );
      await user.type(within(form).getByLabelText('Número de resolución'), 'RD-1');
      await user.type(within(form).getByLabelText('Fecha de la resolución'), '2026-11-10');
      await user.click(within(form).getByRole('button', { name: 'Registrar resolución' }));

      expect(
        await within(form).findByText('Ya existe una resolución con ese número.'),
      ).toBeInTheDocument();
    });

    it('explains that there is no version in validation and disables the submit', async () => {
      server.use(
        http.get(VERSIONS, () => HttpResponse.json(buildCatalogVersionsResponse())),
        http.get(RESOLUTIONS, () => HttpResponse.json(buildResolutionsResponse([]))),
      );
      const user = userEvent.setup();
      renderWithProviders(<ResolutionsPage />, { permissions: president });

      const form = await openForm(user);

      expect(
        await within(form).findByText(/No hay una versión del catálogo en validación/),
      ).toBeInTheDocument();
      expect(within(form).getByRole('button', { name: 'Registrar resolución' })).toBeDisabled();
    });

    it('closes the form with Cancelar', async () => {
      useResolutionsServer();
      const user = userEvent.setup();
      renderWithProviders(<ResolutionsPage />, { permissions: president });

      const form = await openForm(user);
      await user.click(within(form).getByRole('button', { name: 'Cancelar' }));

      expect(screen.queryByRole('form', { name: 'Registrar resolución' })).not.toBeInTheDocument();
    });
  });

  describe('approve (CA2, CA3)', () => {
    async function openApproval(user: ReturnType<typeof userEvent.setup>) {
      await user.click(
        await screen.findByRole('button', { name: 'Aprobar resolución RD-012/2027-FISME' }),
      );
      return await screen.findByRole('form', { name: 'Aprobar resolución RD-012/2027-FISME' });
    }

    it('requires the signed pdf and sends nothing without it (CA3)', async () => {
      useResolutionsServer([buildResolution()]);
      let posts = 0;
      server.use(
        http.post(`${RESOLUTIONS}/res-1/approve`, () => {
          posts += 1;
          return HttpResponse.json(buildApprovedResolution());
        }),
      );
      const user = userEvent.setup();
      renderWithProviders(<ResolutionsPage />, { permissions: president });

      const form = await openApproval(user);
      await user.click(within(form).getByRole('button', { name: 'Aprobar resolución' }));

      expect(
        await within(form).findByText('Selecciona el PDF firmado para aprobar.'),
      ).toBeInTheDocument();
      expect(posts).toBe(0);
    });

    it('moves the focus to the file input when the panel opens', async () => {
      useResolutionsServer([buildResolution()]);
      const user = userEvent.setup();
      renderWithProviders(<ResolutionsPage />, { permissions: president });

      const form = await openApproval(user);

      await waitFor(() => expect(within(form).getByLabelText('PDF firmado')).toHaveFocus());
    });

    it('rejects a file that is not a pdf without sending', async () => {
      useResolutionsServer([buildResolution()]);
      let posts = 0;
      server.use(
        http.post(`${RESOLUTIONS}/res-1/approve`, () => {
          posts += 1;
          return HttpResponse.json(buildApprovedResolution());
        }),
      );
      const user = userEvent.setup({ applyAccept: false });
      renderWithProviders(<ResolutionsPage />, { permissions: president });

      const form = await openApproval(user);
      await user.upload(
        within(form).getByLabelText('PDF firmado'),
        new File(['x'], 'foto.png', { type: 'image/png' }),
      );
      await user.click(within(form).getByRole('button', { name: 'Aprobar resolución' }));

      expect(
        await within(form).findByText('El archivo debe ser un PDF (.pdf).'),
      ).toBeInTheDocument();
      expect(posts).toBe(0);
    });

    it('rejects a pdf over the limit without sending', async () => {
      useResolutionsServer([buildResolution()]);
      let posts = 0;
      server.use(
        http.post(`${RESOLUTIONS}/res-1/approve`, () => {
          posts += 1;
          return HttpResponse.json(buildApprovedResolution());
        }),
      );
      const user = userEvent.setup();
      renderWithProviders(<ResolutionsPage />, { permissions: president });

      const form = await openApproval(user);
      await user.upload(
        within(form).getByLabelText('PDF firmado'),
        pdfFile('grande.pdf', 10 * 1024 * 1024 + 1),
      );
      await user.click(within(form).getByRole('button', { name: 'Aprobar resolución' }));

      expect(await within(form).findByText('El PDF no puede pasar de 10 MB.')).toBeInTheDocument();
      expect(posts).toBe(0);
    });

    it('shows the chosen file name and size', async () => {
      useResolutionsServer([buildResolution()]);
      const user = userEvent.setup();
      renderWithProviders(<ResolutionsPage />, { permissions: president });

      const form = await openApproval(user);
      await user.upload(within(form).getByLabelText('PDF firmado'), pdfFile('firmada.pdf', 2048));

      expect(await within(form).findByText(/firmada\.pdf \(2 KB\)/)).toBeInTheDocument();
    });

    it('approves with the pdf, sends it as application/pdf and shows the approved row', async () => {
      const state = useResolutionsServer([buildResolution()]);
      server.use(
        http.post(`${RESOLUTIONS}/res-1/approve`, async ({ request }) => {
          state.contentType = request.headers.get('content-type');
          const approved = buildApprovedResolution();
          state.items = [approved];
          return HttpResponse.json(approved);
        }),
      );
      const user = userEvent.setup();
      renderWithProviders(<ResolutionsPage />, { permissions: president });

      const form = await openApproval(user);
      await user.upload(within(form).getByLabelText('PDF firmado'), pdfFile());
      await user.click(within(form).getByRole('button', { name: 'Aprobar resolución' }));

      expect(
        await screen.findByText(/Se aprobó la resolución RD-012\/2027-FISME/),
      ).toBeInTheDocument();
      expect(state.contentType).toBe('application/pdf');
      expect(await screen.findByText('Aprobada')).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /Aprobar resolución RD-012/ }),
      ).not.toBeInTheDocument();
    });

    it('sends one request when the confirm button is clicked repeatedly', async () => {
      useResolutionsServer([buildResolution()]);
      let posts = 0;
      server.use(
        http.post(`${RESOLUTIONS}/res-1/approve`, async () => {
          posts += 1;
          await delay(30);
          return HttpResponse.json(buildApprovedResolution());
        }),
      );
      const user = userEvent.setup();
      renderWithProviders(<ResolutionsPage />, { permissions: president });

      const form = await openApproval(user);
      await user.upload(within(form).getByLabelText('PDF firmado'), pdfFile());
      const confirm = within(form).getByRole('button', { name: 'Aprobar resolución' });
      await user.dblClick(confirm);

      await screen.findByText(/Se aprobó la resolución/);
      expect(posts).toBe(1);
    });

    it('shows the server message and refreshes the list when another person approved first (409)', async () => {
      const state = useResolutionsServer([buildResolution()]);
      let lists = 0;
      server.use(
        http.get(RESOLUTIONS, () => {
          lists += 1;
          return HttpResponse.json(buildResolutionsResponse(state.items));
        }),
        http.post(`${RESOLUTIONS}/res-1/approve`, () => {
          state.items = [buildApprovedResolution()];
          return HttpResponse.json(
            {
              error: {
                code: 'CONFLICT',
                message: 'La resolución ya está aprobada y no puede modificarse.',
              },
            },
            { status: 409 },
          );
        }),
      );
      const user = userEvent.setup();
      renderWithProviders(<ResolutionsPage />, { permissions: president });

      const form = await openApproval(user);
      await user.upload(within(form).getByLabelText('PDF firmado'), pdfFile());
      await user.click(within(form).getByRole('button', { name: 'Aprobar resolución' }));

      expect(
        await within(form).findByText('La resolución ya está aprobada y no puede modificarse.'),
      ).toBeInTheDocument();
      await waitFor(() => expect(lists).toBeGreaterThanOrEqual(2));
    });

    it('closes the approval panel with Escape', async () => {
      useResolutionsServer([buildResolution()]);
      const user = userEvent.setup();
      renderWithProviders(<ResolutionsPage />, { permissions: president });

      await openApproval(user);
      await user.keyboard('{Escape}');

      expect(
        screen.queryByRole('form', { name: 'Aprobar resolución RD-012/2027-FISME' }),
      ).not.toBeInTheDocument();
    });

    it('offers the approve action only on registered resolutions', async () => {
      useResolutionsServer([buildApprovedResolution({ id: 'res-9', number: 'RD-009/2027' })]);

      renderWithProviders(<ResolutionsPage />, { permissions: president });

      await screen.findByRole('table');
      expect(screen.queryByRole('button', { name: /Aprobar resolución/ })).not.toBeInTheDocument();
    });
  });
});
