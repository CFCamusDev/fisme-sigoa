import { prepareTestDatabase } from './prepare-test-database.js';

export async function setup(): Promise<void> {
  await prepareTestDatabase();
}
