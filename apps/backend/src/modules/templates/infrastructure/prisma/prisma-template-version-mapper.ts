import {
  TemplateVersion,
  type TemplateVersionStatus,
} from '../../domain/entities/template-version.js';

export interface PrismaTemplateVersionRow {
  id: string;
  templateId: string;
  number: number;
  status: TemplateVersionStatus;
  content: string;
  publishedAt: Date | null;
  publishedBy: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function mapPrismaTemplateVersionRowToDomain(
  row: PrismaTemplateVersionRow,
): TemplateVersion {
  return TemplateVersion.create({
    id: row.id,
    templateId: row.templateId,
    number: row.number,
    status: row.status,
    content: row.content,
    publishedAt: row.publishedAt,
    publishedBy: row.publishedBy,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
