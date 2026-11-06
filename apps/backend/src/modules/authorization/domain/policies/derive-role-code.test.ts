import { describe, expect, it } from 'vitest';
import { InvalidRoleDataError } from '../errors/invalid-role-data-error.js';
import { deriveRoleCode } from './derive-role-code.js';

describe('deriveRoleCode Policy (HU-006, T-006-07b)', () => {
  it('removes accents and symbols', () => {
    expect(deriveRoleCode('¡Coordinador de Área!')).toBe('COORDINADOR_DE_AREA');
    expect(deriveRoleCode('Comité Consultivo & Empleador')).toBe('COMITE_CONSULTIVO_EMPLEADOR');
  });

  it('uppercases and joins words with underscores', () => {
    expect(deriveRoleCode('auditor interno')).toBe('AUDITOR_INTERNO');
    expect(deriveRoleCode('gestor de calidad')).toBe('GESTOR_DE_CALIDAD');
  });

  it('trims separators', () => {
    expect(deriveRoleCode('---Auditor---')).toBe('AUDITOR');
    expect(deriveRoleCode('   ___Docente___   ')).toBe('DOCENTE');
  });

  it('truncates to 64 characters', () => {
    const longName = 'A'.repeat(80);
    const code = deriveRoleCode(longName);
    expect(code).toHaveLength(64);
    expect(code).toBe('A'.repeat(64));
  });

  it('rejects a name with no letters or digits', () => {
    expect(() => deriveRoleCode('---')).toThrow(InvalidRoleDataError);
    expect(() => deriveRoleCode('   ')).toThrow(InvalidRoleDataError);
    expect(() => deriveRoleCode('!@#$%^&*()')).toThrow(InvalidRoleDataError);
  });

  it('is stable for equivalent names', () => {
    expect(deriveRoleCode('Coordinador de Calidad')).toBe('COORDINADOR_DE_CALIDAD');
    expect(deriveRoleCode('coordinador  de   calidad')).toBe('COORDINADOR_DE_CALIDAD');
    expect(deriveRoleCode('COORDINADOR DE CALIDAD')).toBe('COORDINADOR_DE_CALIDAD');
  });
});
