import { describe, expect, it } from 'vitest';
import { IneligibleListMemberError } from '../errors/ineligible-list-member-error.js';
import { StakeholderListMember } from './stakeholder-list-member.js';
import { StakeholderList } from './stakeholder-list.js';
import { Stakeholder } from './stakeholder.js';

const NOW = new Date('2026-11-16T10:00:00.000Z');

describe('StakeholderListMember', () => {
  it('snapshot omits email and mobile', () => {
    const list = StakeholderList.create({
      id: 'list-1',
      programId: 'prog-1',
      type: 'TEACHER',
      year: 2027,
      actorId: 'user-1',
      now: NOW,
    });

    const teacher = Stakeholder.register({
      id: 'stk-1',
      kind: 'PERSON',
      fullName: 'Luis Paredes',
      dni: '12345678',
      email: 'luis@untrm.edu.pe',
      mobile: '987654321',
      actorId: 'user-1',
      now: NOW,
    });

    const member = StakeholderListMember.create({
      id: 'mem-1',
      list,
      stakeholder: teacher,
      actorId: 'user-1',
      now: NOW,
    });

    const auditSnapshot = member.snapshot();
    expect(auditSnapshot).toEqual({
      listId: 'list-1',
      stakeholderId: 'stk-1',
      fullName: 'Luis Paredes',
      institution: null,
      ruc: null,
      sector: null,
      representative: null,
      activity: null,
      hasEmail: true,
      hasMobile: true,
      position: null,
      graduationYear: null,
      cycle: null,
    });
    expect('email' in auditSnapshot).toBe(false);
    expect('mobile' in auditSnapshot).toBe(false);
  });

  it('rejects a voided stakeholder', () => {
    const list = StakeholderList.create({
      id: 'list-1',
      programId: 'prog-1',
      type: 'TEACHER',
      year: 2027,
      actorId: 'user-1',
      now: NOW,
    });

    const teacher = Stakeholder.register({
      id: 'stk-1',
      kind: 'PERSON',
      fullName: 'Luis Paredes',
      dni: '12345678',
      email: 'luis@untrm.edu.pe',
      mobile: '987654321',
      actorId: 'user-1',
      now: NOW,
    }).void({
      reason: 'Registro duplicado en el sistema maestro',
      actorId: 'user-1',
      now: NOW,
    });

    expect(() =>
      StakeholderListMember.create({
        id: 'mem-1',
        list,
        stakeholder: teacher,
        actorId: 'user-1',
        now: NOW,
      }),
    ).toThrow(IneligibleListMemberError);
  });
});
