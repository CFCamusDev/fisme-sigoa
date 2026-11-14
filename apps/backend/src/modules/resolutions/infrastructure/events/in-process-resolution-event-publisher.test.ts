import { describe, expect, it, vi } from 'vitest';
import type { ResolutionApproved } from '../../domain/entities/resolution-approved.js';
import { InProcessResolutionEventPublisher } from './in-process-resolution-event-publisher.js';

const EVENT: ResolutionApproved = {
  resolutionId: 'r1',
  type: 'EDUCATIONAL_OBJECTIVE',
  catalogVersionId: 'v1',
  approvedBy: 'user-2',
  approvedAt: new Date('2026-11-14T09:00:00.000Z'),
};

describe('InProcessResolutionEventPublisher (D5)', () => {
  it('does nothing without subscribers', async () => {
    await expect(new InProcessResolutionEventPublisher().publish(EVENT)).resolves.toBeUndefined();
  });

  it('runs every subscriber in order with the same event', async () => {
    const calls: string[] = [];
    const first = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      calls.push('first');
    });
    const second = vi.fn(async () => {
      calls.push('second');
    });

    await new InProcessResolutionEventPublisher([first, second]).publish(EVENT);

    expect(calls).toEqual(['first', 'second']);
    expect(first).toHaveBeenCalledWith(EVENT);
    expect(second).toHaveBeenCalledWith(EVENT);
  });

  it('propagates a failing subscriber and skips the following ones', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('subscriber failed'));
    const following = vi.fn();

    await expect(
      new InProcessResolutionEventPublisher([failing, following]).publish(EVENT),
    ).rejects.toThrow('subscriber failed');

    expect(following).not.toHaveBeenCalled();
  });
});
