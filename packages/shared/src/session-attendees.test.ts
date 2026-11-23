import { describe, expect, it } from 'vitest';
import {
  SESSION_ATTENDEES_MAX,
  SESSION_ATTENDEE_POSITION_MAX_LENGTH,
  registerSessionAttendeesRequestSchema,
  sessionAttendeesResponseSchema,
} from './session-attendees.js';

describe('registerSessionAttendeesRequestSchema', () => {
  it('accepts an empty attendee list', () => {
    const parsed = registerSessionAttendeesRequestSchema.parse({ attendees: [] });
    expect(parsed).toEqual({ attendees: [] });
  });

  it('normalizes blank positions and accepts omitted position', () => {
    const parsed = registerSessionAttendeesRequestSchema.parse({
      attendees: [
        { listMemberId: 'mem-1', position: '   ' },
        { listMemberId: 'mem-2' },
        { listMemberId: 'mem-3', position: '  Gerente  ' },
      ],
    });

    expect(parsed).toEqual({
      attendees: [
        { listMemberId: 'mem-1', position: null },
        { listMemberId: 'mem-2' },
        { listMemberId: 'mem-3', position: 'Gerente' },
      ],
    });
  });

  it('rejects unknown fields', () => {
    const result = registerSessionAttendeesRequestSchema.safeParse({
      attendees: [{ listMemberId: 'mem-1', extra: 'no' }],
    });
    expect(result.success).toBe(false);

    const rootResult = registerSessionAttendeesRequestSchema.safeParse({
      attendees: [],
      extra: true,
    });
    expect(rootResult.success).toBe(false);
  });

  it('rejects repeated members', () => {
    const result = registerSessionAttendeesRequestSchema.safeParse({
      attendees: [
        { listMemberId: 'mem-1', position: 'Cargo A' },
        { listMemberId: 'mem-1', position: 'Cargo B' },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a position over 120 characters', () => {
    const result = registerSessionAttendeesRequestSchema.safeParse({
      attendees: [
        {
          listMemberId: 'mem-1',
          position: 'a'.repeat(SESSION_ATTENDEE_POSITION_MAX_LENGTH + 1),
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects more than 500 attendees', () => {
    const attendees = Array.from({ length: SESSION_ATTENDEES_MAX + 1 }, (_, index) => ({
      listMemberId: `mem-${index}`,
    }));
    const result = registerSessionAttendeesRequestSchema.safeParse({ attendees });
    expect(result.success).toBe(false);
  });
});

describe('sessionAttendeesResponseSchema', () => {
  it('validates strict roster items without extra fields and accepts null ruc and representative', () => {
    const valid = sessionAttendeesResponseSchema.safeParse({
      sessionId: 'sess-1',
      stakeholderListId: 'list-1',
      attendeeCount: 1,
      items: [
        {
          listMemberId: 'mem-1',
          fullName: 'Ana Pérez',
          institution: 'Empresa SAC',
          ruc: null,
          representative: null,
          memberPosition: 'Analista',
          attended: true,
          position: 'Gerente',
        },
        {
          listMemberId: 'mem-2',
          fullName: 'Tech Amazonas SAC',
          institution: 'Tech Amazonas SAC',
          ruc: '20123456789',
          representative: 'Carlos Mendoza',
          memberPosition: 'Gerente',
          attended: false,
          position: null,
        },
      ],
    });
    expect(valid.success).toBe(true);

    const withExtra = sessionAttendeesResponseSchema.safeParse({
      sessionId: 'sess-1',
      stakeholderListId: 'list-1',
      attendeeCount: 1,
      items: [
        {
          listMemberId: 'mem-1',
          fullName: 'Ana Pérez',
          institution: null,
          ruc: null,
          representative: null,
          memberPosition: null,
          attended: false,
          position: null,
          email: 'ana@example.test',
        },
      ],
    });
    expect(withExtra.success).toBe(false);
  });
});
