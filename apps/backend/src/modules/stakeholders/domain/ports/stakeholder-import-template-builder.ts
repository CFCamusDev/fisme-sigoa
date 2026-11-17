import type { StakeholderListType } from '../entities/stakeholder-list-enums.js';

export interface StakeholderImportTemplateBuilder {
  build(listType: StakeholderListType): Promise<Buffer>;
}
