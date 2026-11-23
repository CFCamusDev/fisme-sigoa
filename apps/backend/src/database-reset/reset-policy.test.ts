import { describe, expect, it } from 'vitest';
import {
  DatabaseResetRefusedError,
  decideDatabaseReset,
  extractDatabaseName,
} from './reset-policy.js';

describe('reset-policy (HU-081, T-081-34)', () => {
  it('skips when the flag is absent, empty or false', () => {
    expect(decideDatabaseReset({})).toEqual({ action: 'SKIP' });
    expect(decideDatabaseReset({ resetOnDeploy: '' })).toEqual({ action: 'SKIP' });
    expect(decideDatabaseReset({ resetOnDeploy: 'false' })).toEqual({ action: 'SKIP' });
  });

  it('rejects any other flag value', () => {
    for (const badValue of ['TRUE', '1', 'yes', 'on']) {
      expect(() =>
        decideDatabaseReset({
          resetOnDeploy: badValue,
          resetConfirm: 'sigoa_staging',
          databaseName: 'sigoa_staging',
          appPublicUrl: 'https://staging.sigoa.example.edu.pe',
        }),
      ).toThrow(DatabaseResetRefusedError);
    }
  });

  it('requires the confirmation to match the database name', () => {
    expect(() =>
      decideDatabaseReset({
        resetOnDeploy: 'true',
        resetConfirm: 'otra_base',
        databaseName: 'sigoa_staging',
        appPublicUrl: 'https://staging.sigoa.example.edu.pe',
      }),
    ).toThrow(/sigoa_staging/);

    expect(() =>
      decideDatabaseReset({
        resetOnDeploy: 'true',
        resetConfirm: '',
        databaseName: 'sigoa_staging',
        appPublicUrl: 'https://staging.sigoa.example.edu.pe',
      }),
    ).toThrow(DatabaseResetRefusedError);
  });

  it('accepts staging hosts and localhost', () => {
    for (const url of [
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'https://staging.sigoa.untrm.edu.pe',
      'https://sigoa-stg.untrm.edu.pe',
      'https://qa.sigoa.pe',
      'https://preview.sigoa.pe',
    ]) {
      expect(
        decideDatabaseReset({
          resetOnDeploy: 'true',
          resetConfirm: 'sigoa_staging',
          databaseName: 'sigoa_staging',
          appPublicUrl: url,
        }),
      ).toEqual({ action: 'RESET', databaseName: 'sigoa_staging' });
    }
  });

  it('rejects production and unknown hosts and a missing url', () => {
    for (const url of [
      undefined,
      '',
      'not-a-url',
      'https://sigoa.untrm.edu.pe',
      'https://prod.sigoa.untrm.edu.pe',
      'ftp://staging.sigoa.pe',
    ]) {
      expect(() =>
        decideDatabaseReset({
          resetOnDeploy: 'true',
          resetConfirm: 'sigoa_staging',
          databaseName: 'sigoa_staging',
          appPublicUrl: url,
        }),
      ).toThrow(DatabaseResetRefusedError);
    }
  });

  it('reads the database name from the connection string', () => {
    expect(
      extractDatabaseName(
        'postgresql://postgres:secret@db.internal:5432/sigoa_staging?schema=public',
      ),
    ).toBe('sigoa_staging');

    expect(
      decideDatabaseReset({
        resetOnDeploy: 'true',
        resetConfirm: 'sigoa_staging',
        databaseUrl: 'postgresql://postgres:secret@localhost:5432/sigoa_staging?schema=public',
        appPublicUrl: 'http://localhost:5173',
      }),
    ).toEqual({ action: 'RESET', databaseName: 'sigoa_staging' });

    expect(() => extractDatabaseName('not-a-valid-url')).toThrow(DatabaseResetRefusedError);
  });
});
