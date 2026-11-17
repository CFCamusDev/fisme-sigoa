import { describe, expect, it } from 'vitest';
import { Session } from './session.js';
import { SESSION_URL_MAX } from './session-modality.js';
import { InvalidSessionDataError } from '../errors/invalid-session-data-error.js';
import { SessionExecutionNotOpenError } from '../errors/session-execution-not-open-error.js';
import { SessionStakeholderListMismatchError } from '../errors/session-stakeholder-list-mismatch-error.js';
import type { SessionProcessExecutionRef } from '../policies/session-execution-rule.js';

const NOW = new Date('2026-11-17T15:00:00.000Z');
const OPEN_EXECUTIONS: readonly SessionProcessExecutionRef[] = [
  { id: 'exec-1', name: 'Revisión OE 2026', status: 'PLANNED' },
];

describe('Session', () => {
  it('requires at least one execution', () => {
    expect(() =>
      Session.create({
        id: 'sess-1',
        stakeholderType: 'EMPLOYER',
        sessionDate: '2026-11-20',
        startTime: '10:00',
        modality: 'IN_PERSON',
        executions: [],
        actorId: 'user-1',
        now: NOW,
      }),
    ).toThrow(InvalidSessionDataError);
  });

  it('links one session to three executions', () => {
    const executions: SessionProcessExecutionRef[] = [
      { id: 'exec-3', name: 'Medición indirecta AG 2026', status: 'IN_PROGRESS' },
      { id: 'exec-1', name: 'Revisión OE 2026', status: 'PLANNED' },
      { id: 'exec-2', name: 'Medición OE 2026', status: 'IN_PROGRESS' },
    ];

    const session = Session.create({
      id: 'sess-1',
      stakeholderType: 'EMPLOYER',
      sessionDate: '2026-11-20',
      startTime: '10:00',
      modality: 'IN_PERSON',
      executions,
      actorId: 'user-1',
      now: NOW,
    });

    expect(session.executionIds).toEqual(['exec-3', 'exec-1', 'exec-2']);
  });

  it('requires meeting and recording links when virtual', () => {
    expect(() =>
      Session.create({
        id: 'sess-1',
        stakeholderType: 'EMPLOYER',
        sessionDate: '2026-11-20',
        startTime: '10:00',
        modality: 'VIRTUAL',
        meetingUrl: 'https://meet.example.com/abc',
        recordingUrl: null,
        executions: OPEN_EXECUTIONS,
        actorId: 'user-1',
        now: NOW,
      }),
    ).toThrow(InvalidSessionDataError);

    expect(() =>
      Session.create({
        id: 'sess-1',
        stakeholderType: 'EMPLOYER',
        sessionDate: '2026-11-20',
        startTime: '10:00',
        modality: 'VIRTUAL',
        meetingUrl: null,
        recordingUrl: 'https://drive.example.com/rec',
        executions: OPEN_EXECUTIONS,
        actorId: 'user-1',
        now: NOW,
      }),
    ).toThrow(InvalidSessionDataError);
  });

  it('does not require links for an in-person session', () => {
    const session = Session.create({
      id: 'sess-1',
      stakeholderType: 'GRADUATE',
      sessionDate: '2026-11-20',
      startTime: '18:30',
      modality: 'IN_PERSON',
      executions: OPEN_EXECUTIONS,
      actorId: 'user-1',
      now: NOW,
    });

    expect(session.modality).toBe('IN_PERSON');
    expect(session.meetingUrl).toBeNull();
    expect(session.recordingUrl).toBeNull();
  });

  it('rejects a link that is not http or https', () => {
    expect(() =>
      Session.create({
        id: 'sess-1',
        stakeholderType: 'EMPLOYER',
        sessionDate: '2026-11-20',
        startTime: '10:00',
        modality: 'HYBRID',
        meetingUrl: 'javascript:alert(1)',
        executions: OPEN_EXECUTIONS,
        actorId: 'user-1',
        now: NOW,
      }),
    ).toThrow(InvalidSessionDataError);
  });

  it('rejects a link over 500 characters', () => {
    const longUrl = `https://example.com/${'a'.repeat(SESSION_URL_MAX)}`;
    expect(() =>
      Session.create({
        id: 'sess-1',
        stakeholderType: 'EMPLOYER',
        sessionDate: '2026-11-20',
        startTime: '10:00',
        modality: 'HYBRID',
        recordingUrl: longUrl,
        executions: OPEN_EXECUTIONS,
        actorId: 'user-1',
        now: NOW,
      }),
    ).toThrow(InvalidSessionDataError);
  });

  it('rejects a stakeholder list of another type', () => {
    expect(() =>
      Session.create({
        id: 'sess-1',
        stakeholderType: 'EMPLOYER',
        stakeholderList: { id: 'list-1', type: 'GRADUATE' },
        sessionDate: '2026-11-20',
        startTime: '10:00',
        modality: 'IN_PERSON',
        executions: OPEN_EXECUTIONS,
        actorId: 'user-1',
        now: NOW,
      }),
    ).toThrow(SessionStakeholderListMismatchError);
  });

  it('rejects an execution that is not PLANNED or IN_PROGRESS', () => {
    expect(() =>
      Session.create({
        id: 'sess-1',
        stakeholderType: 'EMPLOYER',
        sessionDate: '2026-11-20',
        startTime: '10:00',
        modality: 'IN_PERSON',
        executions: [{ id: 'exec-1', name: 'Revisión OE 2026', status: 'CLOSED' }],
        actorId: 'user-1',
        now: NOW,
      }),
    ).toThrow(SessionExecutionNotOpenError);
  });

  it('rejects duplicated executions', () => {
    expect(() =>
      Session.create({
        id: 'sess-1',
        stakeholderType: 'EMPLOYER',
        sessionDate: '2026-11-20',
        startTime: '10:00',
        modality: 'IN_PERSON',
        executions: [
          { id: 'exec-1', name: 'Revisión OE 2026', status: 'PLANNED' },
          { id: 'exec-1', name: 'Revisión OE 2026', status: 'PLANNED' },
        ],
        actorId: 'user-1',
        now: NOW,
      }),
    ).toThrow(InvalidSessionDataError);
  });

  it('rejects a malformed time', () => {
    expect(() =>
      Session.create({
        id: 'sess-1',
        stakeholderType: 'EMPLOYER',
        sessionDate: '2026-11-20',
        startTime: '25:00',
        modality: 'IN_PERSON',
        executions: OPEN_EXECUTIONS,
        actorId: 'user-1',
        now: NOW,
      }),
    ).toThrow(InvalidSessionDataError);
  });

  it('rejects a date out of range', () => {
    expect(() =>
      Session.create({
        id: 'sess-1',
        stakeholderType: 'EMPLOYER',
        sessionDate: '1999-12-31',
        startTime: '10:00',
        modality: 'IN_PERSON',
        executions: OPEN_EXECUTIONS,
        actorId: 'user-1',
        now: NOW,
      }),
    ).toThrow(InvalidSessionDataError);

    expect(() =>
      Session.create({
        id: 'sess-1',
        stakeholderType: 'EMPLOYER',
        sessionDate: '2026-02-30',
        startTime: '10:00',
        modality: 'IN_PERSON',
        executions: OPEN_EXECUTIONS,
        actorId: 'user-1',
        now: NOW,
      }),
    ).toThrow(InvalidSessionDataError);
  });

  it('normalizes spaces', () => {
    const session = Session.create({
      id: 'sess-1',
      stakeholderType: 'EMPLOYER',
      sessionDate: '  2026-11-20  ',
      startTime: ' 09:30 ',
      modality: 'VIRTUAL',
      meetingUrl: '  https://meet.example.com/room  ',
      recordingUrl: '  https://drive.example.com/video  ',
      executions: OPEN_EXECUTIONS,
      actorId: 'user-1',
      now: NOW,
    });

    expect(session.sessionDate).toBe('2026-11-20');
    expect(session.startTime).toBe('09:30');
    expect(session.meetingUrl).toBe('https://meet.example.com/room');
    expect(session.recordingUrl).toBe('https://drive.example.com/video');
  });

  it('applyChanges revalidates the virtual rule on the resulting state', () => {
    const session = Session.create({
      id: 'sess-1',
      stakeholderType: 'EMPLOYER',
      sessionDate: '2026-11-20',
      startTime: '10:00',
      modality: 'IN_PERSON',
      executions: OPEN_EXECUTIONS,
      actorId: 'user-1',
      now: NOW,
    });

    expect(() =>
      session.applyChanges({
        modality: 'VIRTUAL',
        actorId: 'user-2',
        now: new Date('2026-11-18T10:00:00.000Z'),
      }),
    ).toThrow(InvalidSessionDataError);

    const updated = session.applyChanges({
      modality: 'VIRTUAL',
      meetingUrl: 'https://meet.example.com/room',
      recordingUrl: 'https://drive.example.com/video',
      actorId: 'user-2',
      now: new Date('2026-11-18T10:00:00.000Z'),
    });

    expect(updated.modality).toBe('VIRTUAL');
    expect(updated.updatedBy).toBe('user-2');
  });

  it('snapshot has sorted execution ids and no personal data', () => {
    const session = Session.create({
      id: 'sess-1',
      stakeholderType: 'EMPLOYER',
      stakeholderList: { id: 'list-1', type: 'EMPLOYER' },
      sessionDate: '2026-11-20',
      startTime: '10:00',
      modality: 'VIRTUAL',
      meetingUrl: 'https://meet.example.com/room',
      recordingUrl: 'https://drive.example.com/video',
      executions: [
        { id: 'exec-b', name: 'B', status: 'PLANNED' },
        { id: 'exec-a', name: 'A', status: 'IN_PROGRESS' },
      ],
      actorId: 'user-1',
      now: NOW,
    });

    const snap = session.snapshot();
    expect(snap).toEqual({
      id: 'sess-1',
      stakeholderType: 'EMPLOYER',
      stakeholderListId: 'list-1',
      sessionDate: '2026-11-20',
      startTime: '10:00',
      modality: 'VIRTUAL',
      meetingUrl: 'https://meet.example.com/room',
      recordingUrl: 'https://drive.example.com/video',
      executionIds: ['exec-a', 'exec-b'],
    });
    expect(Object.keys(snap)).not.toContain('createdBy');
    expect(Object.keys(snap)).not.toContain('actorId');
  });
});
