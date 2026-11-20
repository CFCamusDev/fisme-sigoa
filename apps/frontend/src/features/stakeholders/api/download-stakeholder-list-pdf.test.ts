import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/lib/axios';
import { downloadStakeholderListPdf } from './download-stakeholder-list-pdf';

describe('downloadStakeholderListPdf (T-026-05)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('requests the list pdf as blob and extracts the filename from Content-Disposition', async () => {
    const sampleBlob = new Blob(['%PDF-1.4\nAnnex 3'], { type: 'application/pdf' });
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: sampleBlob,
      headers: {
        'content-disposition': 'attachment; filename="fo-03-2026-v1.pdf"',
      },
    });

    const result = await downloadStakeholderListPdf({
      listId: 'list-1',
      fallbackFileName: 'fo-03-fallback.pdf',
    });

    expect(getSpy).toHaveBeenCalledWith('/stakeholder-lists/list-1/pdf', {
      responseType: 'blob',
    });
    expect(result.blob).toBe(sampleBlob);
    expect(result.fileName).toBe('fo-03-2026-v1.pdf');
  });

  it('uses fallbackFileName when Content-Disposition is missing', async () => {
    const sampleBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: sampleBlob,
      headers: {},
    });

    const result = await downloadStakeholderListPdf({
      listId: 'list-1',
      fallbackFileName: 'fo-03-2026.pdf',
    });

    expect(result.fileName).toBe('fo-03-2026.pdf');
  });
});
