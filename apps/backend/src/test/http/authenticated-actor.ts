import type { PrismaClient } from '../../shared/prisma/generated/client.js';
import { JoseAccessTokenSigner } from '../../modules/auth/infrastructure/security/jose-access-token-signer.js';
import { grantRole } from '../factories/authorization.js';

export interface CreateAuthenticatedActorParams {
  prisma: PrismaClient;
  jwtSecret?: string;
  email?: string;
  dni?: string;
  names?: string;
  firstSurname?: string;
  secondSurname?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'PENDING_ACTIVATION';
  roles?: string[];
  clock?: () => Date;
}

export interface AuthenticatedActorResult {
  token: string;
  authHeader: string;
  user: {
    id: string;
    email: string;
    dni: string | null;
    status: string;
  };
}

let counter = 0;

export async function createAuthenticatedActor(
  params: CreateAuthenticatedActorParams,
): Promise<AuthenticatedActorResult> {
  const { prisma } = params;
  counter += 1;
  const uniqueSuffix = `${Date.now()}_${counter}_${Math.floor(Math.random() * 10000)}`;
  const email = params.email ?? `actor_${uniqueSuffix}@unterm.edu.pe`;
  const dni =
    params.dni ??
    String(Math.floor(10000000 + ((Math.random() * 89999999 + counter) % 90000000))).padStart(
      8,
      '0',
    );
  const status = params.status ?? 'ACTIVE';

  const user = await prisma.user.create({
    data: {
      email,
      dni,
      names: params.names ?? 'Actor',
      firstSurname: params.firstSurname ?? 'Test',
      secondSurname: params.secondSurname,
      status,
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhashforactor$dummyhashforactor',
    },
  });

  if (params.roles && params.roles.length > 0) {
    for (const roleCode of params.roles) {
      await grantRole(prisma, user.id, roleCode);
    }
  }

  const secret = params.jwtSecret ?? 'test-jwt-secret-min-32-chars-length!!';
  const signer = new JoseAccessTokenSigner(secret, 900);
  const now = params.clock ? params.clock() : new Date();
  const { token } = await signer.sign({ userId: user.id }, now);

  return {
    token,
    authHeader: `Bearer ${token}`,
    user: {
      id: user.id,
      email: user.email,
      dni: user.dni,
      status: user.status,
    },
  };
}
