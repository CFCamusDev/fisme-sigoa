import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export interface ActivationTokenSeedOptions {
  token: string;
  expiresAt?: string | Date;
  used?: boolean;
}

export interface SeedUserOptions {
  email: string;
  password?: string;
  names?: string;
  firstSurname?: string;
  secondSurname?: string | null;
  dni?: string | null;
  roles?: string[];
  status?: 'ACTIVE' | 'INACTIVE' | 'PENDING_ACTIVATION';
  failedLoginAttempts?: number;
  lockedUntil?: string | null;
  activationToken?: ActivationTokenSeedOptions;
}

export interface SeedStakeholderOptions {
  readonly id?: string;
  readonly kind: 'PERSON' | 'INSTITUTION';
  readonly fullName: string;
  readonly dni?: string | null;
  readonly ruc?: string | null;
  readonly email?: string | null;
  readonly mobile?: string | null;
  readonly position?: string | null;
  readonly institution?: string | null;
  readonly sector?: string | null;
  readonly graduationYear?: number | null;
  readonly cycle?: string | null;
  readonly status?: 'ACTIVE' | 'VOIDED';
}

export interface E2ESeeder {
  seedUser(options: SeedUserOptions): Promise<{ id: string; email: string }>;
  resetCatalog(): Promise<void>;
  seedCurrentCatalog(): Promise<void>;
  seedInValidationCatalogVersion(): Promise<void>;
  seedHistoricalCatalog(): Promise<void>;
  resetResolutions(): Promise<void>;
  seedResolution(options: { number: string; status: 'REGISTERED' | 'APPROVED' }): Promise<void>;
  resetTemplates(): Promise<void>;
  seedTemplate(options?: { withDraft?: boolean }): Promise<string>;
  resetStakeholders(): Promise<void>;
  seedStakeholder(options: SeedStakeholderOptions): Promise<string>;
  buildStakeholderImportFile(options: {
    listType: 'ADVISORY_BOARD' | 'EMPLOYER' | 'GRADUATE' | 'STUDENT' | 'TEACHER';
    rows: ReadonlyArray<ReadonlyArray<string | number | null>>;
  }): Promise<string>;
  countUsersBySurname(firstSurname: string): Promise<number>;
  close(): Promise<void>;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendSeederUrl = pathToFileURL(
  path.resolve(__dirname, '../../../backend/src/test/e2e/e2e-seeder.ts'),
).href;

let activeSeeder: E2ESeeder | null = null;

export async function initWorkerSeeder(databaseUrl: string): Promise<E2ESeeder> {
  if (activeSeeder) {
    await activeSeeder.close();
    activeSeeder = null;
  }
  const mod = (await import(backendSeederUrl)) as {
    createE2ESeeder: (url: string) => E2ESeeder;
  };
  activeSeeder = mod.createE2ESeeder(databaseUrl);
  return activeSeeder;
}

export function getWorkerSeeder(): E2ESeeder {
  if (!activeSeeder) {
    throw new Error('Falta inicializar el sembrador del worker E2E (workerStack).');
  }
  return activeSeeder;
}

export async function closeWorkerSeeder(): Promise<void> {
  if (activeSeeder) {
    const toClose = activeSeeder;
    activeSeeder = null;
    await toClose.close();
  }
}
