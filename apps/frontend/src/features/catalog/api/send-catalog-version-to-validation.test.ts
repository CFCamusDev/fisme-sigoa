import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { buildCatalogVersion } from '@/test/catalog-fixtures';
import { sendCatalogVersionToValidation } from './send-catalog-version-to-validation';

const URL = 'http://localhost:3000/catalog-versions/cv-2/validation';

describe('sendCatalogVersionToValidation (T-015-05, CA1, CA2)', () => {
  it('posts without a body and returns the version in validation', async () => {
    let rawBody = 'not-called';
    server.use(
      http.post(URL, async ({ request }) => {
        rawBody = await request.text();
        return HttpResponse.json(
          buildCatalogVersion({ id: 'cv-2', number: 2, status: 'IN_VALIDATION' }),
        );
      }),
    );

    const result = await sendCatalogVersionToValidation('cv-2');

    expect(rawBody).toBe('');
    expect(result).toMatchObject({ id: 'cv-2', status: 'IN_VALIDATION' });
  });

  it('encodes the version id in the path', async () => {
    let path = 'not-called';
    server.use(
      http.post('http://localhost:3000/catalog-versions/:id/validation', ({ request }) => {
        path = new URL(request.url).pathname;
        return HttpResponse.json(buildCatalogVersion({ status: 'IN_VALIDATION' }));
      }),
    );

    await sendCatalogVersionToValidation('a/b c');

    expect(path).toBe('/catalog-versions/a%2Fb%20c/validation');
  });

  it('rejects a response that does not match the shared schema', async () => {
    server.use(http.post(URL, () => HttpResponse.json({ id: 'cv-2', status: 'OTHER' })));

    await expect(sendCatalogVersionToValidation('cv-2')).rejects.toThrow();
  });

  it('throws with the status and message when the server answers 409', async () => {
    server.use(
      http.post(URL, () =>
        HttpResponse.json(
          { error: { code: 'CONFLICT', message: 'Falta un atributo del graduado.' } },
          { status: 409 },
        ),
      ),
    );

    await expect(sendCatalogVersionToValidation('cv-2')).rejects.toMatchObject({
      status: 409,
      message: 'Falta un atributo del graduado.',
    });
  });
});
