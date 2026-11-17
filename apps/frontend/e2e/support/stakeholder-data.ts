import { getWorkerSeeder, type SeedStakeholderOptions } from './seeder';

export async function resetStakeholders(): Promise<void> {
  await getWorkerSeeder().resetStakeholders();
}

export async function seedStakeholder(options: SeedStakeholderOptions): Promise<string> {
  return getWorkerSeeder().seedStakeholder(options);
}
