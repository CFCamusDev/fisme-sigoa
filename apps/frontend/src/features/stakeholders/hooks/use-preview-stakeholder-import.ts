import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import type { PreviewStakeholderImportResponse } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { shareInFlight } from '@/lib/shared-in-flight';
import {
  previewStakeholderImport,
  type StakeholderImportFileInput,
} from '../api/preview-stakeholder-import';

function buildImportKey(prefix: string, input: StakeholderImportFileInput): string {
  return `${prefix}:${input.listId}:${input.file.name}:${input.file.size}:${input.file.lastModified}`;
}

export function usePreviewStakeholderImport(): UseMutationResult<
  PreviewStakeholderImportResponse,
  ApiError,
  StakeholderImportFileInput
> {
  return useMutation<PreviewStakeholderImportResponse, ApiError, StakeholderImportFileInput>({
    mutationFn: (input) =>
      shareInFlight(buildImportKey('preview-stakeholder-import', input), () =>
        previewStakeholderImport(input),
      ),
    retry: false,
  });
}
