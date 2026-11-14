export const TEMPLATE_VERSION_STATUSES = ['DRAFT', 'PUBLISHED', 'OBSOLETE'] as const;
export type TemplateVersionStatus = (typeof TEMPLATE_VERSION_STATUSES)[number];
