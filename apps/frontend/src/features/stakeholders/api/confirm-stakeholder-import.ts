import {
  STAKEHOLDER_IMPORT_XLSX_MIME,
  confirmStakeholderImportResponseSchema,
  type ConfirmStakeholderImportResponse,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';
import type { StakeholderImportFileInput } from './preview-stakeholder-import';

/** Envía el archivo Excel para confirmar la importación de las filas válidas. */
export async function confirmStakeholderImport(
  input: StakeholderImportFileInput,
): Promise<ConfirmStakeholderImportResponse> {
  const response = await apiClient.post<unknown>(
    `/stakeholder-lists/${input.listId}/import/confirm`,
    input.file,
    {
      headers: {
        'Content-Type': STAKEHOLDER_IMPORT_XLSX_MIME,
      },
    },
  );
  return confirmStakeholderImportResponseSchema.parse(response.data);
}
