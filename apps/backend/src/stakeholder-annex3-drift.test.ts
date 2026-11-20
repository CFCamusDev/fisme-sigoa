import { describe, expect, it } from 'vitest';
import {
  StakeholderList,
  StakeholderListMember,
  buildAnnex3RenderData,
} from './modules/stakeholders/index.js';
import { OFFICIAL_TEMPLATES } from './modules/templates/index.js';

const NOW = new Date('2026-11-20T10:00:00.000Z');

describe('Annex 3 (FO-03) render data drift check (T-026-01)', () => {
  it('matches every scalar and data-repeat collection variable declared in FO-03', () => {
    const fo03 = OFFICIAL_TEMPLATES.find((template) => template.code === 'FO-03');
    expect(fo03).toBeDefined();
    if (!fo03) {
      return;
    }

    const types = ['ADVISORY_BOARD', 'EMPLOYER', 'GRADUATE', 'STUDENT', 'TEACHER'] as const;
    const lists = types.map((type, index) => {
      const list = StakeholderList.reconstitute({
        id: `list-${index}`,
        programId: 'prog-1',
        type,
        year: 2026,
        studyPlanNumber: '2024',
        version: 'v1',
        createdBy: 'user-1',
        createdAt: NOW,
        updatedAt: NOW,
      });
      const member = StakeholderListMember.reconstitute({
        id: `mem-${index}`,
        listId: list.id,
        stakeholderId: `stk-${index}`,
        fullName: 'Persona Ficticia',
        institution: 'Institución Ficticia',
        ruc: '20123456789',
        sector: 'Tecnología',
        representative: 'Representante Ficticio',
        activity: 'Actividad Ficticia',
        email: 'persona@ejemplo.test',
        mobile: '999000111',
        position: 'Cargo',
        graduationYear: 2022,
        cycle: 'VIII',
        createdBy: 'user-1',
        createdAt: NOW,
      });
      return { list, members: [member] };
    });

    const data = buildAnnex3RenderData(lists[0]!.list, lists);

    const producedKeys = new Set<string>(Object.keys(data.scalars));
    for (const [collectionName, rows] of Object.entries(data.collections)) {
      const firstRow = rows[0];
      expect(firstRow).toBeDefined();
      if (firstRow) {
        for (const field of Object.keys(firstRow)) {
          producedKeys.add(`${collectionName}.${field}`);
        }
      }
    }

    const templateVariableKeys = fo03.variables
      .map((variable) => variable.key)
      .filter((key) => key !== 'logo.url')
      .sort();

    expect([...producedKeys].sort()).toEqual(templateVariableKeys);

    const repeatMatches = [...fo03.content.matchAll(/\bdata-repeat="([^"]+)"/g)].map(
      (match) => match[1],
    );
    expect(Object.keys(data.collections).sort()).toEqual([...new Set(repeatMatches)].sort());
  });
});
