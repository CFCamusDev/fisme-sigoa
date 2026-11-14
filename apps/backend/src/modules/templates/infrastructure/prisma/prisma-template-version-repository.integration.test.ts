import { describe, expect, it } from 'vitest';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import {
  TemplateVersion,
  type TemplateVersionStatus,
} from '../../domain/entities/template-version.js';
import {
  TemplateDraftExistsError,
  TemplatePublishedExistsError,
  TemplateVersionNumberConflictError,
} from '../../domain/errors/index.js';
import { PrismaTemplateVersionRepository } from './prisma-template-version-repository.js';

const CONCURRENT_CALLERS = 5;
const PUBLISHED_AT = new Date('2026-11-01T10:00:00.000Z');

describe('PrismaTemplateVersionRepository Integration (PostgreSQL real, T-018-25)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const repository = new PrismaTemplateVersionRepository(uow);

  async function template(id: string, code = `FO-${id}`) {
    return prisma.template.create({ data: { id, code, name: `Plantilla ${code}`, type: 'ANNEX' } });
  }

  async function seedVersion(
    id: string,
    templateId: string,
    number: number,
    status: TemplateVersionStatus,
    content = `<p>versión ${number}</p>`,
  ) {
    const isDraft = status === 'DRAFT';
    return prisma.templateVersion.create({
      data: {
        id,
        templateId,
        number,
        status,
        content,
        publishedAt: isDraft ? null : PUBLISHED_AT,
        publishedBy: isDraft ? null : 'user-1',
      },
    });
  }

  function draft(id: string, templateId: string, number: number, content = '<p>borrador</p>') {
    return TemplateVersion.createDraft({ id, templateId, number, content, actorId: 'user-1' });
  }

  async function waitForRowLockWaiter(): Promise<void> {
    const deadline = Date.now() + 10_000;
    let waiting = 0;
    while (waiting === 0 && Date.now() < deadline) {
      const rows = await prisma.$queryRaw<Array<{ total: number }>>`
        SELECT count(*)::int AS total FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'
      `;
      waiting = rows[0]?.total ?? 0;
    }
    expect(waiting).toBeGreaterThan(0);
  }

  describe('reading', () => {
    it('inserts a draft and reads it back by id, with its audit fields', async () => {
      await template('t1');

      await uow.run(() => repository.saveDraft(draft('v1', 't1', 1)));

      const found = await repository.findById('v1');
      expect(found?.status).toBe('DRAFT');
      expect(found?.number).toBe(1);
      expect(found?.content).toBe('<p>borrador</p>');
      expect(found?.publishedAt).toBeNull();
      expect(found?.createdBy).toBe('user-1');
      expect(await repository.findById('missing')).toBeNull();
    }, 15_000);

    it('finds the draft and the published version of a template', async () => {
      await template('t1');
      await seedVersion('v1', 't1', 1, 'PUBLISHED');
      await seedVersion('v2', 't1', 2, 'DRAFT');

      expect((await repository.findPublished('t1'))?.id).toBe('v1');
      expect((await repository.findDraft('t1'))?.id).toBe('v2');
      expect(await repository.findPublished('other')).toBeNull();
      expect(await repository.findDraft('other')).toBeNull();
    }, 15_000);

    it('finds the published version by template code and ignores drafts and obsolete ones', async () => {
      await template('t1', 'FO-01');
      await template('t2', 'FO-02');
      await seedVersion('v1', 't1', 1, 'OBSOLETE');
      await seedVersion('v2', 't1', 2, 'PUBLISHED');
      await seedVersion('v3', 't1', 3, 'DRAFT');
      await seedVersion('v4', 't2', 1, 'DRAFT');

      expect((await repository.findPublishedByCode('FO-01'))?.id).toBe('v2');
      expect(await repository.findPublishedByCode('FO-02')).toBeNull();
      expect(await repository.findPublishedByCode('NOPE')).toBeNull();
    }, 15_000);

    it('lists the history from the newest version to the oldest', async () => {
      await template('t1');
      await template('t2');
      await seedVersion('v1', 't1', 1, 'OBSOLETE');
      await seedVersion('v2', 't1', 2, 'PUBLISHED');
      await seedVersion('v3', 't1', 3, 'DRAFT');
      await seedVersion('v9', 't2', 1, 'PUBLISHED');

      const history = await repository.listByTemplate('t1');

      expect(history.map((version) => version.number)).toEqual([3, 2, 1]);
      expect(await repository.listByTemplate('other')).toEqual([]);
    }, 15_000);

    it('returns the highest number used, or 0 when there are no versions', async () => {
      await template('t1');
      await template('t2');
      await seedVersion('v1', 't1', 1, 'OBSOLETE');
      await seedVersion('v2', 't1', 2, 'PUBLISHED');

      expect(await repository.maxNumber('t1')).toBe(2);
      expect(await repository.maxNumber('t2')).toBe(0);
    }, 15_000);

    it('returns the published and draft versions of several templates', async () => {
      await template('t1');
      await template('t2');
      await template('t3');
      await seedVersion('v1', 't1', 1, 'OBSOLETE');
      await seedVersion('v2', 't1', 2, 'PUBLISHED');
      await seedVersion('v3', 't1', 3, 'DRAFT');
      await seedVersion('v4', 't2', 1, 'PUBLISHED');

      const current = await repository.findCurrentByTemplateIds(['t1', 't2', 't3']);

      expect(current.get('t1')?.published?.id).toBe('v2');
      expect(current.get('t1')?.draft?.id).toBe('v3');
      expect(current.get('t2')?.published?.id).toBe('v4');
      expect(current.get('t2')?.draft).toBeNull();
      expect(current.get('t3')).toEqual({ published: null, draft: null });
    }, 15_000);

    it('returns an empty map for an empty list of templates', async () => {
      expect((await repository.findCurrentByTemplateIds([])).size).toBe(0);
    }, 15_000);
  });

  describe('writing', () => {
    it('requires an active transaction for every write', async () => {
      await template('t1');
      await seedVersion('v1', 't1', 1, 'DRAFT');
      const now = new Date();

      await expect(repository.saveDraft(draft('v2', 't1', 2))).rejects.toThrow(
        /transacción activa/,
      );
      await expect(repository.updateDraftContent('v1', '<p>x</p>', 'u', now)).rejects.toThrow(
        /transacción activa/,
      );
      await expect(
        repository.transitionStatus('v1', 'DRAFT', 'PUBLISHED', 'u', now),
      ).rejects.toThrow(/transacción activa/);
    }, 15_000);

    it('allows a single published version per template', async () => {
      await template('t1');
      await template('t2');
      await seedVersion('v1', 't1', 1, 'PUBLISHED');
      await seedVersion('v2', 't1', 2, 'DRAFT');
      await seedVersion('v3', 't2', 1, 'PUBLISHED');

      await expect(
        uow.run(() =>
          repository.transitionStatus('v2', 'DRAFT', 'PUBLISHED', 'user-2', new Date()),
        ),
      ).rejects.toThrow(TemplatePublishedExistsError);

      // Otra plantilla puede tener su propia versión publicada.
      expect((await repository.findPublished('t2'))?.id).toBe('v3');
      expect((await repository.findById('v2'))?.status).toBe('DRAFT');
    }, 15_000);

    it('allows a single draft per template', async () => {
      await template('t1');
      await seedVersion('v1', 't1', 1, 'PUBLISHED');
      await uow.run(() => repository.saveDraft(draft('v2', 't1', 2)));

      await expect(uow.run(() => repository.saveDraft(draft('v3', 't1', 3)))).rejects.toThrow(
        TemplateDraftExistsError,
      );
    }, 15_000);

    it('rejects a duplicated version number within the template', async () => {
      await template('t1');
      await seedVersion('v1', 't1', 1, 'OBSOLETE');

      await expect(uow.run(() => repository.saveDraft(draft('v2', 't1', 1)))).rejects.toThrow(
        TemplateVersionNumberConflictError,
      );
    }, 15_000);

    it('updates the content of a draft and reports the affected row', async () => {
      await template('t1');
      await seedVersion('v1', 't1', 1, 'DRAFT');
      const now = new Date('2026-11-05T10:00:00.000Z');

      const updated = await uow.run(() =>
        repository.updateDraftContent('v1', '<p>nuevo</p>', 'user-2', now),
      );

      expect(updated).toBe(true);
      const found = await repository.findById('v1');
      expect(found?.content).toBe('<p>nuevo</p>');
      expect(found?.updatedBy).toBe('user-2');
      expect(found?.updatedAt).toEqual(now);
    }, 15_000);

    it('does not update the content of a version that is not a draft', async () => {
      await template('t1');
      await seedVersion('v1', 't1', 1, 'PUBLISHED', '<p>original</p>');

      const updated = await uow.run(() =>
        repository.updateDraftContent('v1', '<p>otro</p>', 'user-2', new Date()),
      );
      const missing = await uow.run(() =>
        repository.updateDraftContent('missing', '<p>otro</p>', 'user-2', new Date()),
      );

      expect(updated).toBe(false);
      expect(missing).toBe(false);
      expect((await repository.findById('v1'))?.content).toBe('<p>original</p>');
    }, 15_000);

    it('publishes a draft recording who and when', async () => {
      await template('t1');
      await seedVersion('v1', 't1', 1, 'DRAFT');
      const now = new Date('2026-11-06T10:00:00.000Z');

      const moved = await uow.run(() =>
        repository.transitionStatus('v1', 'DRAFT', 'PUBLISHED', 'user-2', now),
      );

      expect(moved).toBe(true);
      const found = await repository.findById('v1');
      expect(found?.status).toBe('PUBLISHED');
      expect(found?.publishedAt).toEqual(now);
      expect(found?.publishedBy).toBe('user-2');
    }, 15_000);

    it('obsoletes a published version keeping its publication data and content', async () => {
      await template('t1');
      await seedVersion('v1', 't1', 1, 'PUBLISHED', '<p>original</p>');

      const moved = await uow.run(() =>
        repository.transitionStatus('v1', 'PUBLISHED', 'OBSOLETE', 'user-2', new Date()),
      );

      expect(moved).toBe(true);
      const found = await repository.findById('v1');
      expect(found?.status).toBe('OBSOLETE');
      expect(found?.content).toBe('<p>original</p>');
      expect(found?.publishedAt).toEqual(PUBLISHED_AT);
      expect(found?.publishedBy).toBe('user-1');
      expect(found?.updatedBy).toBe('user-2');
    }, 15_000);

    it('does not transition a version whose state is not the expected one', async () => {
      await template('t1');
      await seedVersion('v1', 't1', 1, 'PUBLISHED');

      const moved = await uow.run(() =>
        repository.transitionStatus('v1', 'DRAFT', 'PUBLISHED', 'user-2', new Date()),
      );

      expect(moved).toBe(false);
      expect((await repository.findById('v1'))?.publishedBy).toBe('user-1');
    }, 15_000);

    it('publishes the new version after obsoleting the previous one in the same transaction', async () => {
      await template('t1');
      await seedVersion('v1', 't1', 1, 'PUBLISHED');
      await seedVersion('v2', 't1', 2, 'DRAFT');

      await uow.run(async () => {
        await repository.transitionStatus('v1', 'PUBLISHED', 'OBSOLETE', 'user-2', new Date());
        await repository.transitionStatus('v2', 'DRAFT', 'PUBLISHED', 'user-2', new Date());
      });

      expect((await repository.findById('v1'))?.status).toBe('OBSOLETE');
      expect((await repository.findById('v2'))?.status).toBe('PUBLISHED');
      expect((await repository.findPublished('t1'))?.id).toBe('v2');
    }, 15_000);
  });

  describe('immutability of published versions (RN-007, RS-024)', () => {
    it('keeps version 1 content readable by id and unchanged after version 2 is published', async () => {
      await template('t1');
      await seedVersion('v1', 't1', 1, 'PUBLISHED', '<p>contenido de la versión 1</p>');
      await seedVersion('v2', 't1', 2, 'DRAFT', '<p>contenido de la versión 2</p>');

      await uow.run(async () => {
        await repository.transitionStatus('v1', 'PUBLISHED', 'OBSOLETE', 'user-2', new Date());
        await repository.transitionStatus('v2', 'DRAFT', 'PUBLISHED', 'user-2', new Date());
      });

      const first = await repository.findById('v1');
      expect(first?.content).toBe('<p>contenido de la versión 1</p>');
      expect(first?.number).toBe(1);
      expect(first?.publishedAt).toEqual(PUBLISHED_AT);
      expect((await repository.findById('v2'))?.content).toBe('<p>contenido de la versión 2</p>');
    }, 15_000);

    it('rejects changing the content of a published version at the database level', async () => {
      await template('t1');
      await seedVersion('v1', 't1', 1, 'PUBLISHED', '<p>original</p>');

      await expect(
        prisma.$executeRawUnsafe(
          `UPDATE "template_versions" SET "content" = '<p>x</p>' WHERE "id" = 'v1'`,
        ),
      ).rejects.toThrow(/publicada/);

      expect((await repository.findById('v1'))?.content).toBe('<p>original</p>');
    }, 15_000);

    it.each([
      ['publishedAt', `"publishedAt" = now()`],
      ['publishedBy', `"publishedBy" = 'otro'`],
    ])(
      'rejects changing %s of a published version',
      async (_column, assignment) => {
        await template('t1');
        await seedVersion('v1', 't1', 1, 'PUBLISHED');

        await expect(
          prisma.$executeRawUnsafe(
            `UPDATE "template_versions" SET ${assignment} WHERE "id" = 'v1'`,
          ),
        ).rejects.toThrow(/publicada/);
      },
      15_000,
    );

    it('rejects sending a published version back to draft', async () => {
      await template('t1');
      await seedVersion('v1', 't1', 1, 'PUBLISHED');

      await expect(
        prisma.$executeRawUnsafe(
          `UPDATE "template_versions" SET "status" = 'DRAFT', "publishedAt" = NULL WHERE "id" = 'v1'`,
        ),
      ).rejects.toThrow(/publicada/);
    }, 15_000);

    it('rejects any change to an obsolete version', async () => {
      await template('t1');
      await seedVersion('v1', 't1', 1, 'OBSOLETE');

      await expect(
        prisma.$executeRawUnsafe(
          `UPDATE "template_versions" SET "updatedBy" = 'x' WHERE "id" = 'v1'`,
        ),
      ).rejects.toThrow(/obsoleta/);
    }, 15_000);

    it('rejects obsoleting a draft directly', async () => {
      await template('t1');
      await seedVersion('v1', 't1', 1, 'DRAFT');

      await expect(
        prisma.$executeRawUnsafe(
          `UPDATE "template_versions" SET "status" = 'OBSOLETE', "publishedAt" = now() WHERE "id" = 'v1'`,
        ),
      ).rejects.toThrow(/borrador/);
    }, 15_000);

    it.each([
      ['number', `"number" = 9`],
      ['templateId', `"templateId" = 't2'`],
    ])(
      'rejects changing the %s of any version',
      async (_column, assignment) => {
        await template('t1');
        await template('t2');
        await seedVersion('v1', 't1', 1, 'DRAFT');

        await expect(
          prisma.$executeRawUnsafe(
            `UPDATE "template_versions" SET ${assignment} WHERE "id" = 'v1'`,
          ),
        ).rejects.toThrow(/no pueden cambiar/);
      },
      15_000,
    );

    it('only deletes drafts', async () => {
      await template('t1');
      await seedVersion('v1', 't1', 1, 'OBSOLETE');
      await seedVersion('v2', 't1', 2, 'PUBLISHED');
      await seedVersion('v3', 't1', 3, 'DRAFT');

      await expect(
        prisma.$executeRawUnsafe(`DELETE FROM "template_versions" WHERE "id" = 'v1'`),
      ).rejects.toThrow(/borrador/);
      await expect(
        prisma.$executeRawUnsafe(`DELETE FROM "template_versions" WHERE "id" = 'v2'`),
      ).rejects.toThrow(/borrador/);
      await prisma.$executeRawUnsafe(`DELETE FROM "template_versions" WHERE "id" = 'v3'`);

      expect(await repository.findById('v3')).toBeNull();
      expect(await repository.findById('v1')).not.toBeNull();
      expect(await repository.findById('v2')).not.toBeNull();
    }, 15_000);
  });

  describe('table constraints', () => {
    it('rejects a draft with a publication date and a published version without one', async () => {
      await template('t1');

      await expect(
        prisma.templateVersion.create({
          data: {
            id: 'a',
            templateId: 't1',
            number: 1,
            status: 'DRAFT',
            content: 'x',
            publishedAt: PUBLISHED_AT,
          },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.templateVersion.create({
          data: { id: 'b', templateId: 't1', number: 2, status: 'PUBLISHED', content: 'x' },
        }),
      ).rejects.toThrow();
    }, 15_000);

    it('rejects a number below 1 and blank content', async () => {
      await template('t1');

      await expect(
        prisma.templateVersion.create({
          data: { id: 'a', templateId: 't1', number: 0, content: 'x' },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.templateVersion.create({
          data: { id: 'b', templateId: 't1', number: 1, content: '   ' },
        }),
      ).rejects.toThrow();
    }, 15_000);

    it('refuses to delete a template that has versions', async () => {
      await template('t1');
      await seedVersion('v1', 't1', 1, 'DRAFT');

      await expect(prisma.template.delete({ where: { id: 't1' } })).rejects.toThrow();
    }, 15_000);
  });

  describe('concurrency (PostgreSQL real, N = 5)', () => {
    it('lets exactly one of N simultaneous draft creations win', async () => {
      await template('t1');
      await seedVersion('v0', 't1', 1, 'PUBLISHED');

      const results = await Promise.allSettled(
        Array.from({ length: CONCURRENT_CALLERS }, (_unused, index) =>
          uow.run(() => repository.saveDraft(draft(`d${index}`, 't1', index + 2))),
        ),
      );

      const fulfilled = results.filter((result) => result.status === 'fulfilled');
      const rejected = results.filter(
        (result): result is PromiseRejectedResult => result.status === 'rejected',
      );
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(CONCURRENT_CALLERS - 1);
      for (const failure of rejected) {
        expect(failure.reason).toBeInstanceOf(TemplateDraftExistsError);
      }
      expect(
        await prisma.templateVersion.count({ where: { templateId: 't1', status: 'DRAFT' } }),
      ).toBe(1);
    }, 20_000);

    it('lets exactly one of N simultaneous publications of the same draft win', async () => {
      await template('t1');
      await seedVersion('v1', 't1', 1, 'DRAFT');

      const results = await Promise.allSettled(
        Array.from({ length: CONCURRENT_CALLERS }, (_unused, index) =>
          uow.run(() =>
            repository.transitionStatus('v1', 'DRAFT', 'PUBLISHED', `user-${index}`, new Date()),
          ),
        ),
      );

      expect(results.every((result) => result.status === 'fulfilled')).toBe(true);
      const outcomes = results.map((result) => (result as PromiseFulfilledResult<boolean>).value);
      expect(outcomes.filter(Boolean)).toHaveLength(1);
      expect(outcomes.filter((moved) => !moved)).toHaveLength(CONCURRENT_CALLERS - 1);
      const winner = outcomes.findIndex(Boolean);
      const stored = await repository.findById('v1');
      expect(stored?.status).toBe('PUBLISHED');
      expect(stored?.publishedBy).toBe(`user-${winner}`);
    }, 20_000);

    it('does not update the content of a draft that was published meanwhile', async () => {
      await template('t1');
      await seedVersion('v1', 't1', 1, 'DRAFT', '<p>original</p>');
      let publishing!: () => void;
      const firstHasUpdated = new Promise<void>((resolve) => (publishing = resolve));
      let releaseFirst!: () => void;
      const firstMayCommit = new Promise<void>((resolve) => (releaseFirst = resolve));

      const first = uow.run(async () => {
        await repository.transitionStatus('v1', 'DRAFT', 'PUBLISHED', 'user-1', new Date());
        publishing();
        await firstMayCommit;
      });
      await firstHasUpdated;

      const second = uow.run(() =>
        repository.updateDraftContent('v1', '<p>cambio tardío</p>', 'user-2', new Date()),
      );
      // La edición debe quedar esperando la fila bloqueada por la publicación.
      await waitForRowLockWaiter();

      releaseFirst();
      await first;

      expect(await second).toBe(false);
      const stored = await repository.findById('v1');
      expect(stored?.status).toBe('PUBLISHED');
      expect(stored?.content).toBe('<p>original</p>');
    }, 20_000);
  });
});
