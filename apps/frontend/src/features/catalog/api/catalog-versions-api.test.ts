import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { buildCatalogVersion, buildCatalogVersionsResponse } from '@/test/catalog-fixtures';
import { getCatalogVersions } from './get-catalog-versions';
import { createCatalogVersion } from './create-catalog-version';

const BASE = 'http://localhost:3000/catalog-versions';

describe('catalog versions API client (T-013-15, CA1, CA2)', () => {
  describe('getCatalogVersions', () => {
    it('returns the versions with their counts and sends no query', async () => {
      let search = 'not-called';
      server.use(
        http.get(BASE, ({ request }) => {
          search = new URL(request.url).search;
          return HttpResponse.json(buildCatalogVersionsResponse({ open: 'DRAFT' }));
        }),
      );

      const result = await getCatalogVersions();

      expect(search).toBe('');
      expect(result.items.map((item) => [item.number, item.status])).toEqual([
        [2, 'DRAFT'],
        [1, 'APPROVED'],
      ]);
      expect(result.items[1]).toMatchObject({ objectiveCount: 4, attributeCount: 12 });
    });

    it('accepts an empty list', async () => {
      server.use(http.get(BASE, () => HttpResponse.json({ items: [] })));

      expect(await getCatalogVersions()).toEqual({ items: [] });
    });

    it('rejects a response that does not match the shared schema', async () => {
      server.use(http.get(BASE, () => HttpResponse.json({ items: [{ id: 'x', number: 0 }] })));

      await expect(getCatalogVersions()).rejects.toThrow();
    });

    it('throws when the server answers 403', async () => {
      server.use(
        http.get(BASE, () =>
          HttpResponse.json(
            { error: { code: 'FORBIDDEN', message: 'Sin permiso' } },
            { status: 403 },
          ),
        ),
      );

      await expect(getCatalogVersions()).rejects.toMatchObject({ status: 403 });
    });
  });

  describe('createCatalogVersion', () => {
    it('posts without a body and returns the draft', async () => {
      let rawBody = 'not-called';
      server.use(
        http.post(BASE, async ({ request }) => {
          rawBody = await request.text();
          return HttpResponse.json(
            buildCatalogVersion({
              id: 'cv-2',
              number: 2,
              status: 'DRAFT',
              basedOnVersionId: 'cv-1',
            }),
            { status: 201 },
          );
        }),
      );

      const result = await createCatalogVersion();

      expect(rawBody).toBe('');
      expect(result).toMatchObject({ number: 2, status: 'DRAFT', basedOnVersionId: 'cv-1' });
    });

    it('rejects a response that does not match the shared schema', async () => {
      server.use(http.post(BASE, () => HttpResponse.json({ id: 'x' }, { status: 201 })));

      await expect(createCatalogVersion()).rejects.toThrow();
    });

    it('throws with the status and the server message on a 409 (CA2)', async () => {
      server.use(
        http.post(BASE, () =>
          HttpResponse.json(
            { error: { code: 'CONFLICT', message: 'Ya existe una versión abierta' } },
            { status: 409 },
          ),
        ),
      );

      await expect(createCatalogVersion()).rejects.toMatchObject({
        status: 409,
        message: 'Ya existe una versión abierta',
      });
    });
  });
});
