import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import {
  DRAFT_UPDATED_AT,
  buildDraftVersionSummary,
  buildTemplateDetail,
  buildTemplateSummary,
  buildTemplateVersion,
  buildTemplatesResponse,
} from '@/test/template-fixtures';
import { getTemplate } from './get-template';
import { getTemplates } from './get-templates';
import { previewTemplate } from './preview-template';
import { publishTemplate } from './publish-template';
import { saveTemplateDraft } from './save-template-draft';

const BASE = 'http://localhost:3000/templates';

describe('getTemplates (T-018-18, RF-018)', () => {
  it('requests the list with the filters and parses the page', async () => {
    let search = '';
    server.use(
      http.get(BASE, ({ request }) => {
        search = new URL(request.url).search;
        return HttpResponse.json(buildTemplatesResponse([buildTemplateSummary()]));
      }),
    );

    const page = await getTemplates({ type: 'SURVEY', page: 2, pageSize: 10 });

    expect(search).toContain('type=SURVEY');
    expect(search).toContain('page=2');
    expect(search).toContain('pageSize=10');
    expect(page.items).toHaveLength(1);
  });

  it('accepts a template without published version and with a draft (incomplete but valid)', async () => {
    server.use(
      http.get(BASE, () =>
        HttpResponse.json(
          buildTemplatesResponse([
            buildTemplateSummary({ published: null, draft: buildDraftVersionSummary() }),
          ]),
        ),
      ),
    );

    const page = await getTemplates();

    expect(page.items[0]).toMatchObject({
      published: null,
      draft: { number: 2, publishedAt: null },
    });
  });

  it('rejects a response that does not match the shared schema', async () => {
    server.use(http.get(BASE, () => HttpResponse.json({ items: [{ id: 'x' }] })));

    await expect(getTemplates()).rejects.toThrow();
  });

  it('throws with the status when the server answers 403', async () => {
    server.use(
      http.get(BASE, () =>
        HttpResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Sin permiso' } },
          { status: 403 },
        ),
      ),
    );

    await expect(getTemplates()).rejects.toMatchObject({ status: 403 });
  });
});

describe('getTemplate (T-018-18, RF-018)', () => {
  it('parses the detail with its history and contents', async () => {
    server.use(
      http.get(`${BASE}/tpl-1`, () => HttpResponse.json(buildTemplateDetail({ withDraft: true }))),
    );

    const detail = await getTemplate('tpl-1');

    expect(detail.versions.map((version) => version.number)).toEqual([2, 1]);
    expect(detail.draft?.content).toContain('borrador');
    expect(detail.published?.number).toBe(1);
  });

  it('encodes the id in the path and throws with the status on 404', async () => {
    let path = '';
    server.use(
      http.get(`${BASE}/:id`, ({ request }) => {
        path = new URL(request.url).pathname;
        return HttpResponse.json(
          { error: { code: 'NOT_FOUND', message: 'No existe' } },
          { status: 404 },
        );
      }),
    );

    await expect(getTemplate('a/b')).rejects.toMatchObject({ status: 404 });
    expect(path).toBe('/templates/a%2Fb');
  });
});

describe('saveTemplateDraft (T-018-18, RF-018)', () => {
  it('puts the content and parses the draft', async () => {
    let body: unknown;
    server.use(
      http.put(`${BASE}/tpl-1/draft`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(buildTemplateVersion({ content: '<p>nuevo</p>' }), {
          status: 201,
        });
      }),
    );

    const draft = await saveTemplateDraft('tpl-1', { content: '<p>nuevo</p>' });

    expect(body).toEqual({ content: '<p>nuevo</p>' });
    expect(draft).toMatchObject({ status: 'DRAFT', publishedAt: null, content: '<p>nuevo</p>' });
  });

  it('throws with the server message on 400', async () => {
    server.use(
      http.put(`${BASE}/tpl-1/draft`, () =>
        HttpResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Etiqueta no permitida' } },
          { status: 400 },
        ),
      ),
    );

    await expect(
      saveTemplateDraft('tpl-1', { content: '<script></script>' }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Etiqueta no permitida',
    });
  });
});

describe('publishTemplate (T-018-18, RF-018, CA2)', () => {
  it('posts the version and the expected update time and parses the published version', async () => {
    let body: unknown;
    server.use(
      http.post(`${BASE}/tpl-1/publish`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          buildTemplateVersion({
            status: 'PUBLISHED',
            publishedAt: '2026-11-14T09:00:00.000Z',
          }),
        );
      }),
    );

    const published = await publishTemplate('tpl-1', {
      versionId: 'ver-2',
      expectedUpdatedAt: DRAFT_UPDATED_AT,
    });

    expect(body).toEqual({ versionId: 'ver-2', expectedUpdatedAt: DRAFT_UPDATED_AT });
    expect(published).toMatchObject({ status: 'PUBLISHED', number: 2 });
  });

  it('throws with the status on 409', async () => {
    server.use(
      http.post(`${BASE}/tpl-1/publish`, () =>
        HttpResponse.json({ error: { code: 'CONFLICT', message: 'Cambió' } }, { status: 409 }),
      ),
    );

    await expect(
      publishTemplate('tpl-1', { versionId: 'ver-2', expectedUpdatedAt: DRAFT_UPDATED_AT }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('previewTemplate (T-019-06, RF-019)', () => {
  it('posts content and parses the pdf base64 and warnings', async () => {
    let body: unknown;
    server.use(
      http.post(`${BASE}/tpl-1/preview`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          pdfBase64: 'JVBERi0xLjQK',
          warnings: [{ variable: 'unknown.key' }],
        });
      }),
    );

    const preview = await previewTemplate('tpl-1', { content: '<p>{{unknown.key}}</p>' });

    expect(body).toEqual({ content: '<p>{{unknown.key}}</p>' });
    expect(preview).toEqual({
      pdfBase64: 'JVBERi0xLjQK',
      warnings: [{ variable: 'unknown.key' }],
    });
  });

  it('rejects a response that does not match the preview schema', async () => {
    server.use(
      http.post(`${BASE}/tpl-1/preview`, () => HttpResponse.json({ pdfBase64: '', warnings: [] })),
    );

    await expect(previewTemplate('tpl-1', { content: '<p>ok</p>' })).rejects.toThrow();
  });
});
