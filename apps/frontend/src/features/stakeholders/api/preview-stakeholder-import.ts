import {
  STAKEHOLDER_IMPORT_XLSX_MIME,
  previewStakeholderImportResponseSchema,
  type PreviewStakeholderImportResponse,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export interface StakeholderImportFileInput {
  readonly listId: string;
  readonly file: File;
}

/** Sube un archivo Excel para obtener la vista previa de importación sin guardar cambios. */
export async function previewStakeholderImport(
  input: StakeholderImportFileInput,
): Promise<PreviewStakeholderImportResponse> {
  const response = await apiClient.post<unknown>(
    `/stakeholder-lists/${input.listId}/import/preview`,
    input.file,
    {
      headers: {
        'Content-Type': STAKEHOLDER_IMPORT_XLSX_MIME,
      },
    },
  );
  return previewStakeholderImportResponseSchema.parse(response.data);
}
