import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import {
  buildCatalogAttribute,
  buildCatalogObjective,
  buildCatalogVersionDetail,
} from '@/test/catalog-fixtures';
import { getCatalogVersionDetail } from './get-catalog-version-detail';
import { reorderCatalogItems } from './reorder-catalog-items';
import { saveCatalogAttribute } from './save-catalog-attribute';
import { saveCatalogObjective } from './save-catalog-objective';

const BASE = 'http://localhost:3000/catalog-versions';

describe('catalog item API client (T-014-09, CA1, CA2, CA3)', () => {
  describe('getCatalogVersionDetail', () => {
    it('returns the version with its objectives and attributes', async () => {
      server.use(http.get(`${BASE}/cv-2`, () => HttpResponse.json(buildCatalogVersionDetail())));

      const result = await getCatalogVersionDetail('cv-2');

      expect(result.version).toMatchObject({ id: 'cv-2', status: 'DRAFT' });
      expect(result.objectives.map((item) => item.code)).toEqual(['OEP1', 'OEP2', 'OEP3']);
      expect(result.attributes).toHaveLength(3);
    });

    it('encodes the version id in the path', async () => {
      let pathname = '';
      server.use(
        http.get(`${BASE}/:id`, ({ request }) => {
          pathname = new URL(request.url).pathname;
          return HttpResponse.json(buildCatalogVersionDetail());
        }),
      );

      await getCatalogVersionDetail('a/b');

      expect(pathname).toBe('/catalog-versions/a%2Fb');
    });

    it('rejects a response that does not match the shared schema', async () => {
      server.use(http.get(`${BASE}/cv-2`, () => HttpResponse.json({ version: {} })));

      await expect(getCatalogVersionDetail('cv-2')).rejects.toThrow();
    });

    it('throws with the status on a 404', async () => {
      server.use(
        http.get(`${BASE}/cv-9`, () =>
          HttpResponse.json(
            { error: { code: 'NOT_FOUND', message: 'Versión no encontrada' } },
            { status: 404 },
          ),
        ),
      );

      await expect(getCatalogVersionDetail('cv-9')).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('saveCatalogObjective', () => {
    it('puts the SAVE operation and returns the full list', async () => {
      let body: unknown;
      server.use(
        http.put(`${BASE}/cv-2/objectives`, async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({ items: [buildCatalogObjective(1), buildCatalogObjective(2)] });
        }),
      );

      const result = await saveCatalogObjective('cv-2', {
        id: 'oe-2',
        code: 'OEP2',
        statement: 'Nuevo texto.',
      });

      expect(body).toEqual({
        operation: 'SAVE',
        id: 'oe-2',
        code: 'OEP2',
        statement: 'Nuevo texto.',
      });
      expect(result.items).toHaveLength(2);
    });

    it('throws with the server message on a duplicated code (409, CA2)', async () => {
      server.use(
        http.put(`${BASE}/cv-2/objectives`, () =>
          HttpResponse.json(
            { error: { code: 'CONFLICT', message: 'Ya existe un elemento con ese código' } },
            { status: 409 },
          ),
        ),
      );

      await expect(
        saveCatalogObjective('cv-2', { code: 'OEP1', statement: 'x' }),
      ).rejects.toMatchObject({ status: 409, message: 'Ya existe un elemento con ese código' });
    });

    it('rejects a response with a malformed list', async () => {
      server.use(
        http.put(`${BASE}/cv-2/objectives`, () => HttpResponse.json({ items: [{ id: 'x' }] })),
      );

      await expect(
        saveCatalogObjective('cv-2', { code: 'OEP1', statement: 'x' }),
      ).rejects.toThrow();
    });
  });

  describe('saveCatalogAttribute', () => {
    it('puts the SAVE operation with the name', async () => {
      let body: unknown;
      server.use(
        http.put(`${BASE}/cv-2/attributes`, async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({ items: [buildCatalogAttribute(1)] });
        }),
      );

      const result = await saveCatalogAttribute('cv-2', {
        code: 'AG-C01',
        name: 'Atributo 1',
        statement: 'Texto.',
      });

      expect(body).toEqual({
        operation: 'SAVE',
        code: 'AG-C01',
        name: 'Atributo 1',
        statement: 'Texto.',
      });
      expect(result.items[0]).toMatchObject({ code: 'AG-C01' });
    });

    it('throws with the status on a version that is not a draft (409, CA3)', async () => {
      server.use(
        http.put(`${BASE}/cv-1/attributes`, () =>
          HttpResponse.json(
            { error: { code: 'CONFLICT', message: 'Esta versión está bloqueada' } },
            { status: 409 },
          ),
        ),
      );

      await expect(
        saveCatalogAttribute('cv-1', { code: 'AG-C01', name: 'N', statement: 'x' }),
      ).rejects.toMatchObject({ status: 409 });
    });
  });

  describe('reorderCatalogItems', () => {
    it('puts the REORDER operation for objectives', async () => {
      let body: unknown;
      server.use(
        http.put(`${BASE}/cv-2/objectives`, async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({ items: [buildCatalogObjective(1)] });
        }),
      );

      await reorderCatalogItems('OBJECTIVES', 'cv-2', ['oe-2', 'oe-1']);

      expect(body).toEqual({ operation: 'REORDER', orderedIds: ['oe-2', 'oe-1'] });
    });

    it('puts the REORDER operation for attributes and parses attributes', async () => {
      let pathname = '';
      server.use(
        http.put(`${BASE}/cv-2/attributes`, ({ request }) => {
          pathname = new URL(request.url).pathname;
          return HttpResponse.json({ items: [buildCatalogAttribute(1)] });
        }),
      );

      const result = await reorderCatalogItems('ATTRIBUTES', 'cv-2', ['ag-1']);

      expect(pathname).toBe('/catalog-versions/cv-2/attributes');
      expect(result.items[0]).toMatchObject({ name: 'Atributo 1' });
    });

    it('throws with the status on an outdated list (409)', async () => {
      server.use(
        http.put(`${BASE}/cv-2/objectives`, () =>
          HttpResponse.json(
            { error: { code: 'CONFLICT', message: 'La lista cambió' } },
            { status: 409 },
          ),
        ),
      );

      await expect(reorderCatalogItems('OBJECTIVES', 'cv-2', ['x'])).rejects.toMatchObject({
        status: 409,
      });
    });
  });
});
