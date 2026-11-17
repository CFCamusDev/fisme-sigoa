import { getWorkerSeeder, type SeedStakeholderOptions } from './seeder';

export async function resetStakeholders(): Promise<void> {
  await getWorkerSeeder().resetStakeholders();
}

export async function seedStakeholder(options: SeedStakeholderOptions): Promise<string> {
  return getWorkerSeeder().seedStakeholder(options);
}

export async function buildStakeholderImportFile(options: {
  listType: 'ADVISORY_BOARD' | 'EMPLOYER' | 'GRADUATE' | 'STUDENT' | 'TEACHER';
  rows: ReadonlyArray<ReadonlyArray<string | number | null>>;
}): Promise<Buffer> {
  const base64 = await getWorkerSeeder().buildStakeholderImportFile(options);
  return Buffer.from(base64, 'base64');
}
