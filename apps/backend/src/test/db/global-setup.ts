import { dropWorkerDatabases, prepareWorkerDatabases } from './prepare-test-database.js';

export async function setup(): Promise<void> {
  await prepareWorkerDatabases();
}

export async function teardown(): Promise<void> {
  await dropWorkerDatabases();
}
