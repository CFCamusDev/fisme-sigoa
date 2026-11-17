import ExcelJS from 'exceljs';
import { createPrismaClient } from '../../shared/prisma/prisma-client.js';
import { seedAuthorizationFast } from '../factories/authorization-fast.js';
import { seedProgram } from '../../modules/parameters/infrastructure/prisma/seed/program-seed.js';
import { seedCatalogVersionDefaults } from '../../modules/catalog/infrastructure/prisma/seed/catalog-version-seed.js';
import type { StakeholderListType } from '../../modules/stakeholders/domain/entities/stakeholder-list-enums.js';
import { getStakeholderImportColumns } from '../../modules/stakeholders/domain/policies/stakeholder-import-columns.js';
import { assertTestDatabase } from '../db/assert-test-database.js';
import { seedE2EUserWithClient, type SeedUserOptions } from './seed-e2e-user.js';

const TEMPLATE_ID = 'e2e-template-1';

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
    listType: StakeholderListType;
    rows: ReadonlyArray<ReadonlyArray<string | number | null>>;
  }): Promise<string>;
  countUsersBySurname(firstSurname: string): Promise<number>;
  close(): Promise<void>;
}

/**
 * Abre un único cliente Prisma sobre la base de pruebas del worker y expone las operaciones de
 * siembra y limpieza para ejecutarlas en el proceso de Playwright sin lanzar subprocesos.
 */
export function createE2ESeeder(databaseUrl: string): E2ESeeder {
  const safeUrl = assertTestDatabase(databaseUrl);
  const { prisma, disconnect } = createPrismaClient(safeUrl);

  let authorizationPromise: Promise<void> | null = null;
  function ensureAuthorization(): Promise<void> {
    if (!authorizationPromise) {
      authorizationPromise = (async () => {
        await seedAuthorizationFast(prisma);
        await seedProgram(prisma);
      })().catch((err) => {
        authorizationPromise = null;
        throw err;
      });
    }
    return authorizationPromise;
  }

  return {
    seedUser(options) {
      return seedE2EUserWithClient(prisma, options, ensureAuthorization);
    },

    async resetCatalog() {
      await prisma.resolution.deleteMany();
      await prisma.storedFile.deleteMany({ where: { publicId: { startsWith: 'resolutions/' } } });
      await prisma.educationalObjective.deleteMany();
      await prisma.graduateAttribute.deleteMany();
      await prisma.catalogVersion.deleteMany({ where: { basedOnVersionId: { not: null } } });
      await prisma.catalogVersion.deleteMany();
    },

    async seedCurrentCatalog() {
      await seedCatalogVersionDefaults(prisma);
    },

    async seedInValidationCatalogVersion() {
      const program = await prisma.program.findFirstOrThrow({
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      const current = await prisma.catalogVersion.findFirstOrThrow({
        where: { programId: program.id, status: 'APPROVED' },
      });
      await prisma.catalogVersion.create({
        data: {
          programId: program.id,
          number: 2,
          status: 'IN_VALIDATION',
          basedOnVersionId: current.id,
          createdBy: 'SEED',
          updatedBy: 'SEED',
        },
      });
    },

    async seedHistoricalCatalog() {
      const program = await prisma.program.findFirstOrThrow({
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      const v1 = await prisma.catalogVersion.findFirstOrThrow({
        where: { programId: program.id, status: 'APPROVED' },
        include: { objectives: true, attributes: true },
      });
      await prisma.catalogVersion.update({
        where: { id: v1.id },
        data: { status: 'HISTORICAL' },
      });
      const v2 = await prisma.catalogVersion.create({
        data: {
          programId: program.id,
          number: 2,
          status: 'APPROVED',
          basedOnVersionId: v1.id,
          createdBy: 'SEED',
          updatedBy: 'SEED',
          objectives: {
            create: v1.objectives
              .filter((o) => o.code !== 'OEP4')
              .map((o) => ({
                code: o.code,
                statement:
                  o.code === 'OEP1'
                    ? `${o.statement} Texto ampliado para la comparación.`
                    : o.statement,
                order: o.order,
              })),
          },
          attributes: {
            create: v1.attributes.map((a) => ({
              code: a.code,
              name: a.name,
              statement: a.statement,
              order: a.order,
            })),
          },
        },
      });
      const f1 = await prisma.storedFile.create({
        data: {
          provider: 'memory',
          publicId: 'resolutions/e2e-history-1',
          url: 'memory://resolutions/e2e-history-1',
          mimeType: 'application/pdf',
          sizeBytes: 64,
          sha256: '1'.repeat(64),
        },
      });
      const f2 = await prisma.storedFile.create({
        data: {
          provider: 'memory',
          publicId: 'resolutions/e2e-history-2',
          url: 'memory://resolutions/e2e-history-2',
          mimeType: 'application/pdf',
          sizeBytes: 64,
          sha256: '2'.repeat(64),
        },
      });
      await prisma.resolution.create({
        data: {
          type: 'EDUCATIONAL_OBJECTIVE',
          number: 'E2E-128-2024',
          issuedOn: new Date('2024-02-20T00:00:00.000Z'),
          status: 'APPROVED',
          approvedAt: new Date('2024-03-01T10:00:00.000Z'),
          approvedBy: 'SEED',
          pdfFileId: f1.id,
          catalogVersionId: v1.id,
          createdBy: 'SEED',
        },
      });
      await prisma.resolution.create({
        data: {
          type: 'EDUCATIONAL_OBJECTIVE',
          number: 'E2E-210-2026',
          issuedOn: new Date('2026-05-02T00:00:00.000Z'),
          status: 'APPROVED',
          approvedAt: new Date('2026-05-10T09:00:00.000Z'),
          approvedBy: 'SEED',
          pdfFileId: f2.id,
          catalogVersionId: v2.id,
          createdBy: 'SEED',
        },
      });
    },

    async resetResolutions() {
      await prisma.resolution.deleteMany();
      await prisma.storedFile.deleteMany({ where: { publicId: { startsWith: 'resolutions/' } } });
    },

    async seedResolution(options) {
      const version = await prisma.catalogVersion.findFirstOrThrow({
        where: { status: 'IN_VALIDATION' },
      });
      const file =
        options.status === 'APPROVED'
          ? await prisma.storedFile.create({
              data: {
                provider: 'memory',
                publicId: 'resolutions/e2e-seed',
                url: 'memory://resolutions/e2e-seed',
                mimeType: 'application/pdf',
                sizeBytes: 64,
                sha256: 'e'.repeat(64),
              },
            })
          : null;

      await prisma.resolution.create({
        data: {
          type: 'EDUCATIONAL_OBJECTIVE',
          number: options.number,
          issuedOn: new Date('2026-11-10T00:00:00.000Z'),
          catalogVersionId: version.id,
          createdBy: 'SEED',
          ...(file
            ? {
                status: 'APPROVED',
                pdfFileId: file.id,
                approvedAt: new Date('2026-11-14T09:00:00.000Z'),
                approvedBy: 'SEED',
              }
            : {}),
        },
      });
    },

    async resetTemplates() {
      await prisma.$executeRawUnsafe('TRUNCATE TABLE "template_versions", "templates" CASCADE');
    },

    async seedTemplate(options = {}) {
      await prisma.template.create({
        data: {
          id: TEMPLATE_ID,
          code: 'FO-E2E',
          name: 'Anexo de prueba',
          type: 'ANNEX',
          variables: [
            { key: 'program.name', label: 'Nombre del programa' },
            { key: 'schedule.period', label: 'Periodo del cronograma' },
          ],
          createdBy: 'SEED',
          updatedBy: 'SEED',
          versions: {
            create: [
              {
                number: 1,
                status: 'PUBLISHED',
                content: '<p>{{program.name}} versión 1</p>',
                publishedAt: new Date('2026-11-01T10:00:00.000Z'),
                publishedBy: 'SEED',
                createdBy: 'SEED',
                updatedBy: 'SEED',
              },
              ...(options.withDraft
                ? [
                    {
                      number: 2,
                      status: 'DRAFT' as const,
                      content: '<p>{{program.name}} borrador de la versión 2</p>',
                      createdBy: 'SEED',
                      updatedBy: 'SEED',
                    },
                  ]
                : []),
            ],
          },
        },
      });
      return TEMPLATE_ID;
    },

    countUsersBySurname(firstSurname) {
      return prisma.user.count({ where: { firstSurname } });
    },

    async resetStakeholders() {
      await prisma.stakeholderListMember.deleteMany();
      await prisma.stakeholderList.deleteMany();
      await prisma.stakeholder.deleteMany();
    },

    async seedStakeholder(options) {
      await ensureAuthorization();
      const row = await prisma.stakeholder.create({
        data: {
          ...(options.id ? { id: options.id } : {}),
          kind: options.kind,
          fullName: options.fullName,
          dni: options.dni ?? null,
          ruc: options.ruc ?? null,
          email: options.email ?? null,
          mobile: options.mobile ?? null,
          position: options.position ?? null,
          institution: options.institution ?? null,
          sector: options.sector ?? null,
          graduationYear: options.graduationYear ?? null,
          cycle: options.cycle ?? null,
          status: options.status ?? 'ACTIVE',
          voidReason: options.status === 'VOIDED' ? 'Motivo de prueba E2E' : null,
          voidedAt: options.status === 'VOIDED' ? new Date() : null,
          voidedBy: options.status === 'VOIDED' ? 'SEED' : null,
          createdBy: 'SEED',
        },
      });
      return row.id;
    },

    async buildStakeholderImportFile(options) {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Constituyentes');
      const headers = getStakeholderImportColumns(options.listType).map((col) => col.header);
      sheet.addRow(headers);
      for (const row of options.rows) {
        sheet.addRow([...row]);
      }
      const arrayBuffer = await workbook.xlsx.writeBuffer();
      return Buffer.from(arrayBuffer).toString('base64');
    },

    close() {
      return disconnect();
    },
  };
}
