import { describe, expect, it } from 'vitest';
import { getStakeholderImportColumns } from './stakeholder-import-columns.js';

describe('getStakeholderImportColumns', () => {
  it('requires the columns of each list type', () => {
    expect(getStakeholderImportColumns('EMPLOYER').map((col) => col.header)).toEqual([
      'RUC',
      'Institución',
      'Sector',
      'Representante',
      'Correo',
      'Celular',
      'Cargo',
    ]);

    expect(getStakeholderImportColumns('ADVISORY_BOARD').map((col) => col.header)).toEqual([
      'DNI o RUC',
      'Nombre o razón social',
      'Institución',
      'Actividad',
      'Correo',
      'Celular',
    ]);

    expect(getStakeholderImportColumns('GRADUATE').map((col) => col.header)).toEqual([
      'DNI',
      'Nombres completos',
      'Año de egreso',
      'Correo',
      'Celular',
    ]);

    expect(getStakeholderImportColumns('STUDENT').map((col) => col.header)).toEqual([
      'DNI',
      'Nombres completos',
      'Ciclo',
      'Correo',
      'Celular',
    ]);

    expect(getStakeholderImportColumns('TEACHER').map((col) => col.header)).toEqual([
      'DNI',
      'Nombres completos',
      'Correo',
      'Celular',
    ]);
  });
});
