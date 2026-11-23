import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { CommitteeMemberUserNotFoundError } from '../domain/errors/index.js';
import type { CommitteeUserReader } from '../domain/ports/index.js';
import { resolveCommitteeMembers } from './resolve-member-links.js';

describe('resolveCommitteeMembers (HU-081, T-081-18)', () => {
  it('names the unknown email and its member index in details', async () => {
    const committeeUserReader = mock<CommitteeUserReader>();
    committeeUserReader.findByEmails.mockResolvedValueOnce(
      new Map([
        [
          'ana@example.test',
          { id: 'usr-1', fullName: 'Ana', email: 'ana@example.test', status: 'ACTIVE' },
        ],
      ]),
    );

    let thrown: unknown;
    try {
      await resolveCommitteeMembers({
        members: [
          {
            fullName: 'Ana Torres',
            degree: 'Dr.',
            position: 'PRESIDENT',
            userEmail: 'ana@example.test',
          },
          {
            fullName: 'Luis Perez',
            degree: 'Mg.',
            position: 'MEMBER',
            userEmail: 'inexistente@example.test',
          },
        ],
        committeeUserReader,
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(CommitteeMemberUserNotFoundError);
    const err = thrown as CommitteeMemberUserNotFoundError;
    expect(err.message).toBe(
      'No existe un usuario activo con el correo inexistente@example.test. Revisa el correo o deja el vínculo vacío.',
    );
    expect(err.details).toEqual([
      {
        path: 'members.1.userEmail',
        message:
          'No existe un usuario activo con el correo inexistente@example.test. Revisa el correo o deja el vínculo vacío.',
      },
    ]);
  });

  it('reports member position 1-based when an unknown userId is linked', async () => {
    const committeeUserReader = mock<CommitteeUserReader>();
    committeeUserReader.findByIds.mockResolvedValueOnce([]);

    let thrown: unknown;
    try {
      await resolveCommitteeMembers({
        members: [
          {
            fullName: 'Ana Torres',
            degree: 'Dr.',
            position: 'PRESIDENT',
            userId: 'usr-missing',
          },
        ],
        committeeUserReader,
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(CommitteeMemberUserNotFoundError);
    const err = thrown as CommitteeMemberUserNotFoundError;
    expect(err.message).toBe('El usuario vinculado del miembro 1 no existe o está inactivo.');
    expect(err.details).toEqual([
      {
        path: 'members.0.userId',
        message: 'El usuario vinculado del miembro 1 no existe o está inactivo.',
      },
    ]);
  });
});
