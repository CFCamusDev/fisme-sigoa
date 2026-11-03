import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearSessionHint,
  hasValidSessionHint,
  readSessionHint,
  setSessionHint,
} from './session-hint';

describe('session-hint (T-002-10, CA1)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('returns false when no session hint is stored', () => {
    expect(hasValidSessionHint()).toBe(false);
    expect(readSessionHint()).toBeNull();
  });

  it('stores and reads a valid future expiration date', () => {
    const futureDate = new Date(Date.now() + 60_000).toISOString();
    setSessionHint(futureDate);

    expect(readSessionHint()).toBe(futureDate);
    expect(hasValidSessionHint()).toBe(true);
  });

  it('returns false when the stored date has expired', () => {
    const pastDate = new Date(Date.now() - 5_000).toISOString();
    setSessionHint(pastDate);

    expect(hasValidSessionHint()).toBe(false);
  });

  it('returns false and clears storage when stored date is malformed', () => {
    localStorage.setItem('sigoa.session-hint', 'not-a-valid-date');

    expect(hasValidSessionHint()).toBe(false);
    expect(localStorage.getItem('sigoa.session-hint')).toBeNull();
  });

  it('clears the hint from localStorage', () => {
    setSessionHint(new Date(Date.now() + 60_000).toISOString());
    expect(hasValidSessionHint()).toBe(true);

    clearSessionHint();
    expect(hasValidSessionHint()).toBe(false);
    expect(readSessionHint()).toBeNull();
  });

  it('tolerates localStorage failures gracefully without throwing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage disabled');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage disabled');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('Storage disabled');
    });

    expect(() => setSessionHint('2026-12-01T00:00:00.000Z')).not.toThrow();
    expect(() => hasValidSessionHint()).not.toThrow();
    expect(hasValidSessionHint()).toBe(false);
    expect(() => clearSessionHint()).not.toThrow();
  });
});
