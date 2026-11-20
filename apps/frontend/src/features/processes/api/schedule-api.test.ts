import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { getSchedule } from './get-schedule';
import { saveSchedule } from './save-schedule';

const SAMPLE_ACTIVITY = {
  id: 'act-1',
  processExecutionId: 'exec-1',
  number: 1,
  activity: 'Elaborar cronograma',
  responsible: 'Presidente',
  goal: 'Anexo 1',
  indicator: null,
  startDate: '2027-03-01',
  endDate: '2027-03-15',
  status: 'PENDING',
  actualEndDate: null,
  isOverdue: false,
  createdAt: '2027-03-01T10:00:00.000Z',
  updatedAt: '2027-03-01T10:00:00.000Z',
};

describe('schedule API client (HU-028, T-028-13)', () => {
  it('parses the schedule response', async () => {
    server.use(
      http.get('*/process-executions/exec-1/schedule', () =>
        HttpResponse.json({ items: [SAMPLE_ACTIVITY] }),
      ),
    );

    const response = await getSchedule('exec-1');
    expect(response.items).toHaveLength(1);
    expect(response.items[0]?.id).toBe('act-1');
  });

  it('sends the PUT body unchanged', async () => {
    let receivedBody: unknown = null;
    server.use(
      http.put('*/process-executions/exec-1/schedule', async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({ items: [SAMPLE_ACTIVITY] });
      }),
    );

    const body = {
      activities: [
        {
          activity: 'Elaborar cronograma',
          responsible: 'Presidente',
          goal: 'Anexo 1',
          indicator: null,
          startDate: '2027-03-01',
          endDate: '2027-03-15',
        },
      ],
    };

    await saveSchedule('exec-1', body);
    expect(receivedBody).toEqual(body);
  });

  it('rejects a response that does not match the schema', async () => {
    server.use(
      http.get('*/process-executions/exec-1/schedule', () =>
        HttpResponse.json({ items: [{ id: 'bad' }] }),
      ),
    );

    await expect(getSchedule('exec-1')).rejects.toThrow();
  });
});
