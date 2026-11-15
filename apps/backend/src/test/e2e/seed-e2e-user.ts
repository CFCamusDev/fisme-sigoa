import { createHash } from 'node:crypto';
import type { PrismaClient } from '../../shared/prisma/generated/client.js';
import { createPrismaClient } from '../../shared/prisma/prisma-client.js';
import { assertTestDatabase, getTestDatabaseUrl } from '../db/assert-test-database.js';
import { Argon2PasswordHasher } from '../../modules/auth/infrastructure/security/argon2-password-hasher.js';
import { seedAuthorizationFast } from '../factories/authorization-fast.js';
import { seedProgram } from '../../modules/parameters/infrastructure/prisma/seed/program-seed.js';

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

const sharedHasher = new Argon2PasswordHasher();

export async function seedE2EUserWithClient(
  prisma: PrismaClient,
  options: SeedUserOptions,
  ensureRoles?: () => Promise<void>,
): Promise<{ id: string; email: string }> {
  const resolvedStatus =
    options.status ?? (options.activationToken ? 'PENDING_ACTIVATION' : 'ACTIVE');

  let passwordHash: string | null = null;
  if (options.password) {
    passwordHash = await sharedHasher.hash(options.password);
  } else if (resolvedStatus !== 'PENDING_ACTIVATION') {
    passwordHash = await sharedHasher.hash('Password123!');
  }

  const user = await prisma.user.upsert({
    where: { email: options.email.toLowerCase() },
    create: {
      email: options.email.toLowerCase(),
      names: options.names ?? 'Usuario',
      firstSurname: options.firstSurname ?? 'Prueba',
      secondSurname: options.secondSurname ?? null,
      dni: options.dni ?? null,
      passwordHash,
      status: resolvedStatus,
      failedLoginAttempts: options.failedLoginAttempts ?? 0,
      lockedUntil: options.lockedUntil ? new Date(options.lockedUntil) : null,
    },
    update: {
      names: options.names ?? 'Usuario',
      firstSurname: options.firstSurname ?? 'Prueba',
      secondSurname: options.secondSurname ?? null,
      ...(options.dni !== undefined ? { dni: options.dni } : {}),
      passwordHash,
      status: resolvedStatus,
      failedLoginAttempts: options.failedLoginAttempts ?? 0,
      lockedUntil: options.lockedUntil ? new Date(options.lockedUntil) : null,
    },
  });

  if (options.activationToken) {
    const tokenHash = createHash('sha256').update(options.activationToken.token).digest('hex');

    const expiresAt = options.activationToken.expiresAt
      ? new Date(options.activationToken.expiresAt)
      : new Date(Date.now() + 48 * 3600 * 1000);

    const usedAt = options.activationToken.used ? new Date() : null;

    await prisma.activationToken.deleteMany({
      where: { userId: user.id },
    });

    await prisma.activationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        usedAt,
      },
    });
  }

  if (options.roles && options.roles.length > 0) {
    if (ensureRoles) {
      await ensureRoles();
    } else {
      await seedAuthorizationFast(prisma);
      await seedProgram(prisma);
    }
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
}

export async function seedE2EUser(
  options: SeedUserOptions,
): Promise<{ id: string; email: string }> {
  const dbUrl = assertTestDatabase(getTestDatabaseUrl());
  const { prisma, disconnect } = createPrismaClient(dbUrl);

  try {
    return await seedE2EUserWithClient(prisma, options);
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
