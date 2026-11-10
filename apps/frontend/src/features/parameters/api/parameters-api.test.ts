import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import {
  buildParametersResponse,
  buildParametersResponseWithNewVersion,
} from '@/test/parameter-fixtures';
import { getParameters } from './get-parameters';
import { defineParameters } from './define-parameters';

describe('parameters API client (T-011-12, CA1, CA2, CA3)', () => {
  describe('getParameters', () => {
    it('returns the effective parameters without a query when no semester is given', async () => {
      let search = 'not-called';
      server.use(
        http.get('http://localhost:3000/parameters', ({ request }) => {
          search = new URL(request.url).search;
          return HttpResponse.json(buildParametersResponse());
        }),
      );

      const result = await getParameters();

      expect(search).toBe('');
      expect(result.items).toHaveLength(7);
    });

    it('sends the semester code as a query parameter', async () => {
      let semesterCode: string | null = null;
      server.use(
        http.get('http://localhost:3000/parameters', ({ request }) => {
          semesterCode = new URL(request.url).searchParams.get('semesterCode');
          return HttpResponse.json(buildParametersResponseWithNewVersion());
        }),
      );

      const result = await getParameters('2027-I');

      expect(semesterCode).toBe('2027-I');
      expect(result.items.find((item) => item.key === 'UMBRAL_LOGRADO')?.value).toBe(15);
    });

    it('rejects a response that does not match the shared schema', async () => {
      server.use(
        http.get('http://localhost:3000/parameters', () =>
          HttpResponse.json({ semesterCode: null, items: [{ key: 'OTRA' }] }),
        ),
      );

      await expect(getParameters()).rejects.toThrow();
    });

    it('throws when the server answers 403', async () => {
      server.use(
        http.get('http://localhost:3000/parameters', () =>
          HttpResponse.json(
            { error: { code: 'FORBIDDEN', message: 'Sin permiso' } },
            { status: 403 },
          ),
        ),
      );

      await expect(getParameters()).rejects.toThrow();
    });
  });

  describe('defineParameters', () => {
    it('posts the validated body and returns the parsed view', async () => {
      let received: unknown = null;
      server.use(
        http.post('http://localhost:3000/parameters', async ({ request }) => {
          received = await request.json();
          return HttpResponse.json(buildParametersResponseWithNewVersion(), { status: 201 });
        }),
      );

      const result = await defineParameters({
        semesterCode: '2027-I',
        values: [{ key: 'UMBRAL_LOGRADO', value: 15 }],
      });

      expect(received).toEqual({
        semesterCode: '2027-I',
        values: [{ key: 'UMBRAL_LOGRADO', value: 15 }],
      });
      expect(result.semesterCode).toBe('2027-I');
    });

    it('rejects weights that do not add up to 100 before calling the server (CA3)', async () => {
      let called = false;
      server.use(
        http.post('http://localhost:3000/parameters', () => {
          called = true;
          return HttpResponse.json(buildParametersResponse(), { status: 201 });
        }),
      );

      await expect(
        defineParameters({
          semesterCode: '2027-I',
          values: [
            { key: 'PESO_DIRECTA', value: 70 },
            { key: 'PESO_INDIRECTA', value: 40 },
          ],
        }),
      ).rejects.toThrow();
      expect(called).toBe(false);
    });

    it('throws when the server answers 409', async () => {
      server.use(
        http.post('http://localhost:3000/parameters', () =>
          HttpResponse.json({ error: { code: 'CONFLICT', message: 'Conflicto' } }, { status: 409 }),
        ),
      );

      await expect(
        defineParameters({ semesterCode: '2027-I', values: [{ key: 'META_AG', value: 80 }] }),
      ).rejects.toThrow();
    });
  });
});
