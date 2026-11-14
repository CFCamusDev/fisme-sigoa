import { describe, expect, it, vi } from 'vitest';
import { createCatalogResolutionApprovedSubscriber } from './catalog-resolution-approved-subscriber.js';

function setup() {
  const execute = vi.fn().mockResolvedValue({});
  return { execute, subscriber: createCatalogResolutionApprovedSubscriber({ execute }) };
}

const base = { resolutionId: 'r1', catalogVersionId: 'v2', approvedBy: 'user-1' };

describe('createCatalogResolutionApprovedSubscriber (T-016-03, RN-064)', () => {
  it('ignores improvement plan resolutions', async () => {
    const { execute, subscriber } = setup();
    await subscriber({ ...base, type: 'IMPROVEMENT_PLAN' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('ignores events without a version', async () => {
    const { execute, subscriber } = setup();
    await subscriber({ ...base, type: 'EDUCATIONAL_OBJECTIVE', catalogVersionId: null });
    expect(execute).not.toHaveBeenCalled();
  });

  it.each(['EDUCATIONAL_OBJECTIVE', 'GRADUATE_ATTRIBUTE'])(
    'activates the version for %s resolutions',
    async (type) => {
      const { execute, subscriber } = setup();
      await subscriber({ ...base, type });
      expect(execute).toHaveBeenCalledWith({
        actorId: 'user-1',
        versionId: 'v2',
        resolutionId: 'r1',
      });
    },
  );

  it('propagates a failed activation so the approval is rolled back', async () => {
    const { execute, subscriber } = setup();
    execute.mockRejectedValue(new Error('boom'));
    await expect(subscriber({ ...base, type: 'GRADUATE_ATTRIBUTE' })).rejects.toThrow('boom');
  });
});
