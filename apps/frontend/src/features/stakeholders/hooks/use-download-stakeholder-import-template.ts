import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import type { StakeholderListTypeValue } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { shareInFlight } from '@/lib/shared-in-flight';
import {
  downloadStakeholderImportTemplate,
  type DownloadStakeholderImportTemplateResult,
} from '../api/download-stakeholder-import-template';

export function useDownloadStakeholderImportTemplate(): UseMutationResult<
  DownloadStakeholderImportTemplateResult,
  ApiError,
  StakeholderListTypeValue
> {
  return useMutation<DownloadStakeholderImportTemplateResult, ApiError, StakeholderListTypeValue>({
    mutationFn: (type) =>
      shareInFlight(`download-stakeholder-import-template:${type}`, () =>
        downloadStakeholderImportTemplate(type),
      ),
    retry: false,
  });
}
