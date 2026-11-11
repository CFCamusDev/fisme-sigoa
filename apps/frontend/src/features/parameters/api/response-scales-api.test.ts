import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import {
  buildEvidenceScale,
  buildLikertScale,
  buildResponseScalesResponse,
} from '@/test/response-scale-fixtures';
import { getResponseScales } from './get-response-scales';
import { createResponseScale } from './create-response-scale';
import { updateResponseScale } from './update-response-scale';
import { duplicateResponseScale } from './duplicate-response-scale';

const BASE = 'http://localhost:3000/response-scales';

const levels = [
  { label: 'Bajo', value: 1, countsAsAchievement: false },
  { label: 'Alto', value: 2, countsAsAchievement: true },
];

describe('response scales API client (T-012-16, CA1, CA2, CA3)', () => {
  describe('getResponseScales', () => {
    it('returns the three scales with their levels and sends no query by default', async () => {
      let search = 'not-called';
      server.use(
        http.get(BASE, ({ request }) => {
          search = new URL(request.url).search;
          return HttpResponse.json(buildResponseScalesResponse());
        }),
      );

      const result = await getResponseScales();

      expect(search).toBe('');
      expect(result.items.map((item) => item.code)).toEqual([
        'LIKERT_5',
        'NUMERIC_1_5',
        'EVIDENCE_4',
      ]);
      expect(result.items[2]?.levels.filter((l) => l.countsAsAchievement)).toHaveLength(2);
    });

    it('sends the type filter as a query parameter', async () => {
      let type: string | null = null;
      server.use(
        http.get(BASE, ({ request }) => {
          type = new URL(request.url).searchParams.get('type');
          return HttpResponse.json(buildResponseScalesResponse([buildEvidenceScale()]));
        }),
      );

      await getResponseScales('EVIDENCE');

      expect(type).toBe('EVIDENCE');
    });

    it('rejects a response that does not match the shared schema', async () => {
      server.use(http.get(BASE, () => HttpResponse.json({ items: [{ id: 'x', code: 'lower' }] })));

      await expect(getResponseScales()).rejects.toThrow();
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

      await expect(getResponseScales()).rejects.toMatchObject({ status: 403 });
    });
  });

  describe('createResponseScale', () => {
    it('posts the validated body and parses the created scale', async () => {
      let sent: unknown;
      server.use(
        http.post(BASE, async ({ request }) => {
          sent = await request.json();
          return HttpResponse.json(buildLikertScale({ code: 'NUEVA' }), { status: 201 });
        }),
      );

      const result = await createResponseScale({
        code: 'NUEVA',
        name: 'Nueva',
        type: 'LIKERT',
        levels,
      });

      expect(sent).toEqual({ code: 'NUEVA', name: 'Nueva', type: 'LIKERT', levels });
      expect(result.code).toBe('NUEVA');
    });

    it('does not call the server when the body breaks the shared schema', async () => {
      let calls = 0;
      server.use(
        http.post(BASE, () => {
          calls += 1;
          return HttpResponse.json(buildLikertScale(), { status: 201 });
        }),
      );

      await expect(
        createResponseScale({ code: 'nueva', name: 'Nueva', type: 'LIKERT', levels }),
      ).rejects.toThrow();
      expect(calls).toBe(0);
    });
  });

  describe('updateResponseScale', () => {
    it('patches the scale by id with only the sent fields', async () => {
      let sent: unknown;
      let path = '';
      server.use(
        http.patch(`${BASE}/:id`, async ({ request }) => {
          sent = await request.json();
          path = new URL(request.url).pathname;
          return HttpResponse.json(buildLikertScale({ name: 'Renombrada' }));
        }),
      );

      const result = await updateResponseScale('scale-likert', { name: 'Renombrada' });

      expect(sent).toEqual({ name: 'Renombrada' });
      expect(path).toBe('/response-scales/scale-likert');
      expect(result.name).toBe('Renombrada');
    });

    it('rejects an empty change without calling the server', async () => {
      let calls = 0;
      server.use(
        http.patch(`${BASE}/:id`, () => {
          calls += 1;
          return HttpResponse.json(buildLikertScale());
        }),
      );

      await expect(updateResponseScale('scale-likert', {})).rejects.toThrow();
      expect(calls).toBe(0);
    });

    it('exposes the 409 of an in-use scale', async () => {
      server.use(
        http.patch(`${BASE}/:id`, () =>
          HttpResponse.json(
            { error: { code: 'CONFLICT', message: 'La escala está en uso. Duplícala' } },
            { status: 409 },
          ),
        ),
      );

      await expect(updateResponseScale('scale-evidence', { name: 'X' })).rejects.toMatchObject({
        status: 409,
      });
    });
  });

  describe('duplicateResponseScale', () => {
    it('posts the new code and name to the duplicate path', async () => {
      let sent: unknown;
      let path = '';
      server.use(
        http.post(`${BASE}/:id/duplicate`, async ({ request }) => {
          sent = await request.json();
          path = new URL(request.url).pathname;
          return HttpResponse.json(buildEvidenceScale({ code: 'EVIDENCE_4_V2' }), { status: 201 });
        }),
      );

      const result = await duplicateResponseScale('scale-evidence', {
        code: 'EVIDENCE_4_V2',
        name: 'Copia',
      });

      expect(sent).toEqual({ code: 'EVIDENCE_4_V2', name: 'Copia' });
      expect(path).toBe('/response-scales/scale-evidence/duplicate');
      expect(result.code).toBe('EVIDENCE_4_V2');
    });

    it('rejects an invalid code without calling the server', async () => {
      await expect(
        duplicateResponseScale('scale-evidence', { code: 'minuscula', name: 'Copia' }),
      ).rejects.toThrow();
    });
  });
});
