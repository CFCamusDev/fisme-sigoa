import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { StakeholderImportTemplateBuilder } from '../domain/ports/stakeholder-import-template-builder.js';
import type { StakeholderPermissionChecker } from '../domain/ports/stakeholder-permission-checker.js';
import { DownloadStakeholderImportTemplateUseCase } from './download-stakeholder-import-template.js';

describe('DownloadStakeholderImportTemplateUseCase (HU-023, T-023-08)', () => {
  let templateBuilder: MockProxy<StakeholderImportTemplateBuilder>;
  let permissionChecker: MockProxy<StakeholderPermissionChecker>;
  let useCase: DownloadStakeholderImportTemplateUseCase;

  beforeEach(() => {
    templateBuilder = mock<StakeholderImportTemplateBuilder>();
    permissionChecker = mock<StakeholderPermissionChecker>();
    useCase = new DownloadStakeholderImportTemplateUseCase({
      templateBuilder,
      permissionChecker,
    });
  });

  it('returns the template of the requested list type', async () => {
    const fakeBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
    templateBuilder.build.mockResolvedValueOnce(fakeBuffer);

    const result = await useCase.execute({
      type: 'EMPLOYER',
      actorId: 'user-1',
    });

    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'user-1',
      permission: 'constituyente.importar',
      scope: 'GLOBAL',
    });
    expect(templateBuilder.build).toHaveBeenCalledWith('EMPLOYER');
    expect(result.buffer).toBe(fakeBuffer);
  });

  it('denies access without the import permission', async () => {
    permissionChecker.assertAllowed.mockRejectedValueOnce(new ForbiddenError('Sin permiso'));

    await expect(
      useCase.execute({
        type: 'TEACHER',
        actorId: 'user-sin-permiso',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(templateBuilder.build).not.toHaveBeenCalled();
  });

  it('names the file after the list type', async () => {
    templateBuilder.build.mockResolvedValueOnce(Buffer.from([0x50, 0x4b, 0x03, 0x04]));

    const result = await useCase.execute({
      type: 'ADVISORY_BOARD',
      actorId: 'user-1',
    });

    expect(result.fileName).toBe('plantilla-advisory_board.xlsx');
  });
});
