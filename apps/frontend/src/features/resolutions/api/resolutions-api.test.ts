import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import {
  buildApprovedResolution,
  buildResolution,
  buildResolutionsResponse,
} from '@/test/resolution-fixtures';
import { approveResolution } from './approve-resolution';
import { getResolutions } from './get-resolutions';
import { registerResolution } from './register-resolution';

const BASE = 'http://localhost:3000/resolutions';

describe('getResolutions (T-048-13, RF-048)', () => {
  it('requests the list with the filters and parses the page', async () => {
    let search = '';
    server.use(
      http.get(BASE, ({ request }) => {
        search = new URL(request.url).search;
        return HttpResponse.json(buildResolutionsResponse([buildResolution()]));
      }),
    );

    const page = await getResolutions({ status: 'REGISTERED', page: 2, pageSize: 10 });

    expect(search).toContain('status=REGISTERED');
    expect(search).toContain('page=2');
    expect(search).toContain('pageSize=10');
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(1);
  });

  it('accepts a registered resolution with null pdf and approval data', async () => {
    server.use(
      http.get(BASE, () => HttpResponse.json(buildResolutionsResponse([buildResolution()]))),
    );

    const page = await getResolutions();

    expect(page.items[0]).toMatchObject({ pdfFileId: null, approvedAt: null, approvedBy: null });
  });

  it('rejects a response that does not match the shared schema', async () => {
    server.use(http.get(BASE, () => HttpResponse.json({ items: [{ id: 'x' }] })));

    await expect(getResolutions()).rejects.toThrow();
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

    await expect(getResolutions()).rejects.toMatchObject({ status: 403 });
  });
});

describe('registerResolution (T-048-13, CA1)', () => {
  const input = {
    type: 'EDUCATIONAL_OBJECTIVE',
    number: 'RD-012/2027-FISME',
    issuedOn: '2026-11-10',
    catalogVersionId: 'cv-2',
  } as const;

  it('posts the data as JSON and returns the registered resolution', async () => {
    let body: unknown = null;
    server.use(
      http.post(BASE, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(buildResolution(), { status: 201 });
      }),
    );

    const result = await registerResolution(input);

    expect(body).toEqual(input);
    expect(result).toMatchObject({ status: 'REGISTERED', pdfFileId: null });
  });

  it('rejects a response that does not match the shared schema', async () => {
    server.use(
      http.post(BASE, () => HttpResponse.json({ id: 'x', status: 'OTHER' }, { status: 201 })),
    );

    await expect(registerResolution(input)).rejects.toThrow();
  });

  it('throws with the status and message when the server answers 409', async () => {
    server.use(
      http.post(BASE, () =>
        HttpResponse.json(
          { error: { code: 'CONFLICT', message: 'Ya existe una resolución con ese número' } },
          { status: 409 },
        ),
      ),
    );

    await expect(registerResolution(input)).rejects.toMatchObject({
      status: 409,
      message: 'Ya existe una resolución con ese número',
    });
  });
});

describe('approveResolution (T-048-13, CA2, CA3)', () => {
  const pdf = new Blob(['%PDF-1.4\n% firmada\n'], { type: 'application/pdf' });

  it('posts the file as a binary application/pdf body', async () => {
    let contentType: string | null = null;
    let received = '';
    server.use(
      http.post(`${BASE}/res-1/approve`, async ({ request }) => {
        contentType = request.headers.get('content-type');
        received = await request.text();
        return HttpResponse.json(buildApprovedResolution());
      }),
    );

    const result = await approveResolution('res-1', pdf);

    expect(contentType).toBe('application/pdf');
    expect(received).toBe('%PDF-1.4\n% firmada\n');
    expect(result).toMatchObject({ status: 'APPROVED', pdfFileId: 'file-1' });
  });

  it('encodes the resolution id in the path', async () => {
    let path = '';
    server.use(
      http.post(`${BASE}/:id/approve`, ({ request }) => {
        path = new URL(request.url).pathname;
        return HttpResponse.json(buildApprovedResolution());
      }),
    );

    await approveResolution('a/b c', pdf);

    expect(path).toBe('/resolutions/a%2Fb%20c/approve');
  });

  it('throws with the server message when the pdf is required (400)', async () => {
    server.use(
      http.post(`${BASE}/res-1/approve`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Para aprobar la resolución debes adjuntar el PDF firmado.',
            },
          },
          { status: 400 },
        ),
      ),
    );

    await expect(approveResolution('res-1', pdf)).rejects.toMatchObject({
      status: 400,
      message: 'Para aprobar la resolución debes adjuntar el PDF firmado.',
    });
  });

  it('rejects a response that does not match the shared schema', async () => {
    server.use(http.post(`${BASE}/res-1/approve`, () => HttpResponse.json({ id: 'res-1' })));

    await expect(approveResolution('res-1', pdf)).rejects.toThrow();
  });
});
