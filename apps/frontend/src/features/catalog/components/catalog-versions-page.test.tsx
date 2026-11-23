import { StrictMode } from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { buildCatalogVersion, buildCatalogVersionsResponse } from '@/test/catalog-fixtures';
import { CatalogVersionsPage } from './catalog-versions-page';

const BASE = 'http://localhost:3000/catalog-versions';
const readOnly = [{ code: 'catalogo.ver', scope: 'GLOBAL' as const }];
const editor = [
  { code: 'catalogo.ver', scope: 'GLOBAL' as const },
  { code: 'catalogo.editar', scope: 'GLOBAL' as const },
];

const draftResponse = buildCatalogVersion({
  id: 'cv-2',
  number: 2,
  status: 'DRAFT',
  basedOnVersionId: 'cv-1',
  createdAt: '2026-11-12T15:00:00.000Z',
});

describe('CatalogVersionsPage Component (HU-013, T-013-23, CA1, CA2)', () => {
  it('renders the loading state while the versions are fetching', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(BASE, async () => {
        await gate;
        return HttpResponse.json(buildCatalogVersionsResponse());
      }),
    );

    renderWithProviders(<CatalogVersionsPage />, {});

    expect((await screen.findAllByText(/cargando versiones del catálogo/i)).length).toBeGreaterThan(
      0,
    );
    release();
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('shows the versions in an accessible table with status, source, counts and date', async () => {
    server.use(
      http.get(BASE, () => HttpResponse.json(buildCatalogVersionsResponse({ open: 'DRAFT' }))),
    );

    renderWithProviders(<CatalogVersionsPage />, { permissions: readOnly });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Versiones del catálogo' }),
    ).toBeInTheDocument();
    const table = await screen.findByRole('table', {
      name: /versiones del catálogo de objetivos educacionales/i,
    });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Versión', 'Estado', 'Basada en', 'OE', 'AG', 'Creada', 'Acciones']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    const [draftRow, currentRow] = rows.map((row) => within(row).getAllByRole('cell'));
    expect(draftRow?.map((cell) => cell.textContent)).toEqual([
      'V2',
      'Borrador',
      'V1',
      '4',
      '12',
      '12/11/2026',
      'Ver',
    ]);
    expect(currentRow?.map((cell) => cell.textContent)).toEqual([
      'V1',
      'Aprobada (vigente)',
      '—',
      '4',
      '12',
      '01/11/2026',
      'Ver',
    ]);
  });

  it('shows the in validation status with its label', async () => {
    server.use(
      http.get(BASE, () =>
        HttpResponse.json(buildCatalogVersionsResponse({ open: 'IN_VALIDATION' })),
      ),
    );

    renderWithProviders(<CatalogVersionsPage />, { permissions: readOnly });

    expect(await screen.findByText('En validación')).toBeInTheDocument();
  });

  it('renders the empty state, with the action only for who can edit', async () => {
    server.use(http.get(BASE, () => HttpResponse.json({ items: [] })));

    renderWithProviders(<CatalogVersionsPage />, { permissions: editor });

    expect(await screen.findByText('Aún no hay versiones del catálogo')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Nueva versión' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('hides the new version button for a user without catalogo.editar (read only)', async () => {
    server.use(http.get(BASE, () => HttpResponse.json(buildCatalogVersionsResponse())));

    renderWithProviders(<CatalogVersionsPage />, { permissions: readOnly });

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nueva versión' })).not.toBeInTheDocument();
  });

  it('renders the error state with retry and recovers', async () => {
    let calls = 0;
    server.use(
      http.get(BASE, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(
              { error: { code: 'INTERNAL_ERROR', message: 'fallo' } },
              { status: 500 },
            )
          : HttpResponse.json(buildCatalogVersionsResponse());
      }),
    );
    const user = userEvent.setup();

    renderWithProviders(<CatalogVersionsPage />, { permissions: readOnly });

    expect(await screen.findByText('Error al cargar las versiones')).toBeInTheDocument();
    expect(screen.getByText(/problema del servidor/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('shows access denied when the server answers 403', async () => {
    server.use(
      http.get(BASE, () =>
        HttpResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Sin permiso' } },
          { status: 403 },
        ),
      ),
    );

    renderWithProviders(<CatalogVersionsPage />, { permissions: readOnly });

    expect(await screen.findByText('Acceso denegado')).toBeInTheDocument();
  });

  it('creates a new version from the current one (CA1)', async () => {
    let created = false;
    server.use(
      http.get(BASE, () =>
        HttpResponse.json(buildCatalogVersionsResponse({ open: created ? 'DRAFT' : undefined })),
      ),
      http.post(BASE, () => {
        created = true;
        return HttpResponse.json(draftResponse, { status: 201 });
      }),
    );
    const user = userEvent.setup();

    renderWithProviders(<CatalogVersionsPage />, { permissions: editor });

    await user.click(await screen.findByRole('button', { name: 'Nueva versión' }));

    const message = await screen.findByText(/Se creó la versión 2 en Borrador/);
    expect(message).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(3));
    await waitFor(() => expect(message.closest('[tabindex="-1"]')).toHaveFocus());
  });

  it('disables the button and explains when an open version exists (CA2)', async () => {
    let posts = 0;
    server.use(
      http.get(BASE, () => HttpResponse.json(buildCatalogVersionsResponse({ open: 'DRAFT' }))),
      http.post(BASE, () => {
        posts += 1;
        return HttpResponse.json(draftResponse, { status: 201 });
      }),
    );
    const user = userEvent.setup();

    renderWithProviders(<CatalogVersionsPage />, { permissions: editor });

    const button = await screen.findByRole('button', { name: 'Nueva versión' });
    await waitFor(() => expect(button).toHaveAttribute('aria-disabled', 'true'));
    const help = screen.getByText(/Ya existe la versión 2 en Borrador; ciérrala o apruébala/);
    expect(button).toHaveAttribute('aria-describedby', help.id);

    await user.click(button);

    expect(posts).toBe(0);
  });

  it('explains the in validation case in the help text', async () => {
    server.use(
      http.get(BASE, () =>
        HttpResponse.json(buildCatalogVersionsResponse({ open: 'IN_VALIDATION' })),
      ),
    );

    renderWithProviders(<CatalogVersionsPage />, { permissions: editor });

    expect(
      await screen.findByText(/Ya existe la versión 2 en validación; ciérrala o apruébala/),
    ).toBeInTheDocument();
  });

  it('shows the server message and refreshes the list on a race conflict (409)', async () => {
    let lists = 0;
    server.use(
      http.get(BASE, () => {
        lists += 1;
        return HttpResponse.json(
          buildCatalogVersionsResponse({ open: lists > 1 ? 'DRAFT' : undefined }),
        );
      }),
      http.post(BASE, () =>
        HttpResponse.json(
          {
            error: {
              code: 'CONFLICT',
              message: 'Ya existe una versión del catálogo en Borrador o En validación.',
            },
          },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup();

    renderWithProviders(<CatalogVersionsPage />, { permissions: editor });

    await user.click(await screen.findByRole('button', { name: 'Nueva versión' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'Ya existe una versión del catálogo en Borrador o En validación.',
    );
    await waitFor(() => expect(lists).toBe(2));
    expect(await screen.findByText(/Ya existe la versión 2 en Borrador/)).toBeInTheDocument();
  });

  it('sends a single request on a double click', async () => {
    let posts = 0;
    server.use(
      http.get(BASE, () => HttpResponse.json(buildCatalogVersionsResponse())),
      http.post(BASE, async () => {
        posts += 1;
        await new Promise((resolve) => setTimeout(resolve, 30));
        return HttpResponse.json(draftResponse, { status: 201 });
      }),
    );
    const user = userEvent.setup();

    renderWithProviders(
      <StrictMode>
        <CatalogVersionsPage />
      </StrictMode>,
      { permissions: editor },
    );

    const button = await screen.findByRole('button', { name: 'Nueva versión' });
    await user.dblClick(button);

    expect(await screen.findByText(/Se creó la versión 2 en Borrador/)).toBeInTheDocument();
    expect(posts).toBe(1);
  });

  it('sends a single request when the button is activated twice at once', async () => {
    let posts = 0;
    server.use(
      http.get(BASE, () => HttpResponse.json(buildCatalogVersionsResponse())),
      http.post(BASE, async () => {
        posts += 1;
        await new Promise((resolve) => setTimeout(resolve, 30));
        return HttpResponse.json(draftResponse, { status: 201 });
      }),
    );

    renderWithProviders(<CatalogVersionsPage />, { permissions: editor });

    const button = await screen.findByRole('button', { name: 'Nueva versión' });
    button.click();
    button.click();

    expect(await screen.findByText(/Se creó la versión 2 en Borrador/)).toBeInTheDocument();
    expect(posts).toBe(1);
  });
});

describe('CatalogVersionsPage compare link (HU-017, T-017-11, CA1)', () => {
  it('links to the comparison screen when there are at least two versions', async () => {
    server.use(
      http.get(BASE, () => HttpResponse.json(buildCatalogVersionsResponse({ open: 'DRAFT' }))),
    );

    renderWithProviders(<CatalogVersionsPage />, { permissions: readOnly });

    const link = await screen.findByRole('link', { name: 'Comparar versiones' });
    expect(link).toHaveAttribute('href', '/catalogo/historial');
  });

  it('does not offer the comparison with a single version', async () => {
    server.use(http.get(BASE, () => HttpResponse.json(buildCatalogVersionsResponse())));

    renderWithProviders(<CatalogVersionsPage />, { permissions: readOnly });

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Comparar versiones' })).not.toBeInTheDocument();
  });
});
