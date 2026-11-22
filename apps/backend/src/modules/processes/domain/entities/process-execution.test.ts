import { describe, expect, it } from 'vitest';
import { ProcessExecution } from './process-execution.js';
import { CatalogVersionNotAllowedError } from '../errors/catalog-version-not-allowed-error.js';
import { InvalidExecutionTransitionError } from '../errors/invalid-execution-transition-error.js';
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

  it('advance returns a new instance with the next status, updatedBy and updatedAt', () => {
    const execution = ProcessExecution.create({
      id: 'exec-13',
      programId: PROGRAM_ID,
      type: 'P612',
      year: 2027,
      catalogVersion: { id: 'cv-1', programId: PROGRAM_ID, status: 'APPROVED' },
      actorId: ACTOR_ID,
      now: BASE_NOW,
    });
    const nextNow = new Date('2027-01-20T12:00:00.000Z');

    const advanced = execution.advance({ actorId: 'user-2', now: nextNow });

    expect(advanced.status).toBe('IN_PROGRESS');
    expect(advanced.updatedBy).toBe('user-2');
    expect(advanced.updatedAt).toBe(nextNow);
  });

  it('advance does not mutate the original', () => {
    const execution = ProcessExecution.create({
      id: 'exec-14',
      programId: PROGRAM_ID,
      type: 'P612',
      year: 2027,
      catalogVersion: { id: 'cv-1', programId: PROGRAM_ID, status: 'APPROVED' },
      actorId: ACTOR_ID,
      now: BASE_NOW,
    });

    execution.advance({ actorId: 'user-2', now: new Date('2027-01-20T12:00:00.000Z') });

    expect(execution.status).toBe('PLANNED');
    expect(execution.updatedBy).toBeNull();
    expect(execution.updatedAt).toBe(BASE_NOW);
  });

  it('advance fails from a status without advance', () => {
    for (const status of ['PENDING_APPROVAL', 'CLOSED', 'VOIDED'] as const) {
      const execution = ProcessExecution.rehydrate({
        id: `exec-${status}`,
        programId: PROGRAM_ID,
        type: 'P612',
        name: 'Medición anual de OE 2027',
        year: 2027,
        semesterId: null,
        catalogVersionId: 'cv-1',
        status,
        createdBy: ACTOR_ID,
        updatedBy: null,
        createdAt: BASE_NOW,
        updatedAt: BASE_NOW,
      });

      expect(() =>
        execution.advance({ actorId: 'user-2', now: new Date('2027-01-20T12:00:00.000Z') }),
      ).toThrow(InvalidExecutionTransitionError);
    }
  });

  it('closes from PENDING_APPROVAL without mutating the original', () => {
    const execution = ProcessExecution.rehydrate({
      id: 'exec-close',
      programId: PROGRAM_ID,
      type: 'P611',
      name: 'Establecer OE 2027',
      year: 2027,
      semesterId: null,
      catalogVersionId: 'cv-1',
      status: 'PENDING_APPROVAL',
      createdBy: ACTOR_ID,
      updatedBy: null,
      createdAt: BASE_NOW,
      updatedAt: BASE_NOW,
    });
    const closedNow = new Date('2027-02-01T10:00:00.000Z');

    const closed = execution.close({ actorId: 'user-2', now: closedNow });

    expect(closed.status).toBe('CLOSED');
    expect(closed.updatedBy).toBe('user-2');
    expect(closed.updatedAt).toBe(closedNow);
    expect(execution.status).toBe('PENDING_APPROVAL');
  });

  it('refuses to close or void a CLOSED execution', () => {
    for (const status of ['CLOSED', 'VOIDED'] as const) {
      const execution = ProcessExecution.rehydrate({
        id: `exec-terminal-${status}`,
        programId: PROGRAM_ID,
        type: 'P611',
        name: 'Establecer OE 2027',
        year: 2027,
        semesterId: null,
        catalogVersionId: 'cv-1',
        status,
        voidReason: status === 'VOIDED' ? 'Motivo previo' : null,
        createdBy: ACTOR_ID,
        updatedBy: ACTOR_ID,
        createdAt: BASE_NOW,
        updatedAt: BASE_NOW,
      });

      expect(() =>
        execution.close({ actorId: 'user-2', now: new Date('2027-02-01T10:00:00.000Z') }),
      ).toThrow(InvalidExecutionTransitionError);

      expect(() =>
        execution.void({
          actorId: 'user-2',
          now: new Date('2027-02-01T10:00:00.000Z'),
          reason: 'Nuevo motivo',
        }),
      ).toThrow(InvalidExecutionTransitionError);
    }
  });

  it('requires a non empty reason of at most 500 characters to void', () => {
    const execution = ProcessExecution.create({
      id: 'exec-void-val',
      programId: PROGRAM_ID,
      type: 'P612',
      year: 2027,
      catalogVersion: { id: 'cv-1', programId: PROGRAM_ID, status: 'APPROVED' },
      actorId: ACTOR_ID,
      now: BASE_NOW,
    });
    const voidNow = new Date('2027-02-01T10:00:00.000Z');

    expect(() => execution.void({ actorId: 'user-2', now: voidNow, reason: '   ' })).toThrow(
      InvalidProcessExecutionDataError,
    );

    expect(() =>
      execution.void({ actorId: 'user-2', now: voidNow, reason: 'A'.repeat(501) }),
    ).toThrow(InvalidProcessExecutionDataError);
  });

  it('records the void reason in the snapshot', () => {
    const execution = ProcessExecution.rehydrate({
      id: 'exec-void-ok',
      programId: PROGRAM_ID,
      type: 'P612',
      name: 'Medición anual de OE 2027',
      year: 2027,
      semesterId: null,
      catalogVersionId: 'cv-1',
      status: 'IN_PROGRESS',
      createdBy: ACTOR_ID,
      updatedBy: null,
      createdAt: BASE_NOW,
      updatedAt: BASE_NOW,
    });
    const voidNow = new Date('2027-02-01T10:00:00.000Z');

    const voided = execution.void({
      actorId: 'user-2',
      now: voidNow,
      reason: '  Ejecución duplicada por error de registro  ',
    });

    expect(voided.status).toBe('VOIDED');
    expect(voided.voidReason).toBe('Ejecución duplicada por error de registro');
    expect(voided.snapshot()).toMatchObject({
      status: 'VOIDED',
      voidReason: 'Ejecución duplicada por error de registro',
    });
  });
});
