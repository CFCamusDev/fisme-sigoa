import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import type { SemesterDto, ListSemestersResponse } from '@sigoa/shared';
import { getSemesters } from './get-semesters';
import { createSemester } from './create-semester';

const mockSemester: SemesterDto = {
  id: 'cm3semcuid202710000000',
  code: '2027-I',
  startDate: '2027-03-01',
  endDate: '2027-07-31',
  updatedAt: '2026-11-09T10:00:00.000Z',
};

const mockListResponse: ListSemestersResponse = {
  items: [mockSemester],
};

describe('semesters API client (T-010-10, CA1, CA2, CA3)', () => {
  describe('getSemesters', () => {
    it('returns semesters list when response is 200 OK', async () => {
      server.use(
        http.get('http://localhost:3000/semesters', () => {
          return HttpResponse.json(mockListResponse);
        }),
      );

      const result = await getSemesters();
      expect(result).toEqual(mockListResponse);
    });

    it('throws ApiError when server responds with 403 Forbidden', async () => {
      server.use(
        http.get('http://localhost:3000/semesters', () => {
          return HttpResponse.json(
            {
              error: {
                code: 'FORBIDDEN',
                message: 'No tienes permiso para ver parámetros',
              },
            },
            { status: 403 },
          );
        }),
      );

      await expect(getSemesters()).rejects.toThrow();
    });
  });

  describe('createSemester', () => {
    it('creates a semester and returns SemesterDto when response is 201 Created', async () => {
      server.use(
        http.post('http://localhost:3000/semesters', () => {
          return HttpResponse.json(mockSemester, { status: 201 });
        }),
      );

      const result = await createSemester({
        code: '2027-I',
        startDate: '2027-03-01',
        endDate: '2027-07-31',
      });

      expect(result).toEqual(mockSemester);
    });

    it('throws validation error when request body fails client schema validation (CA3)', async () => {
      await expect(
        createSemester({
          code: 'INVALID-CODE',
          startDate: '2027-03-01',
          endDate: '2027-07-31',
        }),
      ).rejects.toThrow();
    });

    it('throws ApiError when server responds with 409 Conflict', async () => {
      server.use(
        http.post('http://localhost:3000/semesters', () => {
          return HttpResponse.json(
            {
              error: {
                code: 'CONFLICT',
                message: 'El rango de fechas se superpone con otro semestre',
              },
            },
            { status: 409 },
          );
        }),
      );

      await expect(
        createSemester({
          code: '2027-I',
          startDate: '2027-03-01',
          endDate: '2027-07-31',
        }),
      ).rejects.toThrow();
    });
  });
});
