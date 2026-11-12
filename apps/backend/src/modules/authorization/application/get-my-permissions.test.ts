import { describe, expect, it, vi } from 'vitest';
import type { GrantReader } from '../domain/ports/grant-reader.js';
import { GetMyPermissionsUseCase } from './get-my-permissions.js';

describe('GetMyPermissionsUseCase (HU-008, T-008-04, RS-011, RS-012, D7)', () => {
  it('returns an empty permissions list when the actor has no grants', async () => {
    const grantReader: GrantReader = {
      findGrantsByUserId: vi.fn().mockResolvedValue([]),
    };
    const useCase = new GetMyPermissionsUseCase({ grantReader });

    const response = await useCase.execute({ actorId: 'user-no-grants' });

    expect(response).toEqual({
      permissions: [],
    });
    expect(grantReader.findGrantsByUserId).toHaveBeenCalledWith('user-no-grants');
  });

  it('computes effective permissions (GLOBAL wins over OWN) and sorts them alphabetically by code', async () => {
    const grantReader: GrantReader = {
      findGrantsByUserId: vi.fn().mockResolvedValue([
        { permission: 'usuario.ver', scope: 'GLOBAL' },
        { permission: 'acta.ver', scope: 'OWN' },
        { permission: 'medicion.ver', scope: 'OWN' },
        { permission: 'medicion.ver', scope: 'GLOBAL' },
      ]),
    };
    const useCase = new GetMyPermissionsUseCase({ grantReader });

    const response = await useCase.execute({ actorId: 'user-mixed' });

    expect(response).toEqual({
      permissions: [
        { code: 'acta.ver', scope: 'OWN' },
        { code: 'medicion.ver', scope: 'GLOBAL' },
        { code: 'usuario.ver', scope: 'GLOBAL' },
      ],
    });
  });
});
