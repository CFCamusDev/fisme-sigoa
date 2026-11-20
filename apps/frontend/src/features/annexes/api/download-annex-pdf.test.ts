import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { ApiError } from '@/lib/api-error';
import { downloadAnnexPdf } from './download-annex-pdf';

describe('downloadAnnexPdf (T-070-06)', () => {
  it('downloads the annex pdf blob and extracts filename and template version', async () => {
    server.use(
      http.get('http://localhost:3000/annexes/FO-01/pdf', () => {
        return new HttpResponse(new Blob(['%PDF-1.4\nAnnex'], { type: 'application/pdf' }), {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="fo-01-v2.pdf"',
            'X-Template-Version': '2',
          },
        });
      }),
    );

    const result = await downloadAnnexPdf('FO-01');

    expect(result.fileName).toBe('fo-01-v2.pdf');
    expect(result.versionNumber).toBe(2);
    const size =
      result.blob instanceof Blob ? result.blob.size : Buffer.byteLength(result.blob as Uint8Array);
    expect(size).toBeGreaterThan(0);
  });

  it('converts a blob error payload into a typed ApiError', async () => {
    server.use(
      http.get('http://localhost:3000/annexes/FO-03/pdf', () => {
        return HttpResponse.json(
          { error: { code: 'NOT_FOUND', message: 'El anexo no tiene una versión publicada.' } },
          { status: 404 },
        );
      }),
    );

    await expect(downloadAnnexPdf('FO-03')).rejects.toBeInstanceOf(ApiError);
    await expect(downloadAnnexPdf('FO-03')).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
      message: 'El anexo no tiene una versión publicada.',
    });
  });
});
