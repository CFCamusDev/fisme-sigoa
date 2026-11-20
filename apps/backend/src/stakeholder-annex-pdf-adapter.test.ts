import { describe, expect, it, vi } from 'vitest';
import type { GenerateAnnexPdfUseCase } from './modules/templates/index.js';
import { createStakeholderAnnexPdfGenerator } from './stakeholder-annex-pdf-adapter.js';

describe('createStakeholderAnnexPdfGenerator (T-026-01)', () => {
  it('forwards render data, fileLabel and audit subject to GenerateAnnexPdfUseCase', async () => {
    const samplePdf = Buffer.from('%PDF-1.4\nAdapter');
    const execute = vi.fn().mockResolvedValue({
      pdf: samplePdf,
      fileName: 'fo-03-2026-v1.pdf',
      templateCode: 'FO-03',
      versionNumber: 1,
    });
    const fakeUseCase = { execute } as unknown as GenerateAnnexPdfUseCase;
    const adapter = createStakeholderAnnexPdfGenerator(fakeUseCase);

    const result = await adapter.generate({
      actorId: 'user-1',
      ip: '127.0.0.1',
      annexCode: 'FO-03',
      data: {
        scalars: { 'studyPlan.year': '2026' },
        collections: { teachers: [{ name: 'Docente' }] },
      },
      fileLabel: '2026',
      subject: {
        entity: 'StakeholderList',
        entityId: 'list-1',
        metadata: { year: 2026 },
      },
    });

    expect(execute).toHaveBeenCalledWith({
      actorId: 'user-1',
      ip: '127.0.0.1',
      annexCode: 'FO-03',
      data: {
        scalars: { 'studyPlan.year': '2026' },
        collections: { teachers: [{ name: 'Docente' }] },
      },
      fileLabel: '2026',
      subject: {
        entity: 'StakeholderList',
        entityId: 'list-1',
        metadata: { year: 2026 },
      },
    });
    expect(result).toEqual({
      pdf: samplePdf,
      fileName: 'fo-03-2026-v1.pdf',
      templateCode: 'FO-03',
      versionNumber: 1,
    });
  });
});
