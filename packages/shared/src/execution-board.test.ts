import { describe, expect, it } from 'vitest';
import {
  executionBoardQuerySchema,
  executionBoardResponseSchema,
  type ExecutionBoardResponse,
} from './execution-board.js';

function buildValidBoard(): ExecutionBoardResponse {
  return {
    execution: {
      id: 'exec-1',
      type: 'P612',
      name: 'Medición anual OE 2027',
      year: 2027,
      semesterId: null,
      semesterCode: null,
      catalogVersionId: 'cat-1',
      catalogVersionNumber: 1,
      status: 'IN_PROGRESS',
      createdAt: '2027-01-10T10:00:00.000Z',
      updatedAt: '2027-01-15T12:00:00.000Z',
    },
    schedule: {
      total: 4,
      completed: 2,
      inProgress: 1,
      pending: 1,
      overdue: 0,
      progressPercent: 50,
    },
    sessions: {
      total: 1,
      lastSessionDate: '2027-02-01',
      items: [
        {
          id: 'sess-1',
          stakeholderType: 'EMPLOYER',
          sessionDate: '2027-02-01',
          startTime: '10:00',
          modality: 'VIRTUAL',
        },
      ],
    },
    surveys: { available: false },
    minutes: { available: false },
    results: { available: false },
    pending: [
      {
        code: 'SESSIONS_MINUTES_SIGNED',
        label: 'Firmar actas de sesiones',
        state: 'NOT_VERIFIABLE',
        target: 'MINUTES',
      },
    ],
    nextStatus: 'CONSOLIDATING',
    generatedAt: '2027-02-02T09:00:00.000Z',
  };
}

describe('execution-board schemas', () => {
  it('accepts a complete execution board response DTO', () => {
    const result = executionBoardResponseSchema.safeParse(buildValidBoard());
    expect(result.success).toBe(true);
  });

  it('accepts nullable lastSessionDate and nextStatus with empty lists', () => {
    const board = buildValidBoard();
    board.sessions = { total: 0, lastSessionDate: null, items: [] };
    board.pending = [];
    board.nextStatus = null;

    const result = executionBoardResponseSchema.safeParse(board);
    expect(result.success).toBe(true);
  });

  it('rejects unknown fields in response and query', () => {
    const boardWithExtra = { ...buildValidBoard(), extra: true };
    expect(executionBoardResponseSchema.safeParse(boardWithExtra).success).toBe(false);
    expect(executionBoardQuerySchema.safeParse({}).success).toBe(true);
    expect(executionBoardQuerySchema.safeParse({ unknown: '1' }).success).toBe(false);
  });

  it('rejects progressPercent outside 0 to 100', () => {
    const negative = buildValidBoard();
    negative.schedule.progressPercent = -1;
    expect(executionBoardResponseSchema.safeParse(negative).success).toBe(false);

    const overHundred = buildValidBoard();
    overHundred.schedule.progressPercent = 101;
    expect(executionBoardResponseSchema.safeParse(overHundred).success).toBe(false);
  });

  it('rejects pending items with state MET', () => {
    const board = buildValidBoard();
    const invalidPending = {
      ...board,
      pending: [
        {
          code: 'SCHEDULE_HAS_ACTIVITY',
          label: 'Cronograma con actividad',
          state: 'MET',
          target: 'SCHEDULE',
        },
      ],
    };

    expect(executionBoardResponseSchema.safeParse(invalidPending).success).toBe(false);
  });
});
