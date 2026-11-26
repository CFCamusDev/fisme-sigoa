import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { buildTemplateSummary, buildTemplatesResponse } from '@/test/template-fixtures';
import { TemplatesPage } from './templates-page';

const BASE = 'http://localhost:3000/templates';
const viewer = [{ code: 'plantilla.ver', scope: 'GLOBAL' as const }];

describe('TemplatesPage (HU-082, T-082-23)', () => {
  it('shows the loading state and then the templates with their versions and open links', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tpl1 = buildTemplateSummary({
      id: 'tpl-1',
      code: 'FO-01',
      name: 'Acta de sesión',
      type: 'MINUTES',
    });
    const tpl2 = buildTemplateSummary({
      id: 'tpl-2',
      code: 'ANX-01',
      name: 'Cronograma de actividades',
      type: 'ANNEX',
    });

    server.use(
      http.get(BASE, async () => {
        await gate;
        return HttpResponse.json(buildTemplatesResponse([tpl1, tpl2]));
      }),
    );

    renderWithProviders(<TemplatesPage />, { permissions: viewer });

    expect((await screen.findAllByText(/cargando plantillas/i)).length).toBeGreaterThan(0);
    release();

    const openLink = await screen.findByRole('link', { name: 'Abrir FO-01' });
    expect(openLink).toHaveAttribute('href', '/plantillas/tpl-1');
    expect(screen.getByRole('link', { name: 'Abrir ANX-01' })).toHaveAttribute(
      'href',
      '/plantillas/tpl-2',
    );
  });

  it('filters by type and by text', async () => {
    const user = userEvent.setup();
    const listParams: string[] = [];
    const tpl1 = buildTemplateSummary({
      id: 'tpl-1',
      code: 'FO-01',
      name: 'Acta de sesión',
      type: 'MINUTES',
    });
    const tpl2 = buildTemplateSummary({
      id: 'tpl-2',
      code: 'ANX-01',
      name: 'Cronograma de actividades',
      type: 'ANNEX',
    });

    server.use(
      http.get(BASE, ({ request }) => {
        const search = new URL(request.url).search;
        listParams.push(search);
        const typeParam = new URL(request.url).searchParams.get('type');
        const items = typeParam === 'ANNEX' ? [tpl2] : [tpl1, tpl2];
        return HttpResponse.json(buildTemplatesResponse(items));
      }),
    );

    renderWithProviders(<TemplatesPage />, { permissions: viewer });

    expect(await screen.findByText('FO-01')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Buscar plantilla'), 'sesión');
    expect(screen.getByText('FO-01')).toBeInTheDocument();
    expect(screen.queryByText('ANX-01')).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText('Buscar plantilla'));
    await user.selectOptions(screen.getByLabelText('Tipo de plantilla'), 'ANNEX');

    await waitFor(() => {
      expect(screen.getByText('ANX-01')).toBeInTheDocument();
    });
    expect(screen.queryByText('FO-01')).not.toBeInTheDocument();
    expect(listParams.some((q) => q.includes('type=ANNEX'))).toBe(true);
  });

  it('shows empty state on search without matches and error state with retry', async () => {
    const user = userEvent.setup();
    let calls = 0;

    server.use(
      http.get(BASE, () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json(
            { error: { code: 'INTERNAL_ERROR', message: 'Fallo temporal' } },
            { status: 500 },
          );
        }
        return HttpResponse.json(buildTemplatesResponse([buildTemplateSummary()]));
      }),
    );

    renderWithProviders(<TemplatesPage />, { permissions: viewer });

    expect(await screen.findByText('Error al cargar las plantillas')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Reintentar/i }));

    expect(await screen.findByText('FO-01')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Buscar plantilla'), 'inexistente');
    expect(screen.getByText('Ninguna plantilla coincide con “inexistente”')).toBeInTheDocument();
  });
});
