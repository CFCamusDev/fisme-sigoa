import { describe, it, expect } from 'vitest';
import { programDtoSchema, updateProgramRequestSchema, getProgramQuerySchema } from './program.js';

describe('Program schemas (@sigoa/shared)', () => {
  describe('programDtoSchema', () => {
    it('accepts a valid ProgramDto', () => {
      const valid = {
        id: 'prog-cuid-1',
        code: 'EPIS',
        name: 'Ingeniería de Sistemas',
        faculty: 'Facultad de Ingeniería',
        updatedAt: '2026-11-09T12:00:00.000Z',
      };

      const result = programDtoSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects unknown properties (.strict())', () => {
      const withExtra = {
        id: 'prog-cuid-1',
        code: 'EPIS',
        name: 'Ingeniería de Sistemas',
        faculty: 'Facultad de Ingeniería',
        updatedAt: '2026-11-09T12:00:00.000Z',
        extraField: 'not allowed',
      };

      const result = programDtoSchema.safeParse(withExtra);
      expect(result.success).toBe(false);
    });

    it('rejects invalid code patterns and lengths', () => {
      expect(
        programDtoSchema.safeParse({
          id: '1',
          code: 'e',
          name: 'Nombre',
          faculty: 'Facultad',
          updatedAt: '2026-11-09T12:00:00.000Z',
        }).success,
      ).toBe(false);

      expect(
        programDtoSchema.safeParse({
          id: '1',
          code: 'epis_lowercase',
          name: 'Nombre',
          faculty: 'Facultad',
          updatedAt: '2026-11-09T12:00:00.000Z',
        }).success,
      ).toBe(false);

      expect(
        programDtoSchema.safeParse({
          id: '1',
          code: 'A'.repeat(21),
          name: 'Nombre',
          faculty: 'Facultad',
          updatedAt: '2026-11-09T12:00:00.000Z',
        }).success,
      ).toBe(false);
    });

    it('rejects invalid updatedAt timestamp', () => {
      expect(
        programDtoSchema.safeParse({
          id: '1',
          code: 'EPIS',
          name: 'Nombre',
          faculty: 'Facultad',
          updatedAt: 'invalid-date',
        }).success,
      ).toBe(false);
    });
  });

  describe('updateProgramRequestSchema', () => {
    it('accepts partial valid updates with at least one field', () => {
      expect(updateProgramRequestSchema.safeParse({ name: 'Nuevo Nombre' }).success).toBe(true);
      expect(updateProgramRequestSchema.safeParse({ faculty: 'Nueva Facultad' }).success).toBe(
        true,
      );
      expect(updateProgramRequestSchema.safeParse({ code: 'EPIS_NEW' }).success).toBe(true);
      expect(
        updateProgramRequestSchema.safeParse({
          name: 'Nombre',
          faculty: 'Facultad',
        }).success,
      ).toBe(true);
    });

    it('rejects an empty request body (no fields provided)', () => {
      const result = updateProgramRequestSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('rejects unknown properties (.strict())', () => {
      const result = updateProgramRequestSchema.safeParse({
        name: 'Nuevo Nombre',
        unknown: 'forbidden',
      });
      expect(result.success).toBe(false);
    });

    it('rejects strings that are empty or whitespace only', () => {
      expect(updateProgramRequestSchema.safeParse({ name: '   ' }).success).toBe(false);
      expect(updateProgramRequestSchema.safeParse({ code: '   ' }).success).toBe(false);
      expect(updateProgramRequestSchema.safeParse({ faculty: '   ' }).success).toBe(false);
    });
  });

  describe('getProgramQuerySchema', () => {
    it('accepts empty query parameters', () => {
      expect(getProgramQuerySchema.safeParse({}).success).toBe(true);
    });

    it('rejects unknown query parameters (.strict())', () => {
      expect(getProgramQuerySchema.safeParse({ page: '1' }).success).toBe(false);
      expect(getProgramQuerySchema.safeParse({ filter: 'true' }).success).toBe(false);
    });
  });
});
