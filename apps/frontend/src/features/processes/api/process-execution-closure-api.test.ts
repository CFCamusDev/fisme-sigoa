import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { closeProcessExecution } from './close-process-execution';
import { voidProcessExecution } from './void-process-execution';

const SAMPLE_CLOSE_RESPONSE = {
  executionId: 'exec-1',
  previousStatus: 'PENDING_APPROVAL',
  status: 'CLOSED',
  updatedAt: '2027-03-01T10:00:00.000Z',
};

const SAMPLE_VOID_RESPONSE = {
  executionId: 'exec-1',
  previousStatus: 'IN_PROGRESS',
  status: 'VOIDED',
  voidReason: 'Ejecución duplicada por error',
  updatedAt: '2027-03-01T10:00:00.000Z',
};

describe('process execution closure API client (HU-030, T-030-08)', () => {
  it('sends the close request without body', async () => {
    let rawBody = 'uninitialized';
    server.use(
      http.post('*/process-executions/exec-1/close', async ({ request }) => {
        rawBody = await request.text();
        return HttpResponse.json(SAMPLE_CLOSE_RESPONSE);
      }),
    );

    const response = await closeProcessExecution('exec-1');
    expect(rawBody).toBe('');
    expect(response).toEqual(SAMPLE_CLOSE_RESPONSE);
  });

  it('sends the void reason', async () => {
    let sentBody: unknown = null;
    server.use(
      http.post('*/process-executions/exec-1/void', async ({ request }) => {
        sentBody = await request.json();
        return HttpResponse.json(SAMPLE_VOID_RESPONSE);
      }),
    );

    const response = await voidProcessExecution('exec-1', {
      reason: 'Ejecución duplicada por error',
    });
    expect(sentBody).toEqual({ reason: 'Ejecución duplicada por error' });
    expect(response).toEqual(SAMPLE_VOID_RESPONSE);
  });

  it('rejects a response that does not match the schema', async () => {
    server.use(
      http.post('*/process-executions/exec-1/close', () => HttpResponse.json({ unexpected: true })),
      http.post('*/process-executions/exec-1/void', () => HttpResponse.json({ unexpected: true })),
    );

    await expect(closeProcessExecution('exec-1')).rejects.toThrow();
    await expect(voidProcessExecution('exec-1', { reason: 'Motivo' })).rejects.toThrow();
  });
});
