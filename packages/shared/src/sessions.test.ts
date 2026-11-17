import { describe, expect, it } from 'vitest';
import {
  SESSION_URL_MAX_LENGTH,
  createSessionRequestSchema,
  listSessionsByExecutionQuerySchema,
  sessionDtoSchema,
  updateSessionRequestSchema,
} from './sessions.js';

describe('sessions schemas', () => {
  it('rejects a session without executions', () => {
    const result = createSessionRequestSchema.safeParse({
      stakeholderType: 'EMPLOYER',
      sessionDate: '2026-11-20',
      startTime: '10:00',
      modality: 'IN_PERSON',
      executionIds: [],
    });

    expect(result.success).toBe(false);
  });

  it('requires both links when virtual', () => {
    const missingRecording = createSessionRequestSchema.safeParse({
      stakeholderType: 'EMPLOYER',
      sessionDate: '2026-11-20',
      startTime: '10:00',
      modality: 'VIRTUAL',
      meetingUrl: 'https://meet.example.com/room',
      executionIds: ['exec-1'],
    });
    expect(missingRecording.success).toBe(false);

    const valid = createSessionRequestSchema.safeParse({
      stakeholderType: 'EMPLOYER',
      sessionDate: '2026-11-20',
      startTime: '10:00',
      modality: 'VIRTUAL',
      meetingUrl: 'https://meet.example.com/room',
      recordingUrl: 'https://drive.example.com/rec',
      executionIds: ['exec-1'],
    });
    expect(valid.success).toBe(true);
  });

  it('rejects unknown fields', () => {
    const result = createSessionRequestSchema.safeParse({
      stakeholderType: 'EMPLOYER',
      sessionDate: '2026-11-20',
      startTime: '10:00',
      modality: 'IN_PERSON',
      executionIds: ['exec-1'],
      extraField: 'not-allowed',
    });

    expect(result.success).toBe(false);
  });

  it('rejects more than 20 or repeated executions', () => {
    const tooMany = createSessionRequestSchema.safeParse({
      stakeholderType: 'EMPLOYER',
      sessionDate: '2026-11-20',
      startTime: '10:00',
      modality: 'IN_PERSON',
      executionIds: Array.from({ length: 21 }, (_, idx) => `exec-${idx + 1}`),
    });
    expect(tooMany.success).toBe(false);

    const repeated = createSessionRequestSchema.safeParse({
      stakeholderType: 'EMPLOYER',
      sessionDate: '2026-11-20',
      startTime: '10:00',
      modality: 'IN_PERSON',
      executionIds: ['exec-1', 'exec-1'],
    });
    expect(repeated.success).toBe(false);
  });

  it('rejects non-http links and links over 500 characters', () => {
    const nonHttp = createSessionRequestSchema.safeParse({
      stakeholderType: 'EMPLOYER',
      sessionDate: '2026-11-20',
      startTime: '10:00',
      modality: 'HYBRID',
      meetingUrl: 'javascript:alert(1)',
      executionIds: ['exec-1'],
    });
    expect(nonHttp.success).toBe(false);

    const overMax = createSessionRequestSchema.safeParse({
      stakeholderType: 'EMPLOYER',
      sessionDate: '2026-11-20',
      startTime: '10:00',
      modality: 'HYBRID',
      recordingUrl: `https://example.com/${'a'.repeat(SESSION_URL_MAX_LENGTH)}`,
      executionIds: ['exec-1'],
    });
    expect(overMax.success).toBe(false);
  });

  it('rejects an invalid date or time', () => {
    const invalidDate = createSessionRequestSchema.safeParse({
      stakeholderType: 'EMPLOYER',
      sessionDate: '2026-02-30',
      startTime: '10:00',
      modality: 'IN_PERSON',
      executionIds: ['exec-1'],
    });
    expect(invalidDate.success).toBe(false);

    const invalidTime = createSessionRequestSchema.safeParse({
      stakeholderType: 'EMPLOYER',
      sessionDate: '2026-11-20',
      startTime: '24:00',
      modality: 'IN_PERSON',
      executionIds: ['exec-1'],
    });
    expect(invalidTime.success).toBe(false);
  });

  it('bounds page and pageSize', () => {
    expect(listSessionsByExecutionQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(listSessionsByExecutionQuerySchema.safeParse({ page: 0 }).success).toBe(false);
    expect(listSessionsByExecutionQuerySchema.safeParse({ page: 10_001 }).success).toBe(false);
    expect(listSessionsByExecutionQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
  });

  it('accepts nullable list and links in the DTO', () => {
    const parsed = sessionDtoSchema.safeParse({
      id: 'sess-1',
      stakeholderType: 'EMPLOYER',
      stakeholderListId: null,
      sessionDate: '2026-11-20',
      startTime: '10:00',
      modality: 'IN_PERSON',
      meetingUrl: null,
      recordingUrl: null,
      executionIds: ['exec-1'],
      createdAt: '2026-11-17T15:00:00.000Z',
      updatedAt: '2026-11-17T15:00:00.000Z',
    });
    expect(parsed.success).toBe(true);
  });

  it('requires at least one field to update', () => {
    const empty = updateSessionRequestSchema.safeParse({});
    expect(empty.success).toBe(false);

    const valid = updateSessionRequestSchema.safeParse({ startTime: '11:30' });
    expect(valid.success).toBe(true);
  });
});
