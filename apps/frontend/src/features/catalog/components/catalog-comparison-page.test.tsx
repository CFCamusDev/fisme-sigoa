import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { buildCatalogComparison, buildCatalogVersion } from '@/test/catalog-fixtures';
import { CatalogComparisonPage } from './catalog-comparison-page';

const BASE = 'http://localhost:3000/catalog-versions';
const readOnly = [{ code: 'catalogo.ver', scope: 'GLOBAL' as const }];

const historical = buildCatalogVersion({ id: 'cv-1', number: 1, status: 'HISTORICAL' });
const current = buildCatalogVersion({
  id: 'cv-2',
  number: 2,
  status: 'APPROVED',
  basedOnVersionId: 'cv-1',
});

function mockVersions(items = [current, historical]) {
  server.use(http.get(BASE, () => HttpResponse.json({ items })));
}

function renderPage(
  selection: { base?: string; target?: string } = {},
  onSelectionChange: (selection: { base: string; target: string }) => void = () => undefined,
) {
  return renderWithProviders(
    <CatalogComparisonPage selection={selection} onSelectionChange={onSelectionChange} />,
    { permissions: readOnly },
  );
}

describe('CatalogComparisonPage Component (HU-017, T-017-11, CA1, CA2, RNF-036)', () => {
  it('compares the previous version with the current one by default', async () => {
    let requested = '';
    mockVersions();
    server.use(
      http.get(`${BASE}/:baseId/compare/:targetId`, ({ params }) => {
        requested = `${String(params['baseId'])}/${String(params['targetId'])}`;
        return HttpResponse.json(buildCatalogComparison());
      }),
    );

    renderPage();

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Resumen de cambios' }),
    ).toBeInTheDocument();
    expect(requested).toBe('cv-1/cv-2');
    expect(screen.getByLabelText('Versión base')).toHaveValue('cv-1');
    expect(screen.getByLabelText('Versión destino')).toHaveValue('cv-2');
  });

  it('highlights added and removed words of a modified item', async () => {
    mockVersions();
    server.use(
      http.get(`${BASE}/cv-1/compare/cv-2`, () => HttpResponse.json(buildCatalogComparison())),
    );

    renderPage({ base: 'cv-1', target: 'cv-2' });

    const removed = await screen.findByText('éticos.', { selector: 'del' });
    const added = screen.getByText('líderes.', { selector: 'ins' });
    expect(removed).toHaveClass('line-through');
    expect(added).toHaveClass('underline');
    expect(within(removed).getByText(/\[quitado:/)).toHaveClass('sr-only');
    expect(within(added).getByText(/\[agregado:/)).toHaveClass('sr-only');
  });

  it('labels every change with an icon and text, not only color', async () => {
    mockVersions();
    server.use(
      http.get(`${BASE}/cv-1/compare/cv-2`, () => HttpResponse.json(buildCatalogComparison())),
    );

    renderPage({ base: 'cv-1', target: 'cv-2' });

    const objectives = await screen.findByRole('region', { name: 'Objetivos educacionales' });
    expect(within(objectives).getByText('OEP1')).toBeInTheDocument();
    for (const label of ['Modificado', 'Agregado', 'Quitado']) {
      expect(within(objectives).getByText(label)).toBeInTheDocument();
    }
    const summary = screen.getByRole('region', { name: 'Resumen de cambios' });
    expect(within(summary).getAllByRole('listitem')).toHaveLength(4);
  });

  it('hides unchanged items until asked to show them', async () => {
    const user = userEvent.setup();
    mockVersions();
    server.use(
      http.get(`${BASE}/cv-1/compare/cv-2`, () => HttpResponse.json(buildCatalogComparison())),
    );

    renderPage({ base: 'cv-1', target: 'cv-2' });

    await screen.findByText('éticos.', { selector: 'del' });
    expect(screen.queryByText('OEP2')).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('checkbox', { name: /mostrar también los elementos sin cambios/i }),
    );

    expect(screen.getByText('OEP2')).toBeInTheDocument();
  });

  it('shows the resolution of a historical version and flags a version without resolution', async () => {
    mockVersions();
    server.use(
      http.get(`${BASE}/cv-1/compare/cv-2`, () => HttpResponse.json(buildCatalogComparison())),
    );

    renderPage({ base: 'cv-1', target: 'cv-2' });

    const base = await screen.findByRole('region', { name: 'Versión base V1' });
    expect(within(base).getByText('Resolución N.° 128-2024')).toBeInTheDocument();
    expect(within(base).getByText('01/03/2024')).toBeInTheDocument();
    expect(within(base).getByText('10/05/2026')).toBeInTheDocument();
    const target = screen.getByRole('region', { name: 'Versión destino V2' });
    expect(within(target).getByText('Sin resolución registrada')).toBeInTheDocument();
  });

  it('asks for two different versions and sends no request when both are the same', async () => {
    let calls = 0;
    mockVersions();
    server.use(
      http.get(`${BASE}/:baseId/compare/:targetId`, () => {
        calls += 1;
        return HttpResponse.json(buildCatalogComparison());
      }),
    );

    renderPage({ base: 'cv-2', target: 'cv-2' });

    expect(await screen.findByText(/elige dos versiones distintas/i)).toBeInTheDocument();
    expect(calls).toBe(0);
  });

  it('reports the new selection when a version is chosen with the keyboard', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    mockVersions();
    server.use(
      http.get(`${BASE}/cv-1/compare/cv-2`, () => HttpResponse.json(buildCatalogComparison())),
    );

    renderPage({ base: 'cv-1', target: 'cv-2' }, onSelectionChange);

    const baseSelect = await screen.findByLabelText('Versión base');
    baseSelect.focus();
    expect(baseSelect).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Versión destino')).toHaveFocus();

    await user.selectOptions(baseSelect, 'cv-2');

    expect(onSelectionChange).toHaveBeenCalledWith({ base: 'cv-2', target: 'cv-2' });
  });

  it('shows the loading state while the versions are fetching', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(BASE, async () => {
        await gate;
        return HttpResponse.json({ items: [current, historical] });
      }),
    );

    renderPage();

    expect((await screen.findAllByText(/cargando versiones del catálogo/i)).length).toBeGreaterThan(
      0,
    );
    release();
    expect(await screen.findByLabelText('Versión base')).toBeInTheDocument();
  });

  it('shows the empty state when there are fewer than two versions', async () => {
    mockVersions([current]);

    renderPage();

    expect(await screen.findByText('Aún no hay versiones para comparar')).toBeInTheDocument();
    expect(screen.queryByLabelText('Versión base')).not.toBeInTheDocument();
  });

  it('shows an error with retry when the versions cannot be loaded', async () => {
    server.use(
      http.get(BASE, () =>
        HttpResponse.json({ error: { code: 'INTERNAL', message: 'Falla' } }, { status: 500 }),
      ),
    );

    renderPage();

    expect(await screen.findByText('Error al cargar las versiones')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
  });

  it('shows access denied when the comparison answers 403', async () => {
    mockVersions();
    server.use(
      http.get(`${BASE}/cv-1/compare/cv-2`, () =>
        HttpResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Sin permiso' } },
          { status: 403 },
        ),
      ),
    );

    renderPage({ base: 'cv-1', target: 'cv-2' });

    expect(await screen.findByText('Acceso denegado')).toBeInTheDocument();
  });

  it('shows a not found message when a version no longer exists', async () => {
    mockVersions();
    server.use(
      http.get(`${BASE}/cv-1/compare/cv-2`, () =>
        HttpResponse.json({ error: { code: 'NOT_FOUND', message: 'No existe' } }, { status: 404 }),
      ),
    );

    renderPage({ base: 'cv-1', target: 'cv-2' });

    expect(await screen.findByText('Versión no encontrada')).toBeInTheDocument();
  });
});
