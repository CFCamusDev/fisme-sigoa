import type { StakeholderListTypeValue } from '@sigoa/shared';
import type { PrismaClient } from '../../shared/prisma/generated/client.js';
import { createStakeholderRow } from './stakeholders.js';

let listSequence = 0;

export interface CreateStakeholderListRowOptions {
  readonly id?: string;
  readonly programId?: string;
  readonly type?: StakeholderListTypeValue;
  readonly year?: number;
  readonly studyPlanNumber?: string | null;
  readonly version?: string | null;
  readonly createdBy?: string;
}

export interface CreateStakeholderListMemberRowOptions {
  readonly id?: string;
  readonly listId: string;
  readonly stakeholderId?: string;
  readonly fullName?: string;
  readonly institution?: string | null;
  readonly ruc?: string | null;
  readonly sector?: string | null;
  readonly representative?: string | null;
  readonly activity?: string | null;
  readonly email?: string | null;
  readonly mobile?: string | null;
  readonly position?: string | null;
  readonly graduationYear?: number | null;
  readonly cycle?: string | null;
  readonly createdBy?: string;
}

/** Obtiene el programa existente o crea uno ficticio para pruebas de integración. */
export async function ensureTestProgramRow(prisma: PrismaClient): Promise<string> {
  const existing = await prisma.program.findFirst({
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
  });
  if (existing) {
    return existing.id;
  }

  const created = await prisma.program.create({
    data: {
      code: 'EPIS',
      name: 'Ingenieria de Sistemas',
      faculty: 'FISME',
    },
  });
  return created.id;
}

/** Inserta una lista del Anexo 3 ficticia para pruebas de integración. */
export async function createStakeholderListRow(
  prisma: PrismaClient,
  options: CreateStakeholderListRowOptions = {},
): Promise<string> {
  listSequence += 1;
  const programId = options.programId ?? (await ensureTestProgramRow(prisma));
  const row = await prisma.stakeholderList.create({
    data: {
      ...(options.id ? { id: options.id } : {}),
      programId,
      type: options.type ?? 'EMPLOYER',
      year: options.year ?? 2020 + (listSequence % 50),
      studyPlanNumber: options.studyPlanNumber ?? null,
      version: options.version ?? null,
      createdBy: options.createdBy ?? 'SEED',
    },
  });
  return row.id;
}

/** Inserta un miembro de lista del Anexo 3 ficticio para pruebas de integración. */
export async function createStakeholderListMemberRow(
  prisma: PrismaClient,
  options: CreateStakeholderListMemberRowOptions,
): Promise<string> {
  const stakeholderId = options.stakeholderId ?? (await createStakeholderRow(prisma));
  const row = await prisma.stakeholderListMember.create({
    data: {
      ...(options.id ? { id: options.id } : {}),
      listId: options.listId,
      stakeholderId,
      fullName: options.fullName ?? 'Constituyente de Prueba',
      institution: options.institution ?? null,
      ruc: options.ruc ?? null,
      sector: options.sector ?? null,
      representative: options.representative ?? null,
      activity: options.activity ?? null,
      email: options.email ?? null,
      mobile: options.mobile ?? null,
      position: options.position ?? null,
      graduationYear: options.graduationYear ?? null,
      cycle: options.cycle ?? null,
      createdBy: options.createdBy ?? 'SEED',
    },
  });
  return row.id;
}
