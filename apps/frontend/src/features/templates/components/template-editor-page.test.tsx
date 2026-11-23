import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { buildTemplateDetail } from '@/test/template-fixtures';
import { TemplateEditorPage } from './template-editor-page';

const BASE = 'http://localhost:3000/templates/tpl-1';

const administrator = [
  { code: 'plantilla.ver', scope: 'GLOBAL' as const },
  { code: 'plantilla.editar', scope: 'GLOBAL' as const },
  { code: 'plantilla.publicar', scope: 'GLOBAL' as const },
];

const readOnlyUser = [{ code: 'plantilla.ver', scope: 'GLOBAL' as const }];

describe('TemplateEditorPage (HU-082, T-082-24)', () => {
  it('renders header, tabs and preserves unsaved content across tab switches', async () => {
    const user = userEvent.setup();
    server.use(http.get(BASE, () => HttpResponse.json(buildTemplateDetail({ withDraft: true }))));

    renderWithProviders(<TemplateEditorPage templateId="tpl-1" />, {
      permissions: administrator,
      initialPath: '/plantillas/tpl-1',
    });

    expect(
      await screen.findByRole('heading', { level: 1, name: /FO-01 · Acta de reunión/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a plantillas' })).toHaveAttribute(
      'href',
      '/plantillas',
    );

    expect(screen.getByRole('tab', { name: 'Contenido' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Variables' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Vista previa' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Historial' })).toBeInTheDocument();

    const textarea = screen.getByRole('textbox', { name: 'Contenido HTML' });
    await user.type(textarea, ' borrador');

    await user.click(screen.getByRole('tab', { name: 'Historial' }));
    expect(screen.getByRole('heading', { name: 'Historial de versiones' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Variables' }));
    await user.click(screen.getByRole('button', { name: 'Insertar {{program.name}}' }));

    expect(screen.getByRole('tab', { name: 'Contenido' })).toHaveAttribute('aria-selected', 'true');
    expect(
      (screen.getByRole('textbox', { name: 'Contenido HTML' }) as HTMLTextAreaElement).value,
    ).toContain('borrador{{program.name}}');
  });

  it('hides the preview tab when user only has view permission', async () => {
    server.use(http.get(BASE, () => HttpResponse.json(buildTemplateDetail({ withDraft: true }))));

    renderWithProviders(<TemplateEditorPage templateId="tpl-1" />, {
      permissions: readOnlyUser,
      initialPath: '/plantillas/tpl-1',
    });

    await screen.findByRole('heading', { level: 1, name: /FO-01 · Acta de reunión/ });
    expect(screen.queryByRole('tab', { name: 'Vista previa' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Contenido HTML' })).toHaveAttribute('readonly');
  });

  it('shows not found state on 404', async () => {
    server.use(
      http.get(BASE, () =>
        HttpResponse.json(
          { statusCode: 404, error: 'Not Found', message: 'Plantilla no encontrada' },
          { status: 404 },
        ),
      ),
    );

    renderWithProviders(<TemplateEditorPage templateId="tpl-1" />, {
      permissions: administrator,
      initialPath: '/plantillas/tpl-1',
    });

    expect(await screen.findByText('Plantilla no encontrada')).toBeInTheDocument();
  });

  it('prompts confirmation before leaving with unsaved changes', async () => {
    const user = userEvent.setup();
    server.use(http.get(BASE, () => HttpResponse.json(buildTemplateDetail({ withDraft: true }))));

    renderWithProviders(<TemplateEditorPage templateId="tpl-1" />, {
      permissions: administrator,
      initialPath: '/plantillas/tpl-1',
    });

    const textarea = await screen.findByRole('textbox', { name: 'Contenido HTML' });
    await user.type(textarea, ' cambio');

    await user.click(screen.getByRole('link', { name: 'Volver a plantillas' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Cambios sin guardar')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Seguir editando' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
