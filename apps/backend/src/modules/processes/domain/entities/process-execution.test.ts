import { describe, expect, it } from 'vitest';
import { ProcessExecution } from './process-execution.js';
import { CatalogVersionNotAllowedError } from '../errors/catalog-version-not-allowed-error.js';
import { InvalidProcessExecutionDataError } from '../errors/invalid-process-execution-data-error.js';

const BASE_NOW = new Date('2027-01-15T10:00:00.000Z');
const PROGRAM_ID = 'prog-1';
const ACTOR_ID = 'user-1';

describe('ProcessExecution', () => {
  it('builds the default name "Medición anual de OE 2027" for P612', () => {
    const execution = ProcessExecution.create({
      id: 'exec-1',
      programId: PROGRAM_ID,
      type: 'P612',
      year: 2027,
      catalogVersion: { id: 'cv-1', programId: PROGRAM_ID, status: 'APPROVED' },
      actorId: ACTOR_ID,
      now: BASE_NOW,
    });

    expect(execution.name).toBe('Medición anual de OE 2027');
  });

  it('starts in PLANNED', () => {
    const execution = ProcessExecution.create({
      id: 'exec-2',
      programId: PROGRAM_ID,
      type: 'P611',
      year: 2027,
      catalogVersion: { id: 'cv-val', programId: PROGRAM_ID, status: 'IN_VALIDATION' },
      actorId: ACTOR_ID,
      now: BASE_NOW,
    });

    expect(execution.status).toBe('PLANNED');
    expect(execution.updatedBy).toBeNull();
  });

  it('builds the semester name for P622', () => {
    const execution = ProcessExecution.create({
      id: 'exec-3',
      programId: PROGRAM_ID,
      type: 'P622',
      year: 2027,
      semester: { id: 'sem-1', code: '2027-I' },
      catalogVersion: { id: 'cv-1', programId: PROGRAM_ID, status: 'APPROVED' },
      actorId: ACTOR_ID,
      now: BASE_NOW,
    });

    expect(execution.name).toBe('Medición directa de AG 2027-I');
    expect(execution.semesterId).toBe('sem-1');
  });

  it('rejects a semester for a year-based type', () => {
    expect(() =>
      ProcessExecution.create({
        id: 'exec-4',
        programId: PROGRAM_ID,
        type: 'P612',
        year: 2027,
        semester: { id: 'sem-1', code: '2027-I' },
        catalogVersion: { id: 'cv-1', programId: PROGRAM_ID, status: 'APPROVED' },
        actorId: ACTOR_ID,
        now: BASE_NOW,
      }),
    ).toThrow(InvalidProcessExecutionDataError);
  });

  it('requires a semester for P622', () => {
    expect(() =>
      ProcessExecution.create({
        id: 'exec-5',
        programId: PROGRAM_ID,
        type: 'P622',
        year: 2027,
        semester: null,
        catalogVersion: { id: 'cv-1', programId: PROGRAM_ID, status: 'APPROVED' },
        actorId: ACTOR_ID,
        now: BASE_NOW,
      }),
    ).toThrow(InvalidProcessExecutionDataError);
  });

  it('rejects a semester whose year differs from the year', () => {
    expect(() =>
      ProcessExecution.create({
        id: 'exec-6',
        programId: PROGRAM_ID,
        type: 'P622',
        year: 2027,
        semester: { id: 'sem-2026', code: '2026-II' },
        catalogVersion: { id: 'cv-1', programId: PROGRAM_ID, status: 'APPROVED' },
        actorId: ACTOR_ID,
        now: BASE_NOW,
      }),
    ).toThrow(InvalidProcessExecutionDataError);
  });

  it('rejects a year out of range', () => {
    expect(() =>
      ProcessExecution.create({
        id: 'exec-7',
        programId: PROGRAM_ID,
        type: 'P612',
        year: 1999,
        catalogVersion: { id: 'cv-1', programId: PROGRAM_ID, status: 'APPROVED' },
        actorId: ACTOR_ID,
        now: BASE_NOW,
      }),
    ).toThrow(InvalidProcessExecutionDataError);

    expect(() =>
      ProcessExecution.create({
        id: 'exec-8',
        programId: PROGRAM_ID,
        type: 'P612',
        year: 2101,
        catalogVersion: { id: 'cv-1', programId: PROGRAM_ID, status: 'APPROVED' },
        actorId: ACTOR_ID,
        now: BASE_NOW,
      }),
    ).toThrow(InvalidProcessExecutionDataError);
  });

  it('rejects a name over 150 characters', () => {
    expect(() =>
      ProcessExecution.create({
        id: 'exec-9',
        programId: PROGRAM_ID,
        type: 'P612',
        name: 'A'.repeat(151),
        year: 2027,
        catalogVersion: { id: 'cv-1', programId: PROGRAM_ID, status: 'APPROVED' },
        actorId: ACTOR_ID,
        now: BASE_NOW,
      }),
    ).toThrow(InvalidProcessExecutionDataError);
  });

  it('normalizes spaces in the name', () => {
    const execution = ProcessExecution.create({
      id: 'exec-10',
      programId: PROGRAM_ID,
      type: 'P612',
      name: '  Medición   especial   2027  ',
      year: 2027,
      catalogVersion: { id: 'cv-1', programId: PROGRAM_ID, status: 'APPROVED' },
      actorId: ACTOR_ID,
      now: BASE_NOW,
    });

    expect(execution.name).toBe('Medición especial 2027');
  });

  it('rejects an incompatible catalog version status', () => {
    expect(() =>
      ProcessExecution.create({
        id: 'exec-11',
        programId: PROGRAM_ID,
        type: 'P611',
        year: 2027,
        catalogVersion: { id: 'cv-1', programId: PROGRAM_ID, status: 'APPROVED' },
        actorId: ACTOR_ID,
        now: BASE_NOW,
      }),
    ).toThrow(CatalogVersionNotAllowedError);
  });

  it('snapshot has no personal data', () => {
    const execution = ProcessExecution.create({
      id: 'exec-12',
      programId: PROGRAM_ID,
      type: 'P623',
      year: 2027,
      catalogVersion: { id: 'cv-1', programId: PROGRAM_ID, status: 'APPROVED' },
      actorId: ACTOR_ID,
      now: BASE_NOW,
    });

    const snapshot = execution.snapshot();
    expect(snapshot).toEqual({
      id: 'exec-12',
      programId: PROGRAM_ID,
      type: 'P623',
      name: 'Medición indirecta anual de AG 2027',
      year: 2027,
      semesterId: null,
      catalogVersionId: 'cv-1',
      status: 'PLANNED',
    });
    expect(snapshot).not.toHaveProperty('email');
    expect(snapshot).not.toHaveProperty('dni');
  });
});
