import { createPrismaClient } from '../../shared/prisma/prisma-client.js';
import { assertTestDatabase, getTestDatabaseUrl } from '../db/assert-test-database.js';
import { Argon2PasswordHasher } from '../../modules/auth/infrastructure/security/argon2-password-hasher.js';
import { seedAuthorization } from '../../modules/authorization/infrastructure/prisma/seed/authorization-seed.js';

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
}

export async function seedE2EUser(
  options: SeedUserOptions,
): Promise<{ id: string; email: string }> {
  const dbUrl = assertTestDatabase(getTestDatabaseUrl());
  const { prisma, disconnect } = createPrismaClient(dbUrl);

  try {
    const hasher = new Argon2PasswordHasher();
    const password = options.password ?? 'Password123!';
    const passwordHash = await hasher.hash(password);

    const user = await prisma.user.upsert({
      where: { email: options.email.toLowerCase() },
      create: {
        email: options.email.toLowerCase(),
        names: options.names ?? 'Usuario',
        firstSurname: options.firstSurname ?? 'Prueba',
        secondSurname: options.secondSurname ?? null,
        dni: options.dni ?? null,
        passwordHash,
        status: options.status ?? 'ACTIVE',
        failedLoginAttempts: options.failedLoginAttempts ?? 0,
        lockedUntil: options.lockedUntil ? new Date(options.lockedUntil) : null,
      },
      update: {
        names: options.names ?? 'Usuario',
        firstSurname: options.firstSurname ?? 'Prueba',
        secondSurname: options.secondSurname ?? null,
        ...(options.dni !== undefined ? { dni: options.dni } : {}),
        passwordHash,
        status: options.status ?? 'ACTIVE',
        failedLoginAttempts: options.failedLoginAttempts ?? 0,
        lockedUntil: options.lockedUntil ? new Date(options.lockedUntil) : null,
      },
    });

    if (options.roles && options.roles.length > 0) {
      await seedAuthorization(prisma);
      const roles = await prisma.role.findMany({
        where: { code: { in: options.roles } },
      });

      await prisma.userRole.deleteMany({
        where: { userId: user.id },
      });

      for (const role of roles) {
        await prisma.userRole.create({
          data: {
            userId: user.id,
            roleId: role.id,
            createdBy: 'SEED',
          },
        });
      }
    }

    return { id: user.id, email: user.email };
  } finally {
    await disconnect();
  }
}

// Si se ejecuta como script CLI independiente
const isMain =
  process.argv[1]?.endsWith('seed-e2e-user.ts') || process.argv[1]?.endsWith('seed-e2e-user.js');

if (isMain) {
  const rawData = process.env['SEED_USER_DATA'];
  if (!rawData) {
    console.error('SEED_USER_DATA environment variable is required');
    process.exit(1);
  }
  const parsedData = JSON.parse(rawData) as SeedUserOptions;
  seedE2EUser(parsedData)
    .then((result) => {
      console.log(JSON.stringify(result));
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
