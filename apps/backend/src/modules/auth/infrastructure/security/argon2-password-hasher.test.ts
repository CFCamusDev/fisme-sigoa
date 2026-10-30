import { describe, expect, it } from 'vitest';
import { Argon2PasswordHasher } from './argon2-password-hasher.js';

describe('Argon2PasswordHasher (RNF-002)', () => {
  const hasher = new Argon2PasswordHasher();

  it('hashes with argon2id and verifies the plain password', async () => {
    const password = 'SuperSecretPassword123!';
    const hash = await hasher.hash(password);

    expect(hash).toBeDefined();
    expect(hash.startsWith('$argon2id$')).toBe(true);

    const isValid = await hasher.verify(password, hash);
    expect(isValid).toBe(true);
  }, 5_000);

  it('rejects a wrong password', async () => {
    const hash = await hasher.hash('CorrectPassword123');
    const isValid = await hasher.verify('WrongPassword123', hash);

    expect(isValid).toBe(false);
  }, 5_000);

  it('handles invalid or malformed hash returning false safely', async () => {
    const isValid = await hasher.verify('SomePassword123', 'not-a-valid-argon2-hash');
    expect(isValid).toBe(false);
  }, 5_000);

  it('produces a different hash each time due to salting', async () => {
    const password = 'IdenticalPassword123';
    const hash1 = await hasher.hash(password);
    const hash2 = await hasher.hash(password);

    expect(hash1).not.toBe(hash2);
    expect(await hasher.verify(password, hash1)).toBe(true);
    expect(await hasher.verify(password, hash2)).toBe(true);
  }, 5_000);

  it('verifies against a dummy hash for unknown users to prevent timing attacks', async () => {
    const isValid = await hasher.verifyDummy('AnyAttemptedPassword123');
    expect(isValid).toBe(false);
  }, 5_000);

  it('never contains the plain password in the generated hash', async () => {
    const plain = 'ClearTextSecretString999';
    const hash = await hasher.hash(plain);

    expect(hash).not.toContain(plain);
  }, 5_000);
});
