import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import type { ProgramDto } from '@sigoa/shared';
import { getProgram } from './get-program';
import { updateProgram } from './update-program';

const mockProgram: ProgramDto = {
  id: 'cm3programcuid1234567890',
  code: 'EPIS',
  name: 'Escuela Profesional de Ingeniería de Sistemas',
  faculty: 'Facultad de Ingeniería de Sistemas y Mecánica Eléctrica',
  updatedAt: '2026-11-09T12:00:00.000Z',
};

describe('parameters API client (T-009-11)', () => {
  describe('getProgram', () => {
    it('returns program data when response is 200 OK', async () => {
      server.use(
        http.get('http://localhost:3000/program', () => {
          return HttpResponse.json(mockProgram);
        }),
      );

      const result = await getProgram();
      expect(result).toEqual(mockProgram);
    });

    it('throws ApiError when server responds with 404', async () => {
      server.use(
        http.get('http://localhost:3000/program', () => {
          return HttpResponse.json(
            {
              error: {
                code: 'NOT_FOUND',
                message: 'No se encontró el programa institucional',
              },
            },
            { status: 404 },
          );
        }),
      );

      await expect(getProgram()).rejects.toMatchObject({
        status: 404,
        code: 'NOT_FOUND',
      });
    });

    it('throws ApiError when server responds with 403', async () => {
      server.use(
        http.get('http://localhost:3000/program', () => {
          return HttpResponse.json(
            {
              error: {
                code: 'FORBIDDEN',
                message: 'No tienes permiso para consultar los datos del programa',
              },
            },
            { status: 403 },
          );
        }),
      );

      await expect(getProgram()).rejects.toMatchObject({
        status: 403,
        code: 'FORBIDDEN',
      });
    });
  });

  describe('updateProgram', () => {
    it('validates request schema on client and sends PATCH to server', async () => {
      const updatedMock: ProgramDto = {
        ...mockProgram,
        name: 'Ingeniería de Sistemas',
        updatedAt: '2026-11-09T13:00:00.000Z',
      };

      server.use(
        http.patch('http://localhost:3000/program', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          expect(body).toEqual({ name: 'Ingeniería de Sistemas' });
          return HttpResponse.json(updatedMock);
        }),
      );

      const result = await updateProgram({ name: 'Ingeniería de Sistemas' });
      expect(result).toEqual(updatedMock);
    });

    it('rejects locally when body is empty without making a network request', async () => {
      let networkCalled = false;
      server.use(
        http.patch('http://localhost:3000/program', () => {
          networkCalled = true;
          return HttpResponse.json(mockProgram);
        }),
      );

      await expect(updateProgram({})).rejects.toThrow();
      expect(networkCalled).toBe(false);
    });

    it('propagates 409 conflict when code is already taken', async () => {
      server.use(
        http.patch('http://localhost:3000/program', () => {
          return HttpResponse.json(
            {
              error: {
                code: 'CONFLICT',
                message: 'Ya existe otro programa con el código especificado',
              },
            },
            { status: 409 },
          );
        }),
      );

      await expect(updateProgram({ code: 'DUPLICADO' })).rejects.toMatchObject({
        status: 409,
        code: 'CONFLICT',
      });
    });
  });
});
