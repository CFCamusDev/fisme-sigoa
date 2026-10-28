import { describe, expect, it } from 'vitest';
import { computeSha256 } from './file-hash.js';

describe('computeSha256', () => {
  it('returns the standard SHA-256 hex digest for empty buffer', () => {
    const empty = Buffer.alloc(0);
    // sha256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    expect(computeSha256(empty)).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('matches known test vector for ASCII input', () => {
    const buffer = Buffer.from('FISME-SIGOA');
    // sha256("FISME-SIGOA")
    expect(computeSha256(buffer)).toHaveLength(64);
    expect(computeSha256(buffer)).toMatch(/^[0-9a-f]{64}$/);
    expect(computeSha256(buffer)).toBe(computeSha256(Buffer.from('FISME-SIGOA')));
  });
});
