import { describe, expect, it } from 'vitest';
import {
  SCHEDULE_ACTIVITY_MAX,
  SCHEDULE_GOAL_MAX,
  SCHEDULE_RESPONSIBLE_MAX,
} from '../entities/schedule-activity-status.js';
import { PROCESS_TYPES } from '../entities/process-type.js';
import { PROCEDURE_STEPS, buildProposedActivities } from './procedure-steps.js';

describe('procedure-steps', () => {
  it('has the official number of steps for each process type', () => {
    expect(PROCEDURE_STEPS.P611).toHaveLength(10);
    expect(PROCEDURE_STEPS.P612).toHaveLength(9);
    expect(PROCEDURE_STEPS.P613).toHaveLength(9);
    expect(PROCEDURE_STEPS.P621).toHaveLength(13);
    expect(PROCEDURE_STEPS.P622).toHaveLength(12);
    expect(PROCEDURE_STEPS.P623).toHaveLength(11);
  });

  it('numbers the proposed activities from 1 without gaps', () => {
    for (const processType of PROCESS_TYPES) {
      const proposed = buildProposedActivities(processType);
      expect(proposed.map((step) => step.number)).toEqual(
        Array.from({ length: proposed.length }, (_, index) => index + 1),
      );
    }
  });

  it('expands the five validation meetings of P621', () => {
    const proposed = buildProposedActivities('P621');
    const meetings = proposed.slice(5, 10);

    expect(meetings.map((step) => step.number)).toEqual([6, 7, 8, 9, 10]);
    expect(meetings.map((step) => step.activity)).toEqual([
      'Reunión de validación con el Comité Consultivo',
      'Reunión de validación con los Empleadores',
      'Reunión de validación con los Graduados',
      'Reunión de validación con los Docentes',
      'Reunión de validación con los Estudiantes',
    ]);
  });

  it('maps a dash output to a null goal', () => {
    const p612 = buildProposedActivities('P612');
    expect(p612[6]?.goal).toBeNull();
    expect(p612[7]?.goal).toBeNull();

    const p621 = buildProposedActivities('P621');
    expect(p621[1]?.goal).toBeNull();
    expect(p621[2]?.goal).toBeNull();
  });

  it('keeps every step within the text limits', () => {
    for (const processType of PROCESS_TYPES) {
      const proposed = buildProposedActivities(processType);
      for (const step of proposed) {
        expect(step.activity.trim().length).toBeGreaterThan(0);
        expect(step.activity.length).toBeLessThanOrEqual(SCHEDULE_ACTIVITY_MAX);
        expect(step.responsible.trim().length).toBeGreaterThan(0);
        expect(step.responsible.length).toBeLessThanOrEqual(SCHEDULE_RESPONSIBLE_MAX);
        if (step.goal !== null) {
          expect(step.goal.trim().length).toBeGreaterThan(0);
          expect(step.goal.length).toBeLessThanOrEqual(SCHEDULE_GOAL_MAX);
        }
      }
    }
  });

  it('starts P611 with the schedule step', () => {
    const p611 = buildProposedActivities('P611');
    expect(p611[0]).toEqual({
      number: 1,
      activity:
        'Elaborar cronograma para el establecimiento y validación de OE y las encuestas (aplicación virtual)',
      responsible: 'Presidente',
      goal: 'Anexo 1, Anexo 5',
    });
  });
});
