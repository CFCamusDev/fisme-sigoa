import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/lib/axios';
import {
  SAMPLE_CURRENT_COMMITTEE,
  makeCommitteeListResponse,
  makeCurrentCommitteeResponse,
} from '../test/quality-committee-fixtures';
import { getCurrentQualityCommittee } from './get-current-quality-committee';
import { listQualityCommittees } from './list-quality-committees';
import { registerQualityCommittee } from './register-quality-committee';
import { replaceCommitteeMembers } from './replace-committee-members';

describe('quality-committee API client (T-025-17)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses GET /quality-committees/current response', async () => {
    const payload = makeCurrentCommitteeResponse({
      actorMembership: { memberId: 'mem-1', position: 'PRESIDENT' },
      alerts: [{ userId: 'usr-old', fullName: 'Pedro Salas' }],
    });
    const spy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: payload });

    const result = await getCurrentQualityCommittee();

    expect(spy).toHaveBeenCalledWith('/quality-committees/current');
    expect(result).toEqual(payload);
  });

  it('parses GET /quality-committees paginated response', async () => {
    const payload = makeCommitteeListResponse();
    const spy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: payload });

    const result = await listQualityCommittees({ page: 2, pageSize: 20 });

    expect(spy).toHaveBeenCalledWith('/quality-committees', {
      params: { page: 2, pageSize: 20 },
    });
    expect(result).toEqual(payload);
  });

  it('parses POST /quality-committees and PUT /quality-committees/:id/members responses', async () => {
    const postSpy = vi
      .spyOn(apiClient, 'post')
      .mockResolvedValueOnce({ data: SAMPLE_CURRENT_COMMITTEE });
    const putSpy = vi
      .spyOn(apiClient, 'put')
      .mockResolvedValueOnce({ data: SAMPLE_CURRENT_COMMITTEE });

    const created = await registerQualityCommittee({
      periodStart: '2027-01-01',
      periodEnd: '2027-12-31',
      members: [{ fullName: 'Ana Torres', degree: 'Dr.', position: 'PRESIDENT' }],
    });
    expect(postSpy).toHaveBeenCalledWith('/quality-committees', expect.any(Object));
    expect(created.id).toBe('com-2027');

    const updated = await replaceCommitteeMembers({
      committeeId: 'com-2027',
      body: { members: [{ fullName: 'Ana Torres', degree: 'Dr.', position: 'PRESIDENT' }] },
    });
    expect(putSpy).toHaveBeenCalledWith('/quality-committees/com-2027/members', expect.any(Object));
    expect(updated.id).toBe('com-2027');
  });

  it('rejects malformed payloads against the shared schema', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: { invalid: true } });

    await expect(getCurrentQualityCommittee()).rejects.toThrow();
  });
});
