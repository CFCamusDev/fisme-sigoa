import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { createSession } from './create-session';
import { getExecutionSessions } from './get-execution-sessions';
import { getSessionAttendees } from './get-session-attendees';
import { registerSessionAttendees } from './register-session-attendees';
import { updateSession } from './update-session';
import {
  SAMPLE_SESSION_DTO,
  makeSessionAttendeesResponse,
  makeSessionsResponse,
} from '../test/sessions-fixtures';

describe('sessions API client (HU-032, T-032-15)', () => {
  it('parses the created session', async () => {
    server.use(
      http.post('*/sessions', () => HttpResponse.json(SAMPLE_SESSION_DTO, { status: 201 })),
    );

    const dto = await createSession({
      stakeholderType: 'EMPLOYER',
      stakeholderListId: 'list-1',
      sessionDate: '2026-11-20',
      startTime: '10:00',
      modality: 'VIRTUAL',
      meetingUrl: 'https://meet.example.com/emp-2026',
      recordingUrl: 'https://drive.example.com/emp-2026',
      executionIds: ['exec-1', 'exec-2', 'exec-3'],
    });

    expect(dto).toEqual(SAMPLE_SESSION_DTO);
  });

  it('parses the updated session', async () => {
    const updated = { ...SAMPLE_SESSION_DTO, startTime: '11:30' };
    server.use(http.patch('*/sessions/sess-1', () => HttpResponse.json(updated, { status: 200 })));

    const dto = await updateSession({ id: 'sess-1', data: { startTime: '11:30' } });
    expect(dto.startTime).toBe('11:30');
  });

  it('parses the paginated list of an execution', async () => {
    server.use(
      http.get('*/process-executions/exec-1/sessions', () =>
        HttpResponse.json(makeSessionsResponse(), { status: 200 }),
      ),
    );

    const response = await getExecutionSessions('exec-1', { page: 1, pageSize: 20 });
    expect(response.total).toBe(1);
    expect(response.items).toEqual([SAMPLE_SESSION_DTO]);
  });

  it('rejects a response that does not match the contract', async () => {
    server.use(
      http.post('*/sessions', () => HttpResponse.json({ invalid: true }, { status: 201 })),
    );

    await expect(
      createSession({
        stakeholderType: 'EMPLOYER',
        sessionDate: '2026-11-20',
        startTime: '10:00',
        modality: 'IN_PERSON',
        executionIds: ['exec-1'],
      }),
    ).rejects.toThrow();
  });

  it('parses the session attendees roster', async () => {
    const payload = makeSessionAttendeesResponse();
    server.use(
      http.get('*/sessions/sess-1/attendees', () => HttpResponse.json(payload, { status: 200 })),
    );

    const response = await getSessionAttendees('sess-1');
    expect(response).toEqual(payload);
  });

  it('parses the registered session attendees response', async () => {
    const payload = makeSessionAttendeesResponse();
    server.use(
      http.put('*/sessions/sess-1/attendees', () => HttpResponse.json(payload, { status: 200 })),
    );

    const response = await registerSessionAttendees({
      sessionId: 'sess-1',
      data: { attendees: [{ listMemberId: 'mem-1', position: 'Gerente de TI' }] },
    });
    expect(response).toEqual(payload);
  });

  it('rejects an invalid session attendees payload', async () => {
    server.use(
      http.get('*/sessions/sess-1/attendees', () =>
        HttpResponse.json({ sessionId: 'sess-1', invalid: true }, { status: 200 }),
      ),
    );

    await expect(getSessionAttendees('sess-1')).rejects.toThrow();
  });
});
