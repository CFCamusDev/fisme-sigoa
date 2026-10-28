import { useTestDatabase } from './test/db/use-test-database.js';

export function runSampleTest(): void {
  useTestDatabase();
}
