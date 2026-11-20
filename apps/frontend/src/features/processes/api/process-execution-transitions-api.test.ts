import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { advanceProcessExecution } from './advance-process-execution';
import { getNextTransition } from './get-next-transition';

const SAMPLE_NEXT_TRANSITION = {
  executionId: 'exec-1',
  status: 'PLANNED',
  nextStatus: 'IN_PROGRESS',
  preconditions: [
    {
      code: 'SCHEDULE_HAS_ACTIVITY',
      label: 'El cronograma tiene al menos una actividad registrada',
      state: 'MET',
    },
  ],
  canAdvance: true,
};

const SAMPLE_ADVANCE_RESPONSE = {
  executionId: 'exec-1',
  previousStatus: 'PLANNED',
  status: 'IN_PROGRESS',
  updatedAt: '2027-03-01T10:00:00.000Z',
};

describe('process execution transitions API client (HU-029, T-029-06)', () => {
  it('parses the next transition response', async () => {
    server.use(
      http.get('*/process-executions/exec-1/next-transition', () =>
        HttpResponse.json(SAMPLE_NEXT_TRANSITION),
      ),
    );

    const response = await getNextTransition('exec-1');
    expect(response).toEqual(SAMPLE_NEXT_TRANSITION);
  });

  it('sends the advance request without body', async () => {
    let rawBody = 'uninitialized';
    server.use(
      http.post('*/process-executions/exec-1/advance', async ({ request }) => {
        rawBody = await request.text();
        return HttpResponse.json(SAMPLE_ADVANCE_RESPONSE);
      }),
    );

    const response = await advanceProcessExecution('exec-1');
    expect(rawBody).toBe('');
    expect(response).toEqual(SAMPLE_ADVANCE_RESPONSE);
  });

  it('rejects a response that does not match the schema', async () => {
    server.use(
      http.get('*/process-executions/exec-1/next-transition', () =>
        HttpResponse.json({ unexpected: true }),
      ),
    );

    await expect(getNextTransition('exec-1')).rejects.toThrow();
  });
});
