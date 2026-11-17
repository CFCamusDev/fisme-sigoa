import type { StakeholderListType } from '../entities/stakeholder-list-enums.js';
import type { RawImportRow } from '../policies/analyze-stakeholder-import.js';

export interface StakeholderImportFileReader {
  read(buffer: Buffer, listType: StakeholderListType): Promise<RawImportRow[]>;
}
