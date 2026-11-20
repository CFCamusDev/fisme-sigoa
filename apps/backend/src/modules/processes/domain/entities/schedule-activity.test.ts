import { describe, expect, it } from 'vitest';
import { ScheduleActivity } from './schedule-activity.js';
import { InvalidScheduleDataError } from '../errors/invalid-schedule-data-error.js';
import { InvalidScheduleTransitionError } from '../errors/invalid-schedule-transition-error.js';

const BASE_NOW = new Date('2027-03-10T15:00:00.000Z');
const LATER_NOW = new Date('2027-03-15T15:00:00.000Z');
const EXECUTION_ID = 'exec-1';
const ACTOR_ID = 'user-1';

describe('ScheduleActivity', () => {
  it('creates a PENDING activity with trimmed text', () => {
    const activity = ScheduleActivity.create({
      id: 'act-1',
      executionId: EXECUTION_ID,
      number: 1,
      activity: '  Elaborar   el cronograma  ',
      responsible: '  Presidente del Comité  ',
      goal: '  Anexo 1 aprobado  ',
      indicator: '  100% de avance  ',
      startDate: '2027-03-01',
      endDate: '2027-03-15',
      actorId: ACTOR_ID,
      now: BASE_NOW,
    });

    expect(activity.status).toBe('PENDING');
    expect(activity.activity).toBe('Elaborar el cronograma');
    expect(activity.responsible).toBe('Presidente del Comité');
    expect(activity.goal).toBe('Anexo 1 aprobado');
    expect(activity.indicator).toBe('100% de avance');
    expect(activity.actualEndDate).toBeNull();
    expect(activity.updatedBy).toBeNull();
  });

  it('accepts an activity without dates', () => {
    const activity = ScheduleActivity.create({
      id: 'act-2',
      executionId: EXECUTION_ID,
      number: 1,
      activity: 'Convocar al Comité Consultivo',
      responsible: 'Comité de Calidad',
      actorId: ACTOR_ID,
      now: BASE_NOW,
    });

    expect(activity.startDate).toBeNull();
    expect(activity.endDate).toBeNull();
    expect(activity.goal).toBeNull();
    expect(activity.indicator).toBeNull();
  });

  it('rejects an empty activity or responsible', () => {
    expect(() =>
      ScheduleActivity.create({
        id: 'act-3',
        executionId: EXECUTION_ID,
        number: 1,
        activity: '   ',
        responsible: 'Comité de Calidad',
        actorId: ACTOR_ID,
        now: BASE_NOW,
      }),
    ).toThrow(InvalidScheduleDataError);

    expect(() =>
      ScheduleActivity.create({
        id: 'act-4',
        executionId: EXECUTION_ID,
        number: 1,
        activity: 'Actividad válida',
        responsible: '   ',
        actorId: ACTOR_ID,
        now: BASE_NOW,
      }),
    ).toThrow(InvalidScheduleDataError);
  });

  it('rejects text over the limits', () => {
    expect(() =>
      ScheduleActivity.create({
        id: 'act-5',
        executionId: EXECUTION_ID,
        number: 1,
        activity: 'A'.repeat(301),
        responsible: 'Comité de Calidad',
        actorId: ACTOR_ID,
        now: BASE_NOW,
      }),
    ).toThrow(InvalidScheduleDataError);

    expect(() =>
      ScheduleActivity.create({
        id: 'act-6',
        executionId: EXECUTION_ID,
        number: 1,
        activity: 'Actividad válida',
        responsible: 'R'.repeat(151),
        actorId: ACTOR_ID,
        now: BASE_NOW,
      }),
    ).toThrow(InvalidScheduleDataError);

    expect(() =>
      ScheduleActivity.create({
        id: 'act-7',
        executionId: EXECUTION_ID,
        number: 1,
        activity: 'Actividad válida',
        responsible: 'Comité',
        goal: 'G'.repeat(301),
        actorId: ACTOR_ID,
        now: BASE_NOW,
      }),
    ).toThrow(InvalidScheduleDataError);

    expect(() =>
      ScheduleActivity.create({
        id: 'act-8',
        executionId: EXECUTION_ID,
        number: 1,
        activity: 'Actividad válida',
        responsible: 'Comité',
        indicator: 'I'.repeat(301),
        actorId: ACTOR_ID,
        now: BASE_NOW,
      }),
    ).toThrow(InvalidScheduleDataError);
  });

  it('rejects an end date before the start date', () => {
    expect(() =>
      ScheduleActivity.create({
        id: 'act-9',
        executionId: EXECUTION_ID,
        number: 1,
        activity: 'Actividad válida',
        responsible: 'Comité',
        startDate: '2027-03-20',
        endDate: '2027-03-10',
        actorId: ACTOR_ID,
        now: BASE_NOW,
      }),
    ).toThrow(InvalidScheduleDataError);
  });

  it('start moves PENDING to IN_PROGRESS', () => {
    const pending = ScheduleActivity.create({
      id: 'act-10',
      executionId: EXECUTION_ID,
      number: 1,
      activity: 'Actividad válida',
      responsible: 'Comité',
      actorId: ACTOR_ID,
      now: BASE_NOW,
    });

    const inProgress = pending.start({ actorId: 'user-2', now: LATER_NOW });

    expect(inProgress.status).toBe('IN_PROGRESS');
    expect(inProgress.updatedBy).toBe('user-2');
    expect(inProgress.updatedAt).toEqual(LATER_NOW);
  });

  it('complete moves IN_PROGRESS to COMPLETED and stores the actual end date', () => {
    const inProgress = ScheduleActivity.create({
      id: 'act-11',
      executionId: EXECUTION_ID,
      number: 1,
      activity: 'Actividad válida',
      responsible: 'Comité',
      startDate: '2027-03-01',
      endDate: '2027-03-20',
      actorId: ACTOR_ID,
      now: BASE_NOW,
    }).start({ actorId: ACTOR_ID, now: BASE_NOW });

    const completed = inProgress.complete({
      actualEndDate: '2027-03-12',
      today: '2027-03-15',
      actorId: 'user-2',
      now: LATER_NOW,
    });

    expect(completed.status).toBe('COMPLETED');
    expect(completed.actualEndDate).toBe('2027-03-12');
    expect(completed.updatedBy).toBe('user-2');
  });

  it('complete defaults the actual end date to today', () => {
    const inProgress = ScheduleActivity.create({
      id: 'act-12',
      executionId: EXECUTION_ID,
      number: 1,
      activity: 'Actividad válida',
      responsible: 'Comité',
      actorId: ACTOR_ID,
      now: BASE_NOW,
    }).start({ actorId: ACTOR_ID, now: BASE_NOW });

    const completed = inProgress.complete({
      today: '2027-03-15',
      actorId: ACTOR_ID,
      now: LATER_NOW,
    });

    expect(completed.status).toBe('COMPLETED');
    expect(completed.actualEndDate).toBe('2027-03-15');
  });

  it('rejects completing a PENDING activity', () => {
    const pending = ScheduleActivity.create({
      id: 'act-13',
      executionId: EXECUTION_ID,
      number: 1,
      activity: 'Actividad válida',
      responsible: 'Comité',
      actorId: ACTOR_ID,
      now: BASE_NOW,
    });

    expect(() =>
      pending.complete({ today: '2027-03-15', actorId: ACTOR_ID, now: LATER_NOW }),
    ).toThrow(InvalidScheduleTransitionError);
  });

  it('rejects going back from COMPLETED', () => {
    const completed = ScheduleActivity.create({
      id: 'act-14',
      executionId: EXECUTION_ID,
      number: 1,
      activity: 'Actividad válida',
      responsible: 'Comité',
      actorId: ACTOR_ID,
      now: BASE_NOW,
    })
      .start({ actorId: ACTOR_ID, now: BASE_NOW })
      .complete({ today: '2027-03-15', actorId: ACTOR_ID, now: LATER_NOW });

    expect(() => completed.start({ actorId: ACTOR_ID, now: LATER_NOW })).toThrow(
      InvalidScheduleTransitionError,
    );
    expect(() =>
      completed.complete({ today: '2027-03-15', actorId: ACTOR_ID, now: LATER_NOW }),
    ).toThrow(InvalidScheduleTransitionError);
  });

  it('rejects a future actual end date', () => {
    const inProgress = ScheduleActivity.create({
      id: 'act-15',
      executionId: EXECUTION_ID,
      number: 1,
      activity: 'Actividad válida',
      responsible: 'Comité',
      actorId: ACTOR_ID,
      now: BASE_NOW,
    }).start({ actorId: ACTOR_ID, now: BASE_NOW });

    expect(() =>
      inProgress.complete({
        actualEndDate: '2027-03-16',
        today: '2027-03-15',
        actorId: ACTOR_ID,
        now: LATER_NOW,
      }),
    ).toThrow(InvalidScheduleDataError);
  });

  it('rejects an actual end date before the start date', () => {
    const inProgress = ScheduleActivity.create({
      id: 'act-16',
      executionId: EXECUTION_ID,
      number: 1,
      activity: 'Actividad válida',
      responsible: 'Comité',
      startDate: '2027-03-10',
      actorId: ACTOR_ID,
      now: BASE_NOW,
    }).start({ actorId: ACTOR_ID, now: BASE_NOW });

    expect(() =>
      inProgress.complete({
        actualEndDate: '2027-03-09',
        today: '2027-03-15',
        actorId: ACTOR_ID,
        now: LATER_NOW,
      }),
    ).toThrow(InvalidScheduleDataError);
  });

  it('snapshot has no personal data and dates as YYYY-MM-DD', () => {
    const activity = ScheduleActivity.create({
      id: 'act-17',
      executionId: EXECUTION_ID,
      number: 2,
      activity: 'Revisar resultados',
      responsible: 'Presidente del Comité',
      goal: 'Acta de sesión',
      indicator: '1 acta',
      startDate: '2027-03-01',
      endDate: '2027-03-31',
      actorId: ACTOR_ID,
      now: BASE_NOW,
    });

    const snapshot = activity.snapshot();
    expect(snapshot).toEqual({
      id: 'act-17',
      processExecutionId: EXECUTION_ID,
      number: 2,
      activity: 'Revisar resultados',
      responsible: 'Presidente del Comité',
      goal: 'Acta de sesión',
      indicator: '1 acta',
      startDate: '2027-03-01',
      endDate: '2027-03-31',
      status: 'PENDING',
      actualEndDate: null,
    });
    expect(snapshot).not.toHaveProperty('createdBy');
    expect(snapshot).not.toHaveProperty('updatedBy');
    expect(snapshot).not.toHaveProperty('email');
    expect(snapshot).not.toHaveProperty('dni');
  });
});
