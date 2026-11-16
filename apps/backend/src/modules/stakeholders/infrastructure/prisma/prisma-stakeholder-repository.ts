import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';
import type { StakeholderStatus } from '../../domain/entities/stakeholder-enums.js';
import type { Stakeholder } from '../../domain/entities/stakeholder.js';
import { DuplicateStakeholderError } from '../../domain/errors/index.js';
import type { StakeholderRepository } from '../../domain/ports/stakeholder-repository.js';
import { mapPrismaStakeholderRowToDomain } from './prisma-stakeholder-mapper.js';

function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { code?: string }).code === 'P2002';
}

export class PrismaStakeholderRepository implements StakeholderRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  async findById(id: string): Promise<Stakeholder | null> {
    const row = await this.dbProvider.get().stakeholder.findUnique({ where: { id } });
    return row ? mapPrismaStakeholderRowToDomain(row) : null;
  }

  async save(stakeholder: Stakeholder): Promise<void> {
    try {
      await this.dbProvider.get().stakeholder.create({
        data: {
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
        },
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
