import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';

import {
  checkPath,
  parseExtraTerms,
  runPublicSafetyCheck,
  scanLine,
  scanText,
  scanUnifiedDiff,
} from './check-public-safety.mjs';

const tempDirs = [];
const originalExtraTerms = process.env.PUBLIC_SAFETY_EXTRA_TERMS;

afterEach(() => {
  if (originalExtraTerms === undefined) {
    delete process.env.PUBLIC_SAFETY_EXTRA_TERMS;
  } else {
    process.env.PUBLIC_SAFETY_EXTRA_TERMS = originalExtraTerms;
  }
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createTempGitRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigoa-public-safety-'));
  tempDirs.push(dir);
  const gitEnv = {
    ...process.env,
    GIT_CONFIG_GLOBAL: '',
    GIT_CONFIG_SYSTEM: '',
    GIT_AUTHOR_NAME: 'Test User',
    GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'Test User',
    GIT_COMMITTER_EMAIL: 'test@example.com',
  };
  const git = (args) => execFileSync('git', args, { cwd: dir, env: gitEnv, encoding: 'utf8' });
  git(['init', '-b', 'main']);
  fs.writeFileSync(path.join(dir, 'README.md'), '# Test Repo\n', 'utf8');
  git(['add', 'README.md']);
  git(['commit', '-m', 'chore: initial commit']);
  return { dir, git };
}

describe('check-public-safety', () => {
  it('allows every path of the allowlist', () => {
    const validPaths = [
      '.github/workflows/pr-checks.yml',
      '.husky/pre-commit',
      'apps/backend/src/server.ts',
      'deploy/stack.env.example',
      'manual/guide.md',
      'packages/shared/src/index.ts',
      'scripts/ci/check-public-safety.mjs',
      'docs/DEFINITION_OF_DONE.md',
      'README.md',
      'SECURITY.md',
      'LICENSE',
      'package.json',
      '.env.example',
      'apps\\frontend\\src\\main.tsx',
    ];

    for (const p of validPaths) {
      const result = checkPath(p);
      assert.equal(result.ok, true, `Expected ${p} to be allowed`);
    }
  });

  it('rejects env files except the example', () => {
    const rejected = ['.env', '.env.local', '.env.production', 'apps/backend/.env', 'deploy/prod.env'];
    for (const p of rejected) {
      const result = checkPath(p);
      assert.equal(result.ok, false, `Expected ${p} to be rejected`);
    }

    assert.equal(checkPath('.env.example').ok, true);
    assert.equal(checkPath('apps/backend/.env.example').ok, true);
    assert.equal(checkPath('deploy/stack.env.example').ok, true);
  });

  it('rejects data and dump files', () => {
    const rejected = [
      'apps/backend/cert.pem',
      'apps/backend/private.key',
      'deploy/keystore.p12',
      'deploy/cert.pfx',
      'scripts/backup.dump',
      'scripts/old.bak',
      'apps/backend/data.csv',
      'apps/backend/report.xlsx',
      'apps/backend/table.xls',
      'manual/doc.docx',
      'manual/legacy.doc',
      'scripts/archive.zip',
      'scripts/archive.rar',
      'manual/guide.pdf',
    ];

    for (const p of rejected) {
      const result = checkPath(p);
      assert.equal(result.ok, false, `Expected ${p} to be rejected`);
    }

    assert.equal(checkPath('apps/backend/src/pdf/test-fixtures/sample.pdf').ok, true);
  });

  it('allows prisma migrations but no other sql', () => {
    assert.equal(
      checkPath('apps/backend/prisma/migrations/20260101000000_init/migration.sql').ok,
      true,
    );
    assert.equal(checkPath('apps/backend/seed.sql').ok, false);
    assert.equal(checkPath('scripts/dump.sql').ok, false);
  });

  it('rejects paths outside the allowlist', () => {
    const rejected = [
      'docs/negocio.md',
      'docs/backlog.csv',
      'docs/plans/HU-084/HU-084-PLAN.md',
      '.agents/skills/sigoa-implement/SKILL.md',
      'CLAUDE.md',
      'AGENTS.md',
      'tmp/notes.txt',
      'private/secret.txt',
    ];

    for (const p of rejected) {
      const result = checkPath(p);
      assert.equal(result.ok, false, `Expected ${p} to be rejected`);
    }
  });

  it('detects github token, github fine-grained token, resend key, private key block and url credentials', () => {
    const ghToken = ['gh', 'p_', 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8'].join('');
    const ghPat = ['github_', 'pat_', '11ABCDEFG0123456789_abcdefghijklmnop'].join('');
    const resendKey = ['re_', 'AbCdEfGhIjKlMnOpQrStUvWxYz1234'].join('');
    const privateKeyHeader = ['-----BEGIN ', 'RSA PRIVATE KEY-----'].join('');
    const dbUrl = ['postgres://', 'admin:', 'S3cr3tP4ss!99@db.example.com:5432/app'].join('');
    const cloudUrl = ['cloudinary://', '123456:', 'myRealApiSecret99@mycloud'].join('');

    assert.equal(scanLine(`TOKEN=${ghToken}`)[0]?.type, 'github-token');
    assert.equal(scanLine(`PAT=${ghPat}`)[0]?.type, 'github-fine-grained-token');
    assert.equal(scanLine(`RESEND=${resendKey}`)[0]?.type, 'resend-api-key');
    assert.equal(scanLine(privateKeyHeader)[0]?.type, 'private-key');
    assert.equal(scanLine(`DATABASE_URL=${dbUrl}`)[0]?.type, 'url-credentials');
    assert.equal(scanLine(`CLOUDINARY_URL=${cloudUrl}`)[0]?.type, 'cloudinary-url-credentials');
  });

  it('never prints the full secret value', () => {
    const secretSuffix = 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8';
    const ghToken = ['gh', 'p_', secretSuffix].join('');
    const findings = scanText(`const token = "${ghToken}";`, { file: 'apps/backend/src/a.ts' });

    assert.equal(findings.length, 1);
    assert.equal(findings[0].preview, 'ghp_***');
    assert.equal(findings[0].preview.includes(secretSuffix), false);
  });

  it('accepts example passwords and variable placeholders', () => {
    const allowedLines = [
      'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sigoa',
      'DATABASE_URL=postgresql://test:test@localhost:5432/sigoa_test',
      'DATABASE_URL=postgresql://user:secret@localhost:5432/app',
      'DATABASE_URL=postgresql://user:dummy@localhost:5432/app',
      'DATABASE_URL=postgresql://user:password@localhost:5432/app',
      'DATABASE_URL=postgresql://user:changeme@localhost:5432/app',
      'DATABASE_URL=postgresql://user:example@localhost:5432/app',
      'DATABASE_URL=postgresql://user:pass@localhost:5432/app',
      'DATABASE_URL=postgresql://user:${DB_PASSWORD}@localhost:5432/app',
      'DATABASE_URL=postgresql://user:<password>@localhost:5432/app',
      'DATABASE_URL=postgresql://user:...@localhost:5432/app',
    ];

    for (const line of allowedLines) {
      assert.deepEqual(scanLine(line), [], `Expected no findings for: ${line}`);
    }
  });

  it('honors the allow marker', () => {
    const ghToken = ['gh', 'p_', 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8'].join('');
    const line = `const sample = "${ghToken}"; // public-safety:allow`;
    assert.deepEqual(scanLine(line), []);
  });

  it('scans only added lines', () => {
    const ghToken = ['gh', 'p_', 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8'].join('');
    const diff = [
      'diff --git a/apps/backend/src/a.ts b/apps/backend/src/a.ts',
      '--- a/apps/backend/src/a.ts',
      '+++ b/apps/backend/src/a.ts',
      '@@ -10,2 +10,2 @@',
      `-${ghToken}`,
      ` const contextLine = "${ghToken}";`,
      '+const cleanLine = "ok";',
    ].join('\n');

    assert.deepEqual(scanUnifiedDiff(diff), []);

    const diffWithAddedSecret = [
      'diff --git a/apps/backend/src/a.ts b/apps/backend/src/a.ts',
      '--- a/apps/backend/src/a.ts',
      '+++ b/apps/backend/src/a.ts',
      '@@ -10,0 +11,1 @@',
      `+const leaked = "${ghToken}";`,
    ].join('\n');

    const findings = scanUnifiedDiff(diffWithAddedSecret);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].file, 'apps/backend/src/a.ts');
    assert.equal(findings[0].line, 11);
    assert.equal(findings[0].type, 'github-token');
  });

  it('reports extra private terms without printing them', () => {
    const term = ['internal', 'codename', 'omega'].join('-');
    const extraTerms = parseExtraTerms(` , ${term} , `);
    const findings = scanLine(`const x = "${term}";`, { extraTerms });

    assert.equal(findings.length, 1);
    assert.equal(findings[0].type, 'extra-private-term');
    assert.equal(findings[0].preview, null);
  });

  it('rejects a staged .env file and accepts a clean staged change', { timeout: 10_000 }, () => {
    const { dir, git } = createTempGitRepo();

    fs.mkdirSync(path.join(dir, 'apps/backend'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'apps/backend/index.ts'), 'export const ok = true;\n', 'utf8');
    git(['add', 'apps/backend/index.ts']);

    const cleanResult = runPublicSafetyCheck({ mode: 'staged', cwd: dir });
    assert.equal(cleanResult.ok, true);

    fs.writeFileSync(path.join(dir, '.env'), 'PORT=3000\n', 'utf8');
    git(['add', '-f', '.env']);

    const badResult = runPublicSafetyCheck({ mode: 'staged', cwd: dir });
    assert.equal(badResult.ok, false);
    assert.equal(badResult.pathViolations.length, 1);
    assert.equal(badResult.pathViolations[0].file, '.env');
  });

  it(
    'checks only changes added relative to the base branch in range mode',
    { timeout: 10_000 },
    () => {
      const { dir, git } = createTempGitRepo();

      git(['checkout', '-b', 'feature/test']);
      fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'scripts/clean.mjs'), 'export const v = 1;\n', 'utf8');
      git(['add', 'scripts/clean.mjs']);
      git(['commit', '-m', 'feat: add clean script']);

      const cleanRange = runPublicSafetyCheck({ mode: 'range', base: 'main', cwd: dir });
      assert.equal(cleanRange.ok, true);
      assert.equal(cleanRange.checkedFiles, 1);

      fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'docs/private-notes.md'), '# private\n', 'utf8');
      git(['add', 'docs/private-notes.md']);
      git(['commit', '-m', 'docs: add private file']);

      const badRange = runPublicSafetyCheck({ mode: 'range', base: 'main', cwd: dir });
      assert.equal(badRange.ok, false);
      assert.equal(badRange.pathViolations[0].file, 'docs/private-notes.md');
    },
  );
});
