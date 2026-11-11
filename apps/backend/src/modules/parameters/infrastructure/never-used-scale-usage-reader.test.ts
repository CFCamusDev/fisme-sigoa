import { describe, expect, it } from 'vitest';
import { NeverUsedScaleUsageReader } from './never-used-scale-usage-reader.js';

describe('NeverUsedScaleUsageReader (provisional adapter, D4)', () => {
  it('reports every scale as not in use until surveys exist', async () => {
    const reader = new NeverUsedScaleUsageReader();

    await expect(reader.isInUse('scale-1')).resolves.toBe(false);
    await expect(reader.isInUse('another-scale')).resolves.toBe(false);
  });
});
