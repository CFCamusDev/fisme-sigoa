import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { createProcessExecution } from './create-process-execution';
import { getProcessExecutions } from './get-process-executions';
import {
  SAMPLE_PROCESS_EXECUTION_DTO,
  makeProcessExecutionsResponse,
} from '../test/process-executions-fixtures';

describe('process-executions api (HU-027, T-027-12)', () => {
  it('parses the created execution', async () => {
    server.use(
      http.post('*/process-executions', () =>
        HttpResponse.json(SAMPLE_PROCESS_EXECUTION_DTO, { status: 201 }),
      ),
    );

    const result = await createProcessExecution({
      type: 'P612',
      year: 2027,
      catalogVersionId: 'cv-approved-1',
    });

    expect(result).toEqual(SAMPLE_PROCESS_EXECUTION_DTO);
  });

  it('parses the paginated list', async () => {
    const payload = makeProcessExecutionsResponse([SAMPLE_PROCESS_EXECUTION_DTO], {
      page: 2,
      pageSize: 10,
      total: 15,
      totalPages: 2,
    });

    server.use(http.get('*/process-executions', () => HttpResponse.json(payload)));

    const result = await getProcessExecutions({ page: 2, pageSize: 10 });
    expect(result).toEqual(payload);
  });

  it('rejects a response that does not match the contract', async () => {
    server.use(
      http.get('*/process-executions', () => HttpResponse.json({ items: [{ invalid: true }] })),
    );

    await expect(getProcessExecutions()).rejects.toThrow();
  });
});
