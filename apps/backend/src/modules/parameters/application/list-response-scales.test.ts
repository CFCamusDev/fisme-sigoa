import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import { ResponseScale } from '../domain/entities/response-scale.js';
import type { ParametersPermissionChecker } from '../domain/ports/parameters-permission-checker.js';
import type { ResponseScaleReader } from '../domain/ports/response-scale-reader.js';
import type { ScaleUsageReader } from '../domain/ports/scale-usage-reader.js';
import { ListResponseScalesUseCase } from './list-response-scales.js';

function scale(id: string, code: string, type: 'LIKERT' | 'EVIDENCE'): ResponseScale {
  return ResponseScale.create({
    id,
    code,
    name: `Escala ${code}`,
    type,
    levels: [
      { order: 1, label: 'Bajo', value: 1, countsAsAchievement: false },
      { order: 2, label: 'Alto', value: 2, countsAsAchievement: true },
    ],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

describe('ListResponseScalesUseCase (T-012-14, RF-012, CA1, CA2)', () => {
  let scaleReader: MockProxy<ResponseScaleReader>;
  let scaleUsageReader: MockProxy<ScaleUsageReader>;
  let permissionChecker: MockProxy<ParametersPermissionChecker>;
  let useCase: ListResponseScalesUseCase;

  beforeEach(() => {
    scaleReader = mock<ResponseScaleReader>();
    scaleUsageReader = mock<ScaleUsageReader>();
    permissionChecker = mock<ParametersPermissionChecker>();
    scaleReader.list.mockResolvedValue([
      scale('s1', 'LIKERT_5', 'LIKERT'),
      scale('s2', 'EVIDENCE_4', 'EVIDENCE'),
    ]);
    scaleUsageReader.isInUse.mockResolvedValue(false);
    useCase = new ListResponseScalesUseCase({ scaleReader, scaleUsageReader, permissionChecker });
  });

  it('checks parametro.ver with GLOBAL scope', async () => {
    await useCase.execute({ actorId: 'u1' });

    expect(permissionChecker.assertAllowed).toHaveBeenCalledWith({
      actorId: 'u1',
      permission: 'parametro.ver',
      scope: 'GLOBAL',
    });
  });

  it('does not read anything when the permission is denied', async () => {
    permissionChecker.assertAllowed.mockRejectedValue(new ForbiddenError('Sin permiso'));

    await expect(useCase.execute({ actorId: 'u1' })).rejects.toBeInstanceOf(ForbiddenError);

    expect(scaleReader.list).not.toHaveBeenCalled();
    expect(scaleUsageReader.isInUse).not.toHaveBeenCalled();
  });

  it('lists every scale with its ordered levels and the counts-as-achievement flag', async () => {
    const response = await useCase.execute({ actorId: 'u1' });

    expect(response.items.map((item) => item.code)).toEqual(['LIKERT_5', 'EVIDENCE_4']);
    expect(response.items[1]?.levels).toEqual([
      { order: 1, label: 'Bajo', value: 1, countsAsAchievement: false },
      { order: 2, label: 'Alto', value: 2, countsAsAchievement: true },
    ]);
  });

  it('marks each scale as in use according to the usage reader', async () => {
    scaleUsageReader.isInUse.mockImplementation(async (id) => id === 's2');

    const response = await useCase.execute({ actorId: 'u1' });

    expect(response.items.map((item) => [item.code, item.inUse])).toEqual([
      ['LIKERT_5', false],
      ['EVIDENCE_4', true],
    ]);
  });

  it('passes the type filter to the reader and omits it otherwise', async () => {
    await useCase.execute({ actorId: 'u1', type: 'LIKERT' });
    await useCase.execute({ actorId: 'u1' });

    expect(scaleReader.list).toHaveBeenNthCalledWith(1, { type: 'LIKERT' });
    expect(scaleReader.list).toHaveBeenNthCalledWith(2, undefined);
  });

  it('answers an empty list when there are no scales', async () => {
    scaleReader.list.mockResolvedValue([]);

    await expect(useCase.execute({ actorId: 'u1' })).resolves.toEqual({ items: [] });
  });
});
