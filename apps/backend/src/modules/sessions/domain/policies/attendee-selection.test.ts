import { describe, expect, it } from 'vitest';
import { snapshotAttendees } from '../entities/attendee.js';
import { AttendeeNotInListError } from '../errors/attendee-not-in-list-error.js';
import { InvalidSessionDataError } from '../errors/invalid-session-data-error.js';
import { SessionWithoutListError } from '../errors/session-without-list-error.js';
import {
  SESSION_ATTENDEES_MAX,
  SESSION_ATTENDEE_POSITION_MAX_LENGTH,
  assertAttendeesInSessionList,
} from './attendee-selection.js';

describe('assertAttendeesInSessionList', () => {
  it('accepts members of the session list with their position', () => {
    const result = assertAttendeesInSessionList({
      sessionListId: 'list-1',
      entries: [
        { listMemberId: 'member-1', position: '  Gerente de TI  ' },
        { listMemberId: 'member-2', position: 'Jefe de Área' },
      ],
      listMembers: [
        { id: 'member-1', listId: 'list-1', fullName: 'Ana Pérez' },
        { id: 'member-2', listId: 'list-1', fullName: 'Luis Torres' },
      ],
    });

    expect(result).toEqual([
      { listMemberId: 'member-1', position: 'Gerente de TI' },
      { listMemberId: 'member-2', position: 'Jefe de Área' },
    ]);
  });

  it('rejects a member outside the session list', () => {
    expect(() =>
      assertAttendeesInSessionList({
        sessionListId: 'list-1',
        entries: [{ listMemberId: 'member-other', position: 'Director' }],
        listMembers: [{ id: 'member-other', listId: 'list-2', fullName: 'Carlos Ruiz' }],
      }),
    ).toThrow(AttendeeNotInListError);

    expect(() =>
      assertAttendeesInSessionList({
        sessionListId: 'list-1',
        entries: [{ listMemberId: 'member-missing', position: 'Director' }],
        listMembers: [],
      }),
    ).toThrow(AttendeeNotInListError);
  });

  it('rejects attendees when the session has no list', () => {
    expect(() =>
      assertAttendeesInSessionList({
        sessionListId: null,
        entries: [],
        listMembers: [],
      }),
    ).toThrow(SessionWithoutListError);
  });

  it('rejects repeated members', () => {
    expect(() =>
      assertAttendeesInSessionList({
        sessionListId: 'list-1',
        entries: [
          { listMemberId: 'member-1', position: 'Cargo A' },
          { listMemberId: 'member-1', position: 'Cargo B' },
        ],
        listMembers: [{ id: 'member-1', listId: 'list-1', fullName: 'Ana Pérez' }],
      }),
    ).toThrow(InvalidSessionDataError);
  });

  it('rejects more than 500 attendees', () => {
    const entries = Array.from({ length: SESSION_ATTENDEES_MAX + 1 }, (_, index) => ({
      listMemberId: `member-${index}`,
      position: null,
    }));

    expect(() =>
      assertAttendeesInSessionList({
        sessionListId: 'list-1',
        entries,
        listMembers: [],
      }),
    ).toThrow(InvalidSessionDataError);
  });

  it('normalizes an empty position to null', () => {
    const result = assertAttendeesInSessionList({
      sessionListId: 'list-1',
      entries: [
        { listMemberId: 'member-1', position: '   ' },
        { listMemberId: 'member-2', position: null },
        { listMemberId: 'member-3' },
      ],
      listMembers: [
        { id: 'member-1', listId: 'list-1', fullName: 'Ana Pérez' },
        { id: 'member-2', listId: 'list-1', fullName: 'Luis Torres' },
        { id: 'member-3', listId: 'list-1', fullName: 'María Gómez' },
      ],
    });

    expect(result).toEqual([
      { listMemberId: 'member-1', position: null },
      { listMemberId: 'member-2', position: null },
      { listMemberId: 'member-3', position: null },
    ]);
  });

  it('rejects a position exceeding 120 characters', () => {
    expect(() =>
      assertAttendeesInSessionList({
        sessionListId: 'list-1',
        entries: [
          {
            listMemberId: 'member-1',
            position: 'x'.repeat(SESSION_ATTENDEE_POSITION_MAX_LENGTH + 1),
          },
        ],
        listMembers: [{ id: 'member-1', listId: 'list-1', fullName: 'Ana Pérez' }],
      }),
    ).toThrow(InvalidSessionDataError);
  });
});

describe('snapshotAttendees', () => {
  it('sorts attendees deterministically by listMemberId', () => {
    const snapshot = snapshotAttendees([
      { listMemberId: 'member-b', position: 'Cargo B' },
      { listMemberId: 'member-a', position: null },
    ]);

    expect(snapshot).toEqual([
      { listMemberId: 'member-a', position: null },
      { listMemberId: 'member-b', position: 'Cargo B' },
    ]);
  });
});
