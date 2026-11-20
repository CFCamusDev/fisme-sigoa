import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import type { ApiError } from '@/lib/api-error';
import { shareInFlight } from '@/lib/shared-in-flight';
import {
  downloadStakeholderListPdf,
  type DownloadStakeholderListPdfInput,
  type DownloadStakeholderListPdfResult,
} from '../api/download-stakeholder-list-pdf';

export function useDownloadStakeholderListPdf(): UseMutationResult<
  DownloadStakeholderListPdfResult,
  ApiError,
  DownloadStakeholderListPdfInput
> {
  return useMutation<DownloadStakeholderListPdfResult, ApiError, DownloadStakeholderListPdfInput>({
    mutationFn: (input) =>
      shareInFlight(`stakeholder-list-pdf:${input.listId}`, () =>
        downloadStakeholderListPdf(input),
      ),
    retry: false,
  });
}
