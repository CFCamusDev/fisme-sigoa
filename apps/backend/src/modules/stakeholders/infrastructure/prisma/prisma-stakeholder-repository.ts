import type { Prisma } from '../../../../shared/prisma/generated/client.js';
import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { StakeholderStatus } from '../../domain/entities/stakeholder-enums.js';
import type { Stakeholder } from '../../domain/entities/stakeholder.js';
import { DuplicateStakeholderError } from '../../domain/errors/index.js';
import type {
  ListStakeholdersFilter,
  StakeholderPage,
  StakeholderReader,
} from '../../domain/ports/stakeholder-reader.js';
import type { StakeholderDocumentLookup } from '../../domain/ports/stakeholder-document-lookup.js';
import type { StakeholderLookup } from '../../domain/ports/stakeholder-lookup.js';
import type { StakeholderRepository } from '../../domain/ports/stakeholder-repository.js';
import { mapPrismaStakeholderRowToDomain } from './prisma-stakeholder-mapper.js';

function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { code?: string }).code === 'P2002';
}

function toStakeholderCreateInput(stakeholder: Stakeholder): Prisma.StakeholderCreateManyInput {
  return {
    id: stakeholder.id,
    kind: stakeholder.kind,
    fullName: stakeholder.fullName,
    dni: stakeholder.dni,
    ruc: stakeholder.ruc,
    email: stakeholder.email,
    mobile: stakeholder.mobile,
    position: stakeholder.position,
    institution: stakeholder.institution,
    sector: stakeholder.sector,
    graduationYear: stakeholder.graduationYear,
    cycle: stakeholder.cycle,
    status: stakeholder.status,
    voidReason: stakeholder.voidReason,
    voidedAt: stakeholder.voidedAt,
    voidedBy: stakeholder.voidedBy,
    createdBy: stakeholder.createdBy,
    createdAt: stakeholder.createdAt,
    updatedAt: stakeholder.updatedAt,
  };
}

export class PrismaStakeholderRepository
  implements StakeholderRepository, StakeholderReader, StakeholderLookup, StakeholderDocumentLookup
{
  constructor(private readonly dbProvider: DbProvider) {}

  async findById(id: string): Promise<Stakeholder | null> {
    const row = await this.dbProvider.get().stakeholder.findUnique({ where: { id } });
    return row ? mapPrismaStakeholderRowToDomain(row) : null;
  }

  async findByIds(ids: readonly string[]): Promise<Stakeholder[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.dbProvider.get().stakeholder.findMany({
      where: { id: { in: [...ids] } },
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
    });
    return rows.map(mapPrismaStakeholderRowToDomain);
  }

  async findByDocuments(documents: {
    readonly dnis: readonly string[];
    readonly rucs: readonly string[];
  }): Promise<Stakeholder[]> {
    const orConditions: Prisma.StakeholderWhereInput[] = [];
    if (documents.dnis.length > 0) {
      orConditions.push({ dni: { in: [...documents.dnis] } });
    }
    if (documents.rucs.length > 0) {
      orConditions.push({ ruc: { in: [...documents.rucs] } });
    }
    if (orConditions.length === 0) {
      return [];
    }
    const rows = await this.dbProvider.get().stakeholder.findMany({
      where: { OR: orConditions },
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
    });
    return rows.map(mapPrismaStakeholderRowToDomain);
  }

  async list(filter: ListStakeholdersFilter): Promise<StakeholderPage> {
    const andConditions: Prisma.StakeholderWhereInput[] = [];
    if (filter.kind) {
      andConditions.push({ kind: filter.kind });
    }
    if (filter.status) {
      andConditions.push({ status: filter.status });
    }
    if (filter.document) {
      andConditions.push({
        OR: [{ dni: filter.document }, { ruc: filter.document }],
      });
    }
    if (filter.search) {
      const literalSearch = filter.search.replace(/[\\%_]/g, '\\$&');
      andConditions.push({
        OR: [
          { fullName: { contains: literalSearch, mode: 'insensitive' } },
          { dni: { contains: literalSearch, mode: 'insensitive' } },
          { ruc: { contains: literalSearch, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.StakeholderWhereInput =
      andConditions.length > 0 ? { AND: andConditions } : {};

    const db = this.dbProvider.get();
    const rows = await db.stakeholder.findMany({
      where,
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize,
    });
    const total = await db.stakeholder.count({ where });

    return {
      items: rows.map(mapPrismaStakeholderRowToDomain),
      total,
    };
  }

  async save(stakeholder: Stakeholder): Promise<void> {
    try {
      await this.dbProvider.get().stakeholder.create({
        data: toStakeholderCreateInput(stakeholder),
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DuplicateStakeholderError();
      }
      throw error;
    }
  }

  async saveMany(stakeholders: readonly Stakeholder[]): Promise<void> {
    if (stakeholders.length === 0) {
      return;
    }
    try {
      await this.dbProvider.get().stakeholder.createMany({
        data: stakeholders.map(toStakeholderCreateInput),
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DuplicateStakeholderError();
      }
      throw error;
    }
  }

  async saveChanges(stakeholder: Stakeholder, expectedStatus: StakeholderStatus): Promise<boolean> {
    try {
      const result = await this.dbProvider.get().stakeholder.updateMany({
        where: { id: stakeholder.id, status: expectedStatus },
        data: {
          fullName: stakeholder.fullName,
          dni: stakeholder.dni,
          ruc: stakeholder.ruc,
          email: stakeholder.email,
          mobile: stakeholder.mobile,
          position: stakeholder.position,
          institution: stakeholder.institution,
          sector: stakeholder.sector,
          graduationYear: stakeholder.graduationYear,
          cycle: stakeholder.cycle,
          status: stakeholder.status,
          voidReason: stakeholder.voidReason,
          voidedAt: stakeholder.voidedAt,
          voidedBy: stakeholder.voidedBy,
          updatedAt: stakeholder.updatedAt,
        },
      });
      return result.count === 1;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DuplicateStakeholderError();
      }
      throw error;
    }
  }
}
