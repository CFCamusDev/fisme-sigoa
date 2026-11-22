import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';

const RESOLUTION_APPROVED_LABEL = 'La resolución que aprueba el proceso está aprobada con su PDF';

type CatalogResolutionType = 'EDUCATIONAL_OBJECTIVE' | 'GRADUATE_ATTRIBUTE';

const PROCESS_TO_RESOLUTION_TYPE: Record<string, CatalogResolutionType | undefined> = {
  P611: 'EDUCATIONAL_OBJECTIVE',
  P613: 'EDUCATIONAL_OBJECTIVE',
  P621: 'GRADUATE_ATTRIBUTE',
};

export interface ResolutionPreconditionExecutionRef {
  readonly type: string;
  readonly catalogVersionId: string;
}

export interface ResolutionPreconditionResult {
  readonly code: 'RESOLUTION_APPROVED';
  readonly label: string;
  readonly state: 'MET' | 'UNMET' | 'NOT_VERIFIABLE';
}

export class PrismaResolutionApprovedPreconditionProvider {
  readonly codes = ['RESOLUTION_APPROVED'] as const;

  constructor(private readonly dbProvider: DbProvider) {}

  async evaluate(
    execution: ResolutionPreconditionExecutionRef,
  ): Promise<readonly ResolutionPreconditionResult[]> {
    const targetType = PROCESS_TO_RESOLUTION_TYPE[execution.type];
    if (!targetType) {
      return [
        {
          code: 'RESOLUTION_APPROVED',
          label: RESOLUTION_APPROVED_LABEL,
          state: 'NOT_VERIFIABLE',
        },
      ];
    }

    const approved = await this.dbProvider.get().resolution.findFirst({
      where: {
        catalogVersionId: execution.catalogVersionId,
        type: targetType,
        status: 'APPROVED',
        pdfFileId: { not: null },
      },
      select: { id: true },
    });

    return [
      {
        code: 'RESOLUTION_APPROVED',
        label: RESOLUTION_APPROVED_LABEL,
        state: approved ? 'MET' : 'UNMET',
      },
    ];
  }
}
