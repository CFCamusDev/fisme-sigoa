import { describe, expect, it } from 'vitest';
import {
  SCHEDULE_ACTIVITY_MAX_LENGTH,
  SCHEDULE_GOAL_MAX_LENGTH,
  SCHEDULE_ID_MAX_LENGTH,
  SCHEDULE_INDICATOR_MAX_LENGTH,
  SCHEDULE_MAX_ITEMS,
  SCHEDULE_RESPONSIBLE_MAX_LENGTH,
  changeScheduleActivityStatusRequestSchema,
  proposeScheduleRequestSchema,
  saveScheduleRequestSchema,
  scheduleActivityDtoSchema,
  scheduleActivityIdParamSchema,
  scheduleActivityInputSchema,
  scheduleResponseSchema,
} from './schedule.js';

describe('schedule schemas', () => {
  it('accepts an activity without dates and nullable goal and indicator', () => {
    const parsed = scheduleActivityInputSchema.safeParse({
      activity: 'Elaborar cronograma',
      responsible: 'Presidente',
      goal: null,
      indicator: null,
      startDate: null,
      endDate: null,
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects unknown fields', () => {
    expect(
      scheduleActivityInputSchema.safeParse({
        activity: 'Elaborar cronograma',
        responsible: 'Presidente',
        extraField: 'no permitido',
      }).success,
    ).toBe(false);

    expect(
      saveScheduleRequestSchema.safeParse({
        activities: [],
        extraField: true,
      }).success,
    ).toBe(false);
  });

  it('rejects an end date before the start date', () => {
    const parsed = scheduleActivityInputSchema.safeParse({
      activity: 'Actividad',
      responsible: 'Presidente',
      startDate: '2027-04-10',
      endDate: '2027-04-01',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects more than 50 activities', () => {
    const tooMany = Array.from({ length: SCHEDULE_MAX_ITEMS + 1 }, (_, index) => ({
      activity: `Actividad ${index + 1}`,
      responsible: 'Presidente',
    }));
    expect(saveScheduleRequestSchema.safeParse({ activities: tooMany }).success).toBe(false);
  });

  it('accepts an empty list', () => {
    expect(saveScheduleRequestSchema.safeParse({ activities: [] }).success).toBe(true);
  });

  it('rejects empty or oversized text', () => {
    expect(
      scheduleActivityInputSchema.safeParse({
        activity: '   ',
        responsible: 'Presidente',
      }).success,
    ).toBe(false);

    expect(
      scheduleActivityInputSchema.safeParse({
        activity: 'A'.repeat(SCHEDULE_ACTIVITY_MAX_LENGTH + 1),
        responsible: 'Presidente',
      }).success,
    ).toBe(false);

    expect(
      scheduleActivityInputSchema.safeParse({
        activity: 'Actividad',
        responsible: 'R'.repeat(SCHEDULE_RESPONSIBLE_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);

    expect(
      scheduleActivityInputSchema.safeParse({
        activity: 'Actividad',
        responsible: 'Presidente',
        goal: 'G'.repeat(SCHEDULE_GOAL_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);

    expect(
      scheduleActivityInputSchema.safeParse({
        activity: 'Actividad',
        responsible: 'Presidente',
        indicator: 'I'.repeat(SCHEDULE_INDICATOR_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it('rejects an invalid or out-of-range date', () => {
    expect(
      scheduleActivityInputSchema.safeParse({
        activity: 'Actividad',
        responsible: 'Presidente',
        startDate: '2027-02-29',
      }).success,
    ).toBe(false);

    expect(
      scheduleActivityInputSchema.safeParse({
        activity: 'Actividad',
        responsible: 'Presidente',
        endDate: '1999-12-31',
      }).success,
    ).toBe(false);

    expect(
      scheduleActivityInputSchema.safeParse({
        activity: 'Actividad',
        responsible: 'Presidente',
        endDate: '2101-01-01',
      }).success,
    ).toBe(false);
  });

  it('bounds ids', () => {
    expect(scheduleActivityIdParamSchema.safeParse({ id: '' }).success).toBe(false);
    expect(
      scheduleActivityIdParamSchema.safeParse({ id: 'x'.repeat(SCHEDULE_ID_MAX_LENGTH + 1) })
        .success,
    ).toBe(false);
    expect(scheduleActivityIdParamSchema.safeParse({ id: 'act-1' }).success).toBe(true);
  });

  it('requires actualEndDate only for COMPLETED', () => {
    expect(
      changeScheduleActivityStatusRequestSchema.safeParse({
        status: 'IN_PROGRESS',
        actualEndDate: '2027-04-10',
      }).success,
    ).toBe(false);

    expect(
      changeScheduleActivityStatusRequestSchema.safeParse({
        status: 'COMPLETED',
        actualEndDate: '2027-04-10',
      }).success,
    ).toBe(true);
  });

  it('rejects the PENDING status in the status request', () => {
    expect(
      changeScheduleActivityStatusRequestSchema.safeParse({
        status: 'PENDING',
      }).success,
    ).toBe(false);
  });

  it('requires an empty body to propose', () => {
    expect(proposeScheduleRequestSchema.safeParse({}).success).toBe(true);
    expect(proposeScheduleRequestSchema.safeParse({ extra: 1 }).success).toBe(false);
  });

  it('accepts nullable fields in the DTO', () => {
    const dto = {
      id: 'act-1',
      processExecutionId: 'exec-1',
      number: 1,
      activity: 'Elaborar cronograma',
      responsible: 'Presidente',
      goal: null,
      indicator: null,
      startDate: null,
      endDate: null,
      status: 'PENDING',
      actualEndDate: null,
      isOverdue: false,
      createdAt: '2027-03-10T12:00:00.000Z',
      updatedAt: '2027-03-10T12:00:00.000Z',
    };

    expect(scheduleActivityDtoSchema.safeParse(dto).success).toBe(true);
    expect(scheduleResponseSchema.safeParse({ items: [dto] }).success).toBe(true);
  });
});
