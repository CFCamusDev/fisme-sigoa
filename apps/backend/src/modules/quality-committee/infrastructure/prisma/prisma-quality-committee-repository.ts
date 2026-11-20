import type { QualityCommittee as PrismaQualityCommitteeRow } from '../../../../shared/prisma/generated/client.js';
import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { QualityCommittee } from '../../domain/entities/quality-committee.js';
import type {
  CreateQualityCommitteeInput,
  ListQualityCommitteesPageInput,
  ListQualityCommitteesPageResult,
  QualityCommitteeRepository,
} from '../../domain/ports/quality-committee-repository.js';
import {
  mapPrismaQualityCommitteeRowToDomain,
  parseIsoDateToUtc,
} from './prisma-quality-committee-mapper.js';

export class PrismaQualityCommitteeRepository implements QualityCommitteeRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  async lockProgram(programId: string): Promise<void> {
    await this.dbProvider.get().$queryRaw<{ id: string }[]>`
      SELECT "id"
      FROM "programs"
      WHERE "id" = ${programId}
      FOR UPDATE
    `;
  }

  async findByIdForUpdate(id: string): Promise<QualityCommittee | null> {
    const rows = await this.dbProvider.get().$queryRaw<PrismaQualityCommitteeRow[]>`
      SELECT
        "id",
        "programId",
        "periodStart",
        "periodEnd",
        "createdBy",
        "updatedBy",
        "createdAt",
        "updatedAt"
      FROM "quality_committees"
      WHERE "id" = ${id}
      FOR UPDATE
    `;

    const row = rows[0];
    return row ? mapPrismaQualityCommitteeRowToDomain(row) : null;
  }

  async findById(id: string): Promise<QualityCommittee | null> {
    const row = await this.dbProvider.get().qualityCommittee.findUnique({
      where: { id },
    });

    return row ? mapPrismaQualityCommitteeRowToDomain(row) : null;
  }

  async listByProgram(programId: string): Promise<readonly QualityCommittee[]> {
    const rows = await this.dbProvider.get().qualityCommittee.findMany({
      where: { programId },
      orderBy: [{ periodStart: 'desc' }, { id: 'desc' }],
    });

    return rows.map(mapPrismaQualityCommitteeRowToDomain);
  }

  async findInForce(programId: string, today: string): Promise<QualityCommittee | null> {
    const todayDate = parseIsoDateToUtc(today);
    const row = await this.dbProvider.get().qualityCommittee.findFirst({
      where: {
        programId,
        periodStart: { lte: todayDate },
        periodEnd: { gte: todayDate },
      },
      orderBy: [{ periodStart: 'desc' }, { id: 'desc' }],
    });

    return row ? mapPrismaQualityCommitteeRowToDomain(row) : null;
  }

  async listPage(input: ListQualityCommitteesPageInput): Promise<ListQualityCommitteesPageResult> {
    const db = this.dbProvider.get();
    const skip = (input.page - 1) * input.pageSize;

    const [rows, total] = await Promise.all([
      db.qualityCommittee.findMany({
        where: { programId: input.programId },
        orderBy: [{ periodStart: 'desc' }, { id: 'desc' }],
        skip,
        take: input.pageSize,
      }),
      db.qualityCommittee.count({
        where: { programId: input.programId },
      }),
    ]);

    return {
      items: rows.map(mapPrismaQualityCommitteeRowToDomain),
      total,
    };
  }

  async create(input: CreateQualityCommitteeInput): Promise<QualityCommittee> {
    const row = await this.dbProvider.get().qualityCommittee.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        programId: input.programId,
        periodStart: parseIsoDateToUtc(input.periodStart),
        periodEnd: parseIsoDateToUtc(input.periodEnd),
        createdBy: input.actorId,
        updatedBy: null,
        createdAt: input.now,
        updatedAt: input.now,
      },
    });

    return mapPrismaQualityCommitteeRowToDomain(row);
  }

  async touch(id: string, actorId: string, now: Date): Promise<QualityCommittee> {
    const row = await this.dbProvider.get().qualityCommittee.update({
      where: { id },
      data: {
        updatedBy: actorId,
        updatedAt: now,
      },
    });

    return mapPrismaQualityCommitteeRowToDomain(row);
  }
}
