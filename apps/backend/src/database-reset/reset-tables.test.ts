import { describe, expect, it } from 'vitest';
import {
  PRESERVED_TABLES,
  RESET_TABLES,
  SYSTEM_IGNORED_TABLES,
  findUnregisteredTables,
} from './reset-tables.js';

describe('reset-tables (HU-081, T-081-34)', () => {
  it('has no table in both lists', () => {
    const preserved = new Set<string>(PRESERVED_TABLES);
    const reset = new Set<string>(RESET_TABLES);
    const ignored = new Set<string>(SYSTEM_IGNORED_TABLES);

    for (const table of RESET_TABLES) {
      expect(preserved.has(table)).toBe(false);
      expect(ignored.has(table)).toBe(false);
    }
    for (const table of PRESERVED_TABLES) {
      expect(reset.has(table)).toBe(false);
      expect(ignored.has(table)).toBe(false);
    }
  });

  it('finds unregistered tables', () => {
    expect(
      findUnregisteredTables(['users', 'audit_logs', '_prisma_migrations', 'new_future_table']),
    ).toEqual(['new_future_table']);
    expect(findUnregisteredTables([...PRESERVED_TABLES, ...RESET_TABLES])).toEqual([]);
  });
});
