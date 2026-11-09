import { describe, it, expect } from 'vitest';
import { Program } from './program.js';
import { InvalidProgramDataError } from '../errors/invalid-program-data-error.js';

describe('Program entity (domain)', () => {
  const baseParams = {
    id: 'prog-1',
    code: 'EPIS',
    name: 'Ingeniería de Sistemas',
    faculty: 'Facultad de Ingeniería',
    createdBy: 'user-admin',
    updatedBy: 'user-admin',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  it('creates a valid Program instance and trims text fields', () => {
    const program = Program.create({
      ...baseParams,
      code: '  EPIS  ',
      name: '  Ingeniería de Sistemas  ',
      faculty: '  Facultad de Ingeniería  ',
    });

    expect(program.id).toBe('prog-1');
    expect(program.code).toBe('EPIS');
    expect(program.name).toBe('Ingeniería de Sistemas');
    expect(program.faculty).toBe('Facultad de Ingeniería');
  });

  it('throws InvalidProgramDataError when code is invalid or empty', () => {
    expect(() =>
      Program.create({
        ...baseParams,
        code: '   ',
      }),
    ).toThrow(InvalidProgramDataError);

    expect(() =>
      Program.create({
        ...baseParams,
        code: 'epis-minuscula',
      }),
    ).toThrow(InvalidProgramDataError);

    expect(() =>
      Program.create({
        ...baseParams,
        code: 'C',
      }),
    ).toThrow(InvalidProgramDataError);
  });

  it('throws InvalidProgramDataError when name or faculty is too short or too long', () => {
    expect(() =>
      Program.create({
        ...baseParams,
        name: 'AB',
      }),
    ).toThrow(InvalidProgramDataError);

    expect(() =>
      Program.create({
        ...baseParams,
        faculty: 'X'.repeat(151),
      }),
    ).toThrow(InvalidProgramDataError);
  });

  it('applyChanges returns changed=false when no values differ', () => {
    const program = Program.create(baseParams);
    const result = program.applyChanges(
      {
        code: 'EPIS',
        name: 'Ingeniería de Sistemas',
        faculty: 'Facultad de Ingeniería',
      },
      'new-actor',
    );

    expect(result.changed).toBe(false);
    expect(result.before).toEqual({
      code: 'EPIS',
      name: 'Ingeniería de Sistemas',
      faculty: 'Facultad de Ingeniería',
    });
    expect(result.after).toEqual({
      code: 'EPIS',
      name: 'Ingeniería de Sistemas',
      faculty: 'Facultad de Ingeniería',
    });
    expect(program.updatedBy).toBe('user-admin');
  });

  it('applyChanges mutates the program and updates updatedBy when values differ', () => {
    const program = Program.create(baseParams);
    const result = program.applyChanges(
      {
        name: 'Ingeniería de Sistemas y Computación',
      },
      'new-actor',
    );

    expect(result.changed).toBe(true);
    expect(result.before.name).toBe('Ingeniería de Sistemas');
    expect(result.after.name).toBe('Ingeniería de Sistemas y Computación');
    expect(program.name).toBe('Ingeniería de Sistemas y Computación');
    expect(program.updatedBy).toBe('new-actor');
  });

  it('applyChanges throws InvalidProgramDataError on invalid input and does not mutate', () => {
    const program = Program.create(baseParams);
    expect(() =>
      program.applyChanges(
        {
          name: '  ',
        },
        'new-actor',
      ),
    ).toThrow(InvalidProgramDataError);

    expect(program.name).toBe('Ingeniería de Sistemas');
  });
});
