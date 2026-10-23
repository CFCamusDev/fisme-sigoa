import { describe, it, expect } from 'vitest';
import { ReferenceItem } from './entities/reference-item.js';

describe('ReferenceItem Domain Entity', () => {
  it('rejects an empty code or title', () => {
    expect(() =>
      ReferenceItem.create({
        code: '',
        title: 'Valid Title',
      }),
    ).toThrow(/code.*empty/i);

    expect(() =>
      ReferenceItem.create({
        code: 'REF-001',
        title: '   ',
      }),
    ).toThrow(/title.*empty/i);
  });

  it('creates an item in DRAFT status', () => {
    const item = ReferenceItem.create({
      code: 'REF-001',
      title: 'Valid Reference Item',
    });

    expect(item.id).toBeDefined();
    expect(item.code).toBe('REF-001');
    expect(item.title).toBe('Valid Reference Item');
    expect(item.status).toBe('DRAFT');
    expect(item.createdAt).toBeInstanceOf(Date);
  });
});
