import type { StakeholderListType } from '../domain/entities/stakeholder-list-enums.js';

export interface DownloadStakeholderImportTemplateCommand {
  readonly type: StakeholderListType;
  readonly actorId: string;
}

export interface DownloadStakeholderImportTemplateResult {
  readonly fileName: string;
  readonly buffer: Buffer;
}
