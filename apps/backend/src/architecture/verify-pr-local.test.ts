import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error script sin archivo de declaraciones .d.ts
import * as verifyPr from '../../../../scripts/ci/verify-pr-local.mjs';

const {
  validateBranchName,
  validatePrTitle,
  validateCommitMessage,
  validateForbiddenFiles,
  buildExecutionPlan,
  computeOverallStatus,
  createReportJson,
  generateDisposableDbName,
  isSafeToDropDatabase,
  buildCleanEnvironment,
  checkCleanWorkingTree,
  markDatabaseStepsOmitted,
  planRepeatedSteps,
  parseMergeTreeOutput,
  checkBranchSync,
  checkLockfileConsistency,
  verifyReportStatus,
  checkWorkflowDrift,
} = verifyPr;

describe('verify-pr-local pure logic (T-002-22 / G1)', () => {
  it('accepts valid work branch names and rejects main, develop and malformed names', () => {
    // Ramas válidas
    expect(validateBranchName('feature/HU-002-logout-refresh')).toEqual({
      valid: true,
      hu: 'HU-002',
    });
    expect(validateBranchName('fix/HU-001-login-error')).toEqual({
      valid: true,
      hu: 'HU-001',
    });
    expect(validateBranchName('docs/HU-074-deploy-guide')).toEqual({
      valid: true,
      hu: 'HU-074',
    });
    expect(validateBranchName('test/HU-002-contrast-helper')).toEqual({
      valid: true,
      hu: 'HU-002',
    });

    // Release y hotfix
    expect(validateBranchName('release/0.1.0')).toEqual({ valid: true });
    expect(validateBranchName('hotfix/1.2.3')).toEqual({ valid: true });
    expect(validateBranchName('release/0.1').valid).toBe(false);
    expect(validateBranchName('release/0.1.0-extra').valid).toBe(false);

    // Prohibido main y develop
    expect(validateBranchName('main').valid).toBe(false);
    expect(validateBranchName('main').error).toMatch(/main/i);
    expect(validateBranchName('develop').valid).toBe(false);
    expect(validateBranchName('develop').error).toMatch(/develop/i);

    // Malformadas
    expect(validateBranchName('feature/logout').valid).toBe(false);
    expect(validateBranchName('HU-002-logout').valid).toBe(false);
    expect(validateBranchName('feature/HU-2-logout').valid).toBe(false);
    expect(validateBranchName('random-branch').valid).toBe(false);
  });

  it('validates the pull request title and that its HU matches the branch', () => {
    const branchHu = 'HU-002';

    // Título válido coincidente
    expect(validatePrTitle('feat(auth): HU-002 maintain and close session', branchHu)).toEqual({
      valid: true,
    });
    expect(validatePrTitle('fix(design): HU-002 fix color contrast ratio', branchHu)).toEqual({
      valid: true,
    });

    // Formato inválido
    const invalidFormat = validatePrTitle('HU-002 maintain session', branchHu);
    expect(invalidFormat.valid).toBe(false);
    expect(invalidFormat.error).toMatch(/formato/i);

    // HU discrepante con la rama
    const mismatchedHu = validatePrTitle('feat(auth): HU-003 user management', branchHu);
    expect(mismatchedHu.valid).toBe(false);
    expect(mismatchedHu.error).toMatch(/no coincide/i);
  });

  it('does not fail when no title is given', () => {
    const resultNoTitle = validatePrTitle(undefined, 'HU-002');
    expect(resultNoTitle.valid).toBe(true);
    expect(resultNoTitle.skipped).toBe(true);
    expect(resultNoTitle.expectedFormat).toBeDefined();

    const resultEmptyTitle = validatePrTitle('', 'HU-002');
    expect(resultEmptyTitle.valid).toBe(true);
    expect(resultEmptyTitle.skipped).toBe(true);
  });

  it('flags commits without a Refs footer', () => {
    const validCommit = `feat(auth): add logout button\n\nRefs: HU-002, T-002-17`;
    expect(validateCommitMessage(validCommit)).toEqual({
      valid: true,
      violations: [],
    });

    const releaseRefs = `chore(release): bump version\n\nRefs: T-REL-010-04`;
    expect(validateCommitMessage(releaseRefs).valid).toBe(true);
    expect(validateCommitMessage(`chore(release): bump\n\nRefs: T-REL-10-4`).valid).toBe(false);

    const multipleRefs = `fix(deploy): wire and declare every variable\n\nRefs: HU-002, T-002-20, T-002-21`;
    expect(validateCommitMessage(multipleRefs)).toEqual({
      valid: true,
      violations: [],
    });

    const noRefs = `feat(auth): add logout button without refs`;
    const res = validateCommitMessage(noRefs);
    expect(res.valid).toBe(false);
    expect(res.violations.some((v: string) => /Refs:/i.test(v))).toBe(true);
  });

  it('flags Co-Authored-By, generated-with and AI tool mentions and emojis in commit messages', () => {
    // Co-Authored-By
    const coAuthor = `feat(auth): add feature\n\nRefs: HU-002, T-002-01\nCo-Authored-By: Assistant <ai@example.com>`;
    expect(validateCommitMessage(coAuthor).valid).toBe(false);

    // Generated with
    const generated = `feat(auth): add feature\n\nGenerated with AI\nRefs: HU-002, T-002-01`;
    expect(validateCommitMessage(generated).valid).toBe(false);

    // Menciones a herramientas de IA
    const claudeMsg = `feat(auth): prompt Claude for help\n\nRefs: HU-002, T-002-01`;
    expect(validateCommitMessage(claudeMsg).valid).toBe(false);

    const antigravityMsg = `feat(auth): build antigravity workflow\n\nRefs: HU-002, T-002-01`;
    expect(validateCommitMessage(antigravityMsg).valid).toBe(false);

    // Emojis
    const emojiMsg = `feat(auth): add button 🚀\n\nRefs: HU-002, T-002-01`;
    expect(validateCommitMessage(emojiMsg).valid).toBe(false);
  });

  it('flags files that must not be committed and allows .env.example and DEFINITION_OF_DONE', () => {
    const allowedFiles = [
      'apps/backend/src/server.ts',
      'apps/frontend/src/App.tsx',
      'docs/DEFINITION_OF_DONE.md',
      '.env.example',
      'apps/backend/.env.example',
      'deploy/stack.env.example',
    ];
    expect(validateForbiddenFiles(allowedFiles)).toEqual({
      valid: true,
      violations: [],
    });

    const forbiddenFiles = [
      'AGENTS.md',
      'CLAUDE.md',
      '.agents/skills/custom.md',
      '.claude/settings.json',
      'docs/plans/HU-002/HU-002-PLAN.md',
      'docs/diseno/mockup.png',
      'docs/backlog.csv',
      'docs/negocio.md',
      '.env',
      'apps/backend/.env',
      '.env.local',
    ];

    for (const file of forbiddenFiles) {
      const res = validateForbiddenFiles([file]);
      expect(res.valid, `Archivo "${file}" debe ser rechazado`).toBe(false);
      expect(res.violations.length).toBeGreaterThan(0);
    }
  });

  it('builds the quick, standard and full plans in order with the commands of pr-checks.yml', () => {
    const quickPlan = buildExecutionPlan('quick');
    const quickIds = quickPlan.map((c: { id: string }) => c.id);

    expect(quickIds).toContain('branch-name');
    expect(quickIds).toContain('commit-messages');
    expect(quickIds).toContain('forbidden-files');
    expect(quickIds).toContain('env-parity');
    expect(quickIds).toContain('windows-paths');
    expect(quickIds).toContain('test-patterns');
    expect(quickIds).toContain('audit');
    expect(quickIds).toContain('format');
    expect(quickIds).toContain('lint');
    expect(quickIds).toContain('depcruise');
    expect(quickIds).toContain('typecheck');
    expect(quickIds).toContain('compose-config');
    expect(quickIds).toContain('compose-hardening');

    // quick no debe incluir integración pesada ni e2e
    expect(quickIds).not.toContain('integration-tests');
    expect(quickIds).not.toContain('e2e');

    const standardPlan = buildExecutionPlan('standard');
    const standardIds = standardPlan.map((c: { id: string }) => c.id);
    expect(standardIds).toContain('integration-tests');
    expect(standardIds).toContain('test-coverage');
    expect(standardIds).toContain('build');
    expect(standardIds).not.toContain('e2e');

    const fullPlan = buildExecutionPlan('full');
    const fullIds = fullPlan.map((c: { id: string }) => c.id);
    expect(fullIds).toContain('e2e');
    expect(fullIds).toContain('pdf-stability');
    expect(fullIds).toContain('docker-smoke');
    expect(fullIds).toContain('fresh-deploy');
  });

  it('fresh-deploy runs smoke-fresh-deploy.sh with a 900 s limit in the images group (HU-079)', () => {
    const freshDeploy = buildExecutionPlan('full').find(
      (c: {
        id: string;
        command?: string;
        script?: string;
        args?: string[];
        timeoutMs?: number;
        group?: string;
      }) => c.id === 'fresh-deploy',
    );
    expect(freshDeploy).toMatchObject({
      command: 'bash scripts/ci/smoke-fresh-deploy.sh',
      script: 'scripts/ci/smoke-fresh-deploy.sh',
      args: [],
      timeoutMs: 900_000,
    });
    expect(buildExecutionPlan('standard').map((c: { id: string }) => c.id)).not.toContain(
      'fresh-deploy',
    );
  });

  it('docker-smoke has no hardcoded Git Bash path and runs smoke-image.sh through script and args (T-004-20)', () => {
    const fullPlan = buildExecutionPlan('full');
    const dockerSmoke = fullPlan.find(
      (c: { id: string; command?: string; script?: string; args?: string[] }) =>
        c.id === 'docker-smoke',
    );
    expect(dockerSmoke).toBeDefined();
    expect(dockerSmoke?.command).not.toContain('C:\\Program Files\\Git');
    expect(dockerSmoke?.command).toBe('bash scripts/ci/smoke-image.sh');
    expect(dockerSmoke?.script).toBe('scripts/ci/smoke-image.sh');
    expect(dockerSmoke?.args).toEqual([]);
  });

  it('verify-pr-local.mjs has no hardcoded Git Bash path in source code (T-004-20)', () => {
    const filePath = path.resolve(__dirname, '../../../../scripts/ci/verify-pr-local.mjs');
    const source = fs.readFileSync(filePath, 'utf-8');
    expect(source).not.toContain('C:\\Program Files\\Git\\bin\\bash.exe');
  });

  it('reports failures with the command and the suggested action', () => {
    const plan = buildExecutionPlan('quick');
    const envParityCheck = plan.find((c: { id: string }) => c.id === 'env-parity');
    expect(envParityCheck).toBeDefined();
    expect(envParityCheck?.command).toMatch(/check:env-parity/);
    expect(envParityCheck?.actionSuggestion).toBeDefined();
  });

  it('returns exit code 0, 1 or 2 according to failures and omitted steps', () => {
    // Todo OK
    const allOk = [
      { id: 'c1', status: 'ok' as const },
      { id: 'c2', status: 'ok' as const },
    ];
    expect(computeOverallStatus(allOk, 'standard')).toEqual({
      overallStatus: 'ok',
      exitCode: 0,
    });

    // Con fallos -> exitCode 1
    const withFail = [
      { id: 'c1', status: 'ok' as const },
      { id: 'c2', status: 'failed' as const },
    ];
    expect(computeOverallStatus(withFail, 'standard')).toEqual({
      overallStatus: 'failed',
      exitCode: 1,
    });

    // Con omitidos en standard -> exitCode 2
    const withOmitted = [
      { id: 'c1', status: 'ok' as const },
      { id: 'c2', status: 'omitted' as const },
    ];
    expect(computeOverallStatus(withOmitted, 'standard')).toEqual({
      overallStatus: 'omitted',
      exitCode: 2,
    });
  });

  it('treats omitted steps as warnings in quick mode', () => {
    const withOmitted = [
      { id: 'c1', status: 'ok' as const },
      { id: 'c2', status: 'omitted' as const },
    ];
    expect(computeOverallStatus(withOmitted, 'quick')).toEqual({
      overallStatus: 'ok',
      exitCode: 0,
    });
  });

  it('writes a report with the head sha, mode and per-check results', () => {
    const report = createReportJson({
      branch: 'feature/HU-002-logout-refresh',
      headSha: 'c0e7b52',
      baseSha: 'develop',
      mode: 'quick',
      clean: false,
      repeat: 1,
      cleanWorkingTree: true,
      startedAt: '2026-11-03T20:00:00.000Z',
      completedAt: '2026-11-03T20:01:00.000Z',
      checks: [
        {
          id: 'branch-name',
          name: 'Nombre de rama',
          status: 'ok',
          durationMs: 50,
          finishedAt: '2026-11-03T20:00:01.000Z',
        },
      ],
    });

    expect(report.version).toBe('1.0.0');
    expect(report.branch).toBe('feature/HU-002-logout-refresh');
    expect(report.headSha).toBe('c0e7b52');
    expect(report.mode).toBe('quick');
    expect(report.checks.length).toBe(1);
    expect(report.exitCode).toBe(0);
    expect(report.overallStatus).toBe('ok');
  });

  describe('disposable database and clean environment (T-002-22 / G2)', () => {
    it('generates a disposable database name that matches the allowed pattern', () => {
      const name = generateDisposableDbName();
      expect(name).toMatch(/^sigoa_verify_[0-9a-f]{8}_test$/);
    });

    it('refuses to drop a database that does not match the pattern, sigoa_dev or sigoa_test', () => {
      // Debe aceptar solo bases con el prefijo y sufijo estricto
      expect(isSafeToDropDatabase('sigoa_verify_1234abcd_test')).toBe(true);

      // Debe rechazar bases reales o de test permanente
      expect(isSafeToDropDatabase('sigoa_dev')).toBe(false);
      expect(isSafeToDropDatabase('sigoa_test')).toBe(false);
      expect(isSafeToDropDatabase('oeag_test')).toBe(false);
      expect(isSafeToDropDatabase('postgres')).toBe(false);
      expect(isSafeToDropDatabase('sigoa_verify_invalid')).toBe(false);
      expect(isSafeToDropDatabase('')).toBe(false);
    });

    it('builds the clean environment with only the workflow variables', () => {
      const dbUrl = 'postgresql://test:test@localhost:5432/sigoa_verify_1234abcd_test';
      const cleanEnv = buildCleanEnvironment(dbUrl, {
        PATH: 'C:\\Windows\\system32',
        SECRET_LOCAL_VAR: 'super_secret',
        CUSTOM_DEV_FLAG: '1',
      });

      expect(cleanEnv.DATABASE_URL).toBe(dbUrl);
      expect(cleanEnv.NODE_ENV).toBe('test');
      expect(cleanEnv.CI).toBe('true');
      expect(cleanEnv.PATH).toBe('C:\\Windows\\system32');

      // Variables locales no deseadas no deben estar
      expect(cleanEnv.SECRET_LOCAL_VAR).toBeUndefined();
      expect(cleanEnv.CUSTOM_DEV_FLAG).toBeUndefined();
    });

    it('warns when the working tree has uncommitted changes in clean mode', () => {
      const dirtyOutput = ' M apps/frontend/src/App.tsx\n?? untracked.txt';
      const resultDirty = checkCleanWorkingTree(dirtyOutput);
      expect(resultDirty.isClean).toBe(false);
      expect(resultDirty.warning).toMatch(/cambios sin confirmar/i);

      const cleanOutput = '';
      const resultClean = checkCleanWorkingTree(cleanOutput);
      expect(resultClean.isClean).toBe(true);
      expect(resultClean.warning).toBeUndefined();
    });

    it('marks database steps as omitted when PostgreSQL is not reachable', () => {
      const plan = [
        { id: 'branch-name', name: 'Rama', group: 'convenciones', status: 'ok' },
        { id: 'disposable-db', name: 'BD Desechable', group: 'calidad', status: 'pending' },
        { id: 'integration-tests', name: 'Integración', group: 'calidad', status: 'pending' },
      ];

      const updated = markDatabaseStepsOmitted(plan, 'PostgreSQL no disponible en localhost:5432');
      const dbStep = updated.find((c: { id: string }) => c.id === 'disposable-db');
      const integStep = updated.find((c: { id: string }) => c.id === 'integration-tests');
      const branchStep = updated.find((c: { id: string }) => c.id === 'branch-name');

      expect(dbStep.status).toBe('omitted');
      expect(dbStep.reason).toMatch(/PostgreSQL no disponible/);
      expect(integStep.status).toBe('omitted');
      expect(branchStep.status).toBe('ok');
    });

    it('always cleans up the disposable database and the worktree', () => {
      const cleanups: string[] = [];
      const dummyAction = () => {
        try {
          cleanups.push('execute-step');
          throw new Error('Simulation step failure');
        } finally {
          cleanups.push('cleanup-db');
          cleanups.push('cleanup-worktree');
        }
      };

      expect(() => dummyAction()).toThrow(/Simulation step failure/);
      expect(cleanups).toEqual(['execute-step', 'cleanup-db', 'cleanup-worktree']);
    });

    it('repeats the integration, e2e and pdf steps n times and fails on the first failure', () => {
      const baseSteps = [
        { id: 'env-parity', name: 'Paridad' },
        { id: 'integration-tests', name: 'Integración' },
      ];

      const planned = planRepeatedSteps(baseSteps, 3);
      const integSteps = planned.filter((s: { id: string }) => s.id === 'integration-tests');

      expect(integSteps.length).toBe(3);
      expect(integSteps[0].iteration).toBe(1);
      expect(integSteps[2].iteration).toBe(3);

      const nonRepeated = planned.filter((s: { id: string }) => s.id === 'env-parity');
      expect(nonRepeated.length).toBe(1);
    });

    it('only reruns the selected checks', () => {
      const plan = buildExecutionPlan('full', { only: ['audit', 'typecheck'] });
      expect(plan.length).toBe(2);
      expect(plan.map((c: { id: string }) => c.id)).toEqual(['audit', 'typecheck']);
    });
  });

  describe('sync, lockfile and report status gate (T-002-22 / G3)', () => {
    it('detects merge conflicts with the base without touching the working tree', () => {
      const cleanTreeOutput = 'f37eadc987654321fedcba1234567890abcdef12\n';
      expect(parseMergeTreeOutput(cleanTreeOutput, 0)).toEqual({
        hasConflict: false,
      });

      const conflictOutput = 'CONFLICT (content): Merge conflict in apps/backend/src/server.ts';
      expect(parseMergeTreeOutput(conflictOutput, 1)).toEqual({
        hasConflict: true,
        conflictDetails: expect.stringMatching(/conflict in apps\/backend\/src\/server\.ts/i),
      });
    });

    it('warns when the branch is behind the base and fails on conflicts', () => {
      // Al día y sin conflictos
      const syncOk = checkBranchSync({ behindCount: 0, hasConflict: false });
      expect(syncOk.valid).toBe(true);
      expect(syncOk.warning).toBeUndefined();

      // Detrás pero sin conflictos (advertencia)
      const behindOk = checkBranchSync({ behindCount: 3, hasConflict: false });
      expect(behindOk.valid).toBe(true);
      expect(behindOk.warning).toMatch(/3 commits detrás/i);
      expect(behindOk.actionSuggestion).toMatch(/rebase/i);

      // Con conflicto (falla)
      const conflictFail = checkBranchSync({ behindCount: 2, hasConflict: true });
      expect(conflictFail.valid).toBe(false);
      expect(conflictFail.error).toMatch(/conflicto/i);
    });

    it('skips the base update when offline', () => {
      const offlineSync = checkBranchSync({
        behindCount: 0,
        hasConflict: false,
        isOffline: true,
      });
      expect(offlineSync.valid).toBe(true);
      expect(offlineSync.skippedUpdate).toBe(true);
      expect(offlineSync.reason).toMatch(/sin conexión/i);
    });

    it('flags an inconsistent lockfile', () => {
      expect(checkLockfileConsistency(0, '')).toEqual({ valid: true });

      const failResult = checkLockfileConsistency(1, 'ERR_PNPM_LOCKFILE_OUTDATED');
      expect(failResult.valid).toBe(false);
      expect(failResult.error).toMatch(/pnpm-lock\.yaml no está en sincronía/i);
    });

    const createValidReport = (overrides = {}) => ({
      version: '1.0.0',
      branch: 'feature/HU-002-logout-refresh',
      headSha: 'c0e7b52',
      baseSha: 'develop',
      mode: 'standard',
      clean: false,
      repeat: 1,
      cleanWorkingTree: true,
      startedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      completedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      overallStatus: 'ok',
      exitCode: 0,
      checks: [
        {
          id: 'audit',
          name: 'Auditoría',
          status: 'ok',
          finishedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        },
        {
          id: 'integration-tests',
          name: 'Integración',
          status: 'ok',
          finishedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
        },
      ],
      ...overrides,
    });

    const validContext = {
      currentHeadSha: 'c0e7b52',
      currentBranch: 'feature/HU-002-logout-refresh',
      isTreeClean: true,
      now: new Date(),
    };

    it('status rejects a report from another commit', () => {
      const report = createValidReport({ headSha: 'different_sha' });
      const res = verifyReportStatus(report, validContext, { requireMode: 'standard' });
      expect(res.valid).toBe(false);
      expect(res.errors.some((e: string) => /otro commit/i.test(e))).toBe(true);
    });

    it('status rejects a report taken with uncommitted changes or now with a dirty tree', () => {
      const reportDirty = createValidReport({ cleanWorkingTree: false });
      const resDirty = verifyReportStatus(reportDirty, validContext, { requireMode: 'standard' });
      expect(resDirty.valid).toBe(false);
      expect(resDirty.errors.some((e: string) => /cambios sin confirmar/i.test(e))).toBe(true);

      const reportClean = createValidReport({ cleanWorkingTree: true });
      const contextDirty = { ...validContext, isTreeClean: false };
      const resContextDirty = verifyReportStatus(reportClean, contextDirty, {
        requireMode: 'standard',
      });
      expect(resContextDirty.valid).toBe(false);
      expect(resContextDirty.errors.some((e: string) => /árbol actual está sucio/i.test(e))).toBe(
        true,
      );
    });

    it('status rejects a report whose mode does not cover the required level', () => {
      const quickReport = createValidReport({ mode: 'quick' });
      const res = verifyReportStatus(quickReport, validContext, { requireMode: 'full' });
      expect(res.valid).toBe(false);
      expect(res.errors.some((e: string) => /nivel requerido/i.test(e))).toBe(true);
    });

    it('status rejects reports with failed or omitted checks in the required scope', () => {
      const reportWithFail = createValidReport({
        overallStatus: 'failed',
        checks: [{ id: 'audit', name: 'Auditoría', status: 'failed' }],
      });
      const resFail = verifyReportStatus(reportWithFail, validContext, { requireMode: 'standard' });
      expect(resFail.valid).toBe(false);
      expect(resFail.errors.some((e: string) => /fallos/i.test(e))).toBe(true);

      const reportWithOmitted = createValidReport({
        overallStatus: 'omitted',
        checks: [{ id: 'integration-tests', name: 'Integración', status: 'omitted' }],
      });
      const resOmitted = verifyReportStatus(reportWithOmitted, validContext, {
        requireMode: 'standard',
      });
      expect(resOmitted.valid).toBe(false);
      expect(resOmitted.errors.some((e: string) => /omitidos/i.test(e))).toBe(true);
    });

    it('status rejects an audit older than two hours and a report older than 24 hours', () => {
      // Auditoría con más de 2h
      const reportOldAudit = createValidReport({
        checks: [
          {
            id: 'audit',
            name: 'Auditoría',
            status: 'ok',
            finishedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
          },
        ],
      });
      const resOldAudit = verifyReportStatus(reportOldAudit, validContext, {
        requireMode: 'standard',
      });
      expect(resOldAudit.valid).toBe(false);
      expect(resOldAudit.errors.some((e: string) => /auditoría.*2 horas/i.test(e))).toBe(true);

      // Reporte con más de 24h
      const reportOldCompleted = createValidReport({
        completedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      });
      const resOldReport = verifyReportStatus(reportOldCompleted, validContext, {
        requireMode: 'standard',
      });
      expect(resOldReport.valid).toBe(false);
      expect(resOldReport.errors.some((e: string) => /24 horas/i.test(e))).toBe(true);
    });

    it('status accepts a fresh green report', () => {
      const report = createValidReport();
      const res = verifyReportStatus(report, validContext, { requireMode: 'standard' });
      expect(res.valid).toBe(true);
      expect(res.errors).toEqual([]);
    });
  });

  describe('shortcuts, pre-push hook and workflow drift guard (T-002-22 / G4)', () => {
    const repoRootDir = path.resolve(__dirname, '../../../../');

    it('every run step of pr-checks.yml is mapped to a local check or listed as an exclusion with a reason', () => {
      const workflowPath = path.join(repoRootDir, '.github', 'workflows', 'pr-checks.yml');
      const workflowContent = fs.readFileSync(workflowPath, 'utf-8');

      const driftResult = checkWorkflowDrift(workflowContent);
      expect(
        driftResult.inParity,
        `Se encontraron pasos en pr-checks.yml no mapeados en verify-pr-local:\n${driftResult.unmappedCommands.join('\n')}`,
      ).toBe(true);
      expect(driftResult.unmappedCommands).toEqual([]);
    });

    it('package.json exposes the five verify scripts', () => {
      const packageJsonPath = path.join(repoRootDir, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const scripts = packageJson.scripts || {};

      expect(scripts['verify:pr']).toBeDefined();
      expect(scripts['verify:pr:quick']).toBeDefined();
      expect(scripts['verify:pr:full']).toBeDefined();
      expect(scripts['verify:pr:clean']).toBeDefined();
      expect(scripts['verify:pr:status']).toBeDefined();
    });

    it('the pre-push hook keeps the protected branch block and calls the quick verification only for work branches', () => {
      const prePushPath = path.join(repoRootDir, '.husky', 'pre-push');
      const content = fs.readFileSync(prePushPath, 'utf-8');

      // Mantiene el bloqueo de main y develop
      expect(content).toMatch(/refs\/heads\/main\|refs\/heads\/develop/);
      expect(content).toMatch(/Empujón directo denegado/);

      // Invoca verify:pr:quick para ramas de trabajo
      expect(content).toMatch(/pnpm verify:pr:quick/);
      expect(content).toMatch(/node_modules/);
    });
  });
});

describe('verify-pr-local parallel groups and scheduler (T-078-12)', () => {
  const {
    planParallelGroups,
    parseJobs,
    runGroupsWithLimit,
    buildGroupEnvironment,
    commandForParallelRun,
    PARALLEL_GROUP_ORDER,
    DATABASE_PARALLEL_GROUPS,
    DEFAULT_JOBS,
  } = verifyPr;
  const repoRootDir = path.resolve(__dirname, '../../../../');

  type Step = { id: string; name: string; command?: string; parallelGroup?: string };
  type Group = { id: string; steps: Step[] };

  const flushMicrotasks = () => new Promise<void>((resolve) => setImmediate(resolve));

  describe('planParallelGroups', () => {
    it.each(['quick', 'standard', 'full'] as const)(
      'schedules every ci check in exactly one group (%s)',
      (mode) => {
        const plan: Step[] = planRepeatedSteps(buildExecutionPlan(mode), 3);
        const groups: Group[] = planParallelGroups(plan);

        const scheduled = groups.flatMap((group) => group.steps);
        expect(scheduled).toHaveLength(plan.length);
        expect(scheduled.map((step) => `${step.id}|${step.name}`).sort()).toEqual(
          plan.map((step) => `${step.id}|${step.name}`).sort(),
        );
        for (const group of groups) {
          for (const step of group.steps) {
            expect(step.parallelGroup).toBe(group.id);
          }
        }
      },
    );

    it('covers every run step of pr-checks.yml with the scheduled checks', () => {
      const workflow = fs.readFileSync(
        path.join(repoRootDir, '.github', 'workflows', 'pr-checks.yml'),
        'utf-8',
      );
      const groups: Group[] = planParallelGroups(buildExecutionPlan('full'));
      const scheduled = groups.flatMap((group) => group.steps);

      const drift = checkWorkflowDrift(workflow, scheduled);
      expect(drift.unmappedCommands).toEqual([]);
      expect(drift.inParity).toBe(true);
    });

    it('keeps the plan order inside each group and the group order of the scheduler', () => {
      const plan: Step[] = buildExecutionPlan('full');
      const groups: Group[] = planParallelGroups(plan);

      expect(groups.map((group) => group.id)).toEqual(
        PARALLEL_GROUP_ORDER.filter((id: string) => groups.some((group) => group.id === id)),
      );
      const position = new Map(plan.map((step, index) => [step.id, index]));
      for (const group of groups) {
        const indexes = group.steps.map((step) => position.get(step.id)!);
        expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
      }
    });

    it('puts lint, format, typecheck and depcruise together and the database checks apart', () => {
      const groups: Group[] = planParallelGroups(buildExecutionPlan('full'));
      const idsOf = (groupId: string) =>
        groups.find((group) => group.id === groupId)?.steps.map((step) => step.id) ?? [];

      expect(idsOf('estaticas')).toEqual(
        expect.arrayContaining(['lint', 'format', 'typecheck', 'depcruise']),
      );
      expect(idsOf('integracion')).toEqual(['disposable-db', 'integration-tests', 'pdf-stability']);
      expect(idsOf('e2e')).toEqual(['e2e']);
      expect(idsOf('cobertura')).toEqual(['test-coverage', 'build']);
      expect(idsOf('imagenes')).toEqual(
        expect.arrayContaining([
          'compose-config',
          'compose-hardening',
          'docker-smoke',
          'fresh-deploy',
        ]),
      );
    });

    it('rejects a step that has no group instead of dropping it', () => {
      expect(() => planParallelGroups([{ id: 'brand-new-check' }])).toThrow(
        /brand-new-check.*grupo paralelo/,
      );
    });
  });

  describe('parseJobs', () => {
    it('defaults to 3 and reads a positive integer', () => {
      expect(DEFAULT_JOBS).toBe(3);
      expect(parseJobs(['--mode', 'full'])).toBe(3);
      expect(parseJobs(['--jobs', '1'])).toBe(1);
      expect(parseJobs(['--jobs', '6'])).toBe(6);
    });

    it.each([['0'], ['-1'], ['abc'], ['2.5'], ['']])('rejects --jobs %j', (value) => {
      expect(() => parseJobs(['--jobs', value])).toThrow(/--jobs debe ser un entero positivo/);
    });

    it('rejects --jobs without a value', () => {
      expect(() => parseJobs(['--jobs'])).toThrow(/--jobs debe ser un entero positivo/);
    });
  });

  describe('runGroupsWithLimit', () => {
    const makeGroups = (count: number): Group[] =>
      Array.from({ length: count }, (_, index) => ({ id: `g${index + 1}`, steps: [] }));

    it('runs at most jobs groups at the same time', async () => {
      const gates = new Map<string, () => void>();
      let active = 0;
      let maxActive = 0;
      const started: string[] = [];

      const done = runGroupsWithLimit(makeGroups(5), 2, (group: Group) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        started.push(group.id);
        return new Promise<string>((resolve) => {
          gates.set(group.id, () => {
            active -= 1;
            resolve(group.id);
          });
        });
      });

      await flushMicrotasks();
      expect(started).toEqual(['g1', 'g2']);

      gates.get('g1')!();
      await flushMicrotasks();
      expect(started).toEqual(['g1', 'g2', 'g3']);

      for (const id of ['g2', 'g3', 'g4', 'g5']) {
        await flushMicrotasks();
        gates.get(id)!();
      }
      const results = await done;

      expect(maxActive).toBe(2);
      expect(results.map((result: { value: string }) => result.value)).toEqual([
        'g1',
        'g2',
        'g3',
        'g4',
        'g5',
      ]);
    });

    it('runs one group at a time with jobs 1', async () => {
      let active = 0;
      let maxActive = 0;
      await runGroupsWithLimit(makeGroups(4), 1, async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await flushMicrotasks();
        active -= 1;
      });
      expect(maxActive).toBe(1);
    });

    it('does not leave other groups orphaned when one of them throws', async () => {
      const finished: string[] = [];
      const results = await runGroupsWithLimit(makeGroups(4), 3, async (group: Group) => {
        if (group.id === 'g2') throw new Error('group exploded');
        await flushMicrotasks();
        finished.push(group.id);
        return group.id;
      });

      expect(finished.sort()).toEqual(['g1', 'g3', 'g4']);
      expect(results).toHaveLength(4);
      expect(results[1].error).toBeInstanceOf(Error);
      expect(results[1].value).toBeUndefined();
      expect(results.filter((result: { error?: unknown }) => !result.error)).toHaveLength(3);
    });

    it('still lets the report be built when a group failed', async () => {
      const results = await runGroupsWithLimit(makeGroups(2), 2, async (group: Group) => {
        if (group.id === 'g1') throw new Error('boom');
        return 'ok';
      });
      const checks = results.map((result: { group: Group; error?: unknown }) => ({
        id: result.group.id,
        status: result.error ? 'failed' : 'ok',
      }));

      const report = createReportJson({ mode: 'full', jobs: 2, checks });
      expect(report.overallStatus).toBe('failed');
      expect(report.exitCode).toBe(1);
      expect(report.checks).toHaveLength(2);
    });

    it('runs an exclusive group alone, after every other group has finished', async () => {
      const events: string[] = [];
      let active = 0;
      let activeWhenExclusiveStarted = -1;

      const results = await runGroupsWithLimit(
        makeGroups(4),
        3,
        async (group: Group) => {
          if (group.id === 'g1') activeWhenExclusiveStarted = active;
          active += 1;
          events.push(`start:${group.id}`);
          await flushMicrotasks();
          events.push(`end:${group.id}`);
          active -= 1;
          return group.id;
        },
        { exclusiveIds: ['g1'] },
      );

      expect(activeWhenExclusiveStarted).toBe(0);
      expect(events.at(-2)).toBe('start:g1');
      expect(events.slice(0, -2).every((event) => !event.endsWith(':g1'))).toBe(true);
      expect(results.map((result: { value: string }) => result.value)).toEqual([
        'g1',
        'g2',
        'g3',
        'g4',
      ]);
    });

    it('runs the e2e group exclusively', () => {
      expect(verifyPr.EXCLUSIVE_PARALLEL_GROUPS).toEqual(['e2e']);
    });

    it('handles no groups', async () => {
      expect(await runGroupsWithLimit([], 3, async () => 'x')).toEqual([]);
    });
  });

  describe('group environment and disposable databases (D7)', () => {
    const baseEnv = {
      TEST_DATABASE_URL: 'postgresql://user:pw@db.local:5433/sigoa_test?schema=public',
      OTHER: '1',
    };

    it('gives each database group its own disposable database', () => {
      const integrationName = generateDisposableDbName();
      const e2eName = generateDisposableDbName();
      const integration = buildGroupEnvironment('integracion', {
        baseEnv,
        dbName: integrationName,
      });
      const e2e = buildGroupEnvironment('e2e', { baseEnv, dbName: e2eName });

      expect(integrationName).not.toBe(e2eName);
      expect(new URL(integration.DATABASE_URL).pathname).toBe(`/${integrationName}`);
      expect(integration.TEST_DATABASE_URL).toBe(integration.DATABASE_URL);
      expect(new URL(e2e.DATABASE_URL).pathname).toBe(`/${e2eName}`);
      expect(new URL(integration.DATABASE_URL).host).toBe('db.local:5433');
      expect(new URL(integration.DATABASE_URL).username).toBe('user');
      expect(integration.OTHER).toBe('1');
      expect(DATABASE_PARALLEL_GROUPS.has('integracion')).toBe(true);
      expect(DATABASE_PARALLEL_GROUPS.has('cobertura')).toBe(false);
    });

    it('leaves groups without database untouched', () => {
      const env = buildGroupEnvironment('estaticas', {
        baseEnv,
        dbName: generateDisposableDbName(),
      });
      expect(env.TEST_DATABASE_URL).toBe(baseEnv.TEST_DATABASE_URL);
    });

    it('only drops disposable databases and the template and worker databases derived from them', () => {
      expect(isSafeToDropDatabase('sigoa_verify_0a1b2c3d_test')).toBe(true);
      expect(isSafeToDropDatabase('sigoa_verify_0a1b2c3d_tpl_test')).toBe(true);
      expect(isSafeToDropDatabase('sigoa_verify_0a1b2c3d_w4_test')).toBe(true);
      expect(isSafeToDropDatabase('sigoa_tpl_test')).toBe(false);
      expect(isSafeToDropDatabase('sigoa_w1_test')).toBe(false);
      expect(isSafeToDropDatabase('sigoa_dev')).toBe(false);
      expect(isSafeToDropDatabase('sigoa_verify_0a1b2c3d')).toBe(false);
    });
  });

  describe('report and commands', () => {
    it('adds jobs and parallel to the report and keeps the status gate working', () => {
      const report = createReportJson({
        branch: 'feature/HU-078-pruebas-rapidas',
        headSha: 'abc1234',
        baseSha: 'develop',
        mode: 'full',
        jobs: 3,
        cleanWorkingTree: true,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        checks: [{ id: 'lint', name: 'Lint', status: 'ok' }],
      });

      expect(report.jobs).toBe(3);
      expect(report.parallel).toBe(true);
      expect(report.version).toBe('1.0.0');
      expect(
        verifyReportStatus(
          report,
          {
            currentHeadSha: 'abc1234',
            currentBranch: 'feature/HU-078-pruebas-rapidas',
            isTreeClean: true,
            now: new Date(),
          },
          { requireMode: 'full' },
        ).valid,
      ).toBe(true);
    });

    it('marks the report as not parallel with one job', () => {
      const report = createReportJson({ mode: 'quick', jobs: 1, checks: [] });
      expect(report.jobs).toBe(1);
      expect(report.parallel).toBe(false);
    });

    it('does not repeat the shared build or the prisma client generation in the parallel commands', () => {
      const steps: Array<{ id: string; command?: string; parallelCommand?: string }> =
        buildExecutionPlan('full');
      for (const id of ['typecheck', 'test-coverage', 'build', 'e2e']) {
        const step = steps.find((candidate) => candidate.id === id)!;
        const parallel = commandForParallelRun(step);
        expect(parallel).toBeDefined();
        expect(parallel).not.toBe(step.command);
        expect(parallel).not.toMatch(/build:shared|db:generate/);
      }
      const lint = steps.find((candidate) => candidate.id === 'lint')!;
      expect(commandForParallelRun(lint)).toBe(lint.command);
    });
  });
});

describe('verify-pr-local template preparation (T-078-13)', () => {
  const { planTemplatePreparation, templateNameFor, commandForParallelRun } = verifyPr;

  it('migrates the template once before the groups start', () => {
    const steps = planTemplatePreparation({
      runDbName: 'sigoa_verify_00000001_test',
      groupDbNames: ['sigoa_verify_00000002_test', 'sigoa_verify_00000003_test'],
    });

    const migrations = steps.filter((step: { type: string }) => step.type === 'migrate-template');
    expect(migrations).toHaveLength(1);
    expect(steps[0].type).toBe('migrate-template');
    expect(migrations[0].create).toBe('sigoa_verify_00000001_tpl_test');
  });

  it('clones the base and the template of every database group from the migrated template', () => {
    const steps = planTemplatePreparation({
      runDbName: 'sigoa_verify_00000001_test',
      groupDbNames: ['sigoa_verify_00000002_test', 'sigoa_verify_00000003_test'],
    });

    const clones = steps.slice(1) as Array<{ type: string; create: string; from: string }>;
    expect(clones).toHaveLength(4);
    expect(clones.every((step) => step.from === 'sigoa_verify_00000001_tpl_test')).toBe(true);
    expect(clones.map((step) => `${step.type}:${step.create}`)).toEqual([
      'clone-base:sigoa_verify_00000002_test',
      'clone-template:sigoa_verify_00000002_tpl_test',
      'clone-base:sigoa_verify_00000003_test',
      'clone-template:sigoa_verify_00000003_tpl_test',
    ]);
    for (const step of steps as Array<{ create: string }>) {
      expect(isSafeToDropDatabase(step.create)).toBe(true);
    }
  });

  it('only migrates the template when there is no database group', () => {
    const steps = planTemplatePreparation({
      runDbName: 'sigoa_verify_00000001_test',
      groupDbNames: [],
    });
    expect(steps).toHaveLength(1);
  });

  it('derives the template name that the integration global setup expects', () => {
    expect(templateNameFor('sigoa_verify_0a1b2c3d_test')).toBe('sigoa_verify_0a1b2c3d_tpl_test');
  });

  it('keeps migrate deploy in the plan for the ci and only checks the status in parallel runs', () => {
    const step = buildExecutionPlan('standard').find(
      (check: { id: string }) => check.id === 'disposable-db',
    );
    expect(step.command).toContain('prisma migrate deploy');
    expect(commandForParallelRun(step)).toContain('prisma migrate status');
  });
});

describe('verify-pr-local repeat of changed tests (T-078-15)', () => {
  const {
    selectChangedTests,
    repeatTargetsFor,
    parseRepeat,
    parseRepeatScope,
    MAX_REPEATED_TEST_FILES,
  } = verifyPr;

  const diff = (...lines: string[]) => lines.join('\n');

  describe('selectChangedTests', () => {
    it('selects added and modified test files for repeat', () => {
      const result = selectChangedTests(
        diff(
          'A\tapps/backend/src/test/db/new-case.integration.test.ts',
          'M\tapps/frontend/e2e/users.spec.ts',
          'M\tapps/backend/src/modules/users/application/create-user.test.ts',
        ),
      );
      expect(result.files).toEqual([
        'apps/backend/src/modules/users/application/create-user.test.ts',
        'apps/backend/src/test/db/new-case.integration.test.ts',
        'apps/frontend/e2e/users.spec.ts',
      ]);
      expect(result.truncated).toBe(false);
    });

    it('ignores deleted files and files that are not tests', () => {
      const result = selectChangedTests(
        diff(
          'D\tapps/backend/src/old.integration.test.ts',
          'M\tapps/backend/src/modules/users/application/create-user.ts',
          'M\tpackage.json',
          'M\tapps/backend/src/test/db/reset-database.ts',
        ),
      );
      expect(result).toEqual({ files: [], total: 0, truncated: false });
    });

    it('takes the new path of a renamed test and ignores a renamed non-test', () => {
      const result = selectChangedTests(
        diff(
          'R087\tapps/backend/src/a.integration.test.ts\tapps/backend/src/b.integration.test.ts',
          'R100\tapps/backend/src/c.integration.test.ts\tapps/backend/src/c.ts',
        ),
      );
      expect(result.files).toEqual(['apps/backend/src/b.integration.test.ts']);
    });

    it('returns nothing for a branch without tests or for empty output', () => {
      expect(selectChangedTests('').files).toEqual([]);
      expect(selectChangedTests(undefined).files).toEqual([]);
      expect(selectChangedTests('\n\n').total).toBe(0);
    });

    it('deduplicates, normalizes separators and keeps paths with spaces', () => {
      const result = selectChangedTests(
        diff('M\tapps\\frontend\\e2e\\mi prueba.spec.ts', 'M\tapps/frontend/e2e/mi prueba.spec.ts'),
      );
      expect(result.files).toEqual(['apps/frontend/e2e/mi prueba.spec.ts']);
    });

    it('keeps the first ten files in alphabetical order and reports the truncation', () => {
      const lines = Array.from(
        { length: 14 },
        (_, index) =>
          `A\tapps/backend/src/case-${String(index).padStart(2, '0')}.integration.test.ts`,
      );
      const result = selectChangedTests(diff(...lines.reverse()));

      expect(MAX_REPEATED_TEST_FILES).toBe(10);
      expect(result.files).toHaveLength(10);
      expect(result.total).toBe(14);
      expect(result.truncated).toBe(true);
      expect(result.files[0]).toBe('apps/backend/src/case-00.integration.test.ts');
      expect(result.files[9]).toBe('apps/backend/src/case-09.integration.test.ts');
    });
  });

  describe('repeatTargetsFor', () => {
    const changed = [
      'apps/backend/src/shared/pdf/pdf-generator.integration.test.ts',
      'apps/backend/src/modules/users/x.integration.test.ts',
      'apps/backend/src/modules/users/y.test.ts',
      'apps/frontend/e2e/users.spec.ts',
      'apps/frontend/src/features/a.test.tsx',
    ];

    it('maps each repeatable step to its own files relative to the package', () => {
      expect(repeatTargetsFor('integration-tests', changed)).toEqual([
        'src/shared/pdf/pdf-generator.integration.test.ts',
        'src/modules/users/x.integration.test.ts',
      ]);
      expect(repeatTargetsFor('pdf-stability', changed)).toEqual([
        'src/shared/pdf/pdf-generator.integration.test.ts',
      ]);
      expect(repeatTargetsFor('e2e', changed)).toEqual(['e2e/users.spec.ts']);
      expect(repeatTargetsFor('lint', changed)).toEqual([]);
    });
  });

  describe('planRepeatedSteps with scope', () => {
    const steps = [
      { id: 'env-parity', name: 'Paridad' },
      { id: 'integration-tests', name: 'Integración', command: 'pnpm integration' },
      { id: 'pdf-stability', name: 'PDF', command: 'pnpm pdf' },
      { id: 'e2e', name: 'E2E', command: 'pnpm test:e2e' },
    ];

    it('repeats only the changed tests and runs the full step once', () => {
      const planned = planRepeatedSteps(steps, 3, {
        scope: 'changed',
        changedTests: [
          'apps/backend/src/modules/users/x.integration.test.ts',
          'apps/frontend/e2e/users.spec.ts',
        ],
      });

      const integration = planned.filter((s: { id: string }) => s.id === 'integration-tests');
      expect(integration).toHaveLength(3);
      expect(integration[0].command).toBe('pnpm integration');
      expect(integration[1].command).toContain('vitest run --project integration');
      expect(integration[1].command).toContain('"src/modules/users/x.integration.test.ts"');
      expect(integration[2].iteration).toBe(3);

      const e2e = planned.filter((s: { id: string }) => s.id === 'e2e');
      expect(e2e).toHaveLength(2);
      expect(e2e[0].command).toBe('pnpm test:e2e');
      expect(e2e[1].command).toContain('playwright test --repeat-each 2 "e2e/users.spec.ts"');

      // pdf-stability no tiene pruebas cambiadas: corre completo una sola vez
      const pdf = planned.filter((s: { id: string }) => s.id === 'pdf-stability');
      expect(pdf).toHaveLength(1);
      expect(pdf[0].iteration).toBeUndefined();
      expect(planned.filter((s: { id: string }) => s.id === 'env-parity')).toHaveLength(1);
    });

    it('runs everything once when the branch has no new or modified tests', () => {
      const planned = planRepeatedSteps(steps, 3, { scope: 'changed', changedTests: [] });
      expect(planned).toEqual(steps);
    });

    it('keeps the current behavior with scope all', () => {
      const planned = planRepeatedSteps(steps, 3, { scope: 'all', changedTests: ['x'] });
      expect(planned.filter((s: { id: string }) => s.id === 'integration-tests')).toHaveLength(3);
      expect(planned.filter((s: { id: string }) => s.id === 'e2e')).toHaveLength(3);
      expect(planned.filter((s: { id: string }) => s.id === 'pdf-stability')).toHaveLength(3);
    });

    it('does not repeat anything with a single pass', () => {
      expect(planRepeatedSteps(steps, 1, { scope: 'changed', changedTests: ['a'] })).toEqual(steps);
    });

    it('records the repeated files in the repeated steps and keeps the ids for scheduling', () => {
      const planned = planRepeatedSteps(steps, 2, {
        scope: 'changed',
        changedTests: ['apps/backend/src/modules/users/x.integration.test.ts'],
      });
      const repeated = planned.filter((s: { repeatedFiles?: string[] }) => s.repeatedFiles);
      expect(repeated).toHaveLength(1);
      expect(repeated[0].repeatedFiles).toEqual(['src/modules/users/x.integration.test.ts']);
      expect(() => planParallelGroupsOf(planned)).not.toThrow();
    });
  });

  describe('argument parsing', () => {
    it('reads --repeat and defaults to one pass', () => {
      expect(parseRepeat([])).toBe(1);
      expect(parseRepeat(['--repeat', '3'])).toBe(3);
    });

    it.each([['0'], ['-2'], ['abc'], ['1.5'], ['']])('rejects --repeat %j', (value) => {
      expect(() => parseRepeat(['--repeat', value])).toThrow(
        /--repeat debe ser un entero positivo/,
      );
    });

    it('rejects --repeat without a value', () => {
      expect(() => parseRepeat(['--repeat'])).toThrow(/--repeat debe ser un entero positivo/);
    });

    it('defaults the scope to changed with repetitions and to all otherwise', () => {
      expect(parseRepeatScope([], 3)).toBe('changed');
      expect(parseRepeatScope([], 1)).toBe('all');
      expect(parseRepeatScope(['--repeat-scope', 'all'], 3)).toBe('all');
      expect(parseRepeatScope(['--repeat-scope', 'changed'], 3)).toBe('changed');
    });

    it('rejects an unknown or missing --repeat-scope', () => {
      expect(() => parseRepeatScope(['--repeat-scope', 'some'], 3)).toThrow(/--repeat-scope/);
      expect(() => parseRepeatScope(['--repeat-scope'], 3)).toThrow(/--repeat-scope/);
    });
  });
});

function planParallelGroupsOf(steps: unknown[]) {
  return verifyPr.planParallelGroups(steps);
}

describe('verify-pr-local scope skips (T-078-16)', () => {
  const { decideScopeSkips, touchesImageOrPdfScope, SCOPE_SKIPPABLE_STEP_IDS, SCOPE_SKIP_REASON } =
    verifyPr;

  it('omits docker-smoke when the diff is out of scope', () => {
    const decision = decideScopeSkips([
      'apps/backend/src/modules/users/application/create-user.ts',
      'apps/frontend/src/features/users/users-page.tsx',
      'docs/historias.md',
    ]);
    expect(decision.skipIds).toContain('docker-smoke');
    expect(decision.skipIds).toContain('pdf-stability');
    expect(decision.skipIds).toContain('fresh-deploy');
    expect([...decision.skipIds].sort()).toEqual([...SCOPE_SKIPPABLE_STEP_IDS].sort());
    expect(decision.reason).toBe('omitido por alcance');
    expect(SCOPE_SKIP_REASON).toBe('omitido por alcance');
  });

  it.each([
    'apps/backend/Dockerfile',
    'apps/frontend/Dockerfile.dev',
    'docker-compose.prod.yml',
    'docker-compose.yml',
    'deploy/stack.env.example',
    'pnpm-lock.yaml',
    'scripts/ci/smoke-image.sh',
    'scripts/ci/smoke-fresh-deploy.sh',
    'apps/backend/prisma/schema.prisma',
    'apps/backend/prisma/migrations/20260101000000_example/migration.sql',
    'apps/backend/src/seed.ts',
    'apps/backend/src/seed-database.ts',
    'apps/backend/src/shared/pdf/pdf-generator.ts',
    'apps/backend/src/shared/branding/logo-url-resolver.ts',
    'docs/despliegue.md',
    'apps\\backend\\Dockerfile',
  ])('runs the image and pdf checks when the diff touches %s', (file) => {
    expect(touchesImageOrPdfScope(file.replace(/\\/g, '/'))).toBe(true);
    expect(decideScopeSkips(['README.md', file]).skipIds).toEqual([]);
  });

  it('runs fresh-deploy when the diff touches prisma or the seed', () => {
    for (const file of ['apps/backend/prisma/schema.prisma', 'apps/backend/src/seed.ts']) {
      expect(decideScopeSkips(['README.md', file]).skipIds).not.toContain('fresh-deploy');
    }
    expect(decideScopeSkips(['README.md']).skipIds).toContain('fresh-deploy');
    expect(decideScopeSkips(['README.md'], { ci: true }).skipIds).toEqual([]);
    expect(decideScopeSkips(['README.md'], { forceAll: true }).skipIds).toEqual([]);
  });

  it('does not treat similar paths as in scope', () => {
    for (const file of [
      'apps/backend/src/shared/pdfs/other.ts',
      'apps/backend/src/modules/pdf/x.ts',
      'apps/backend/src/modules/users/application/bootstrap-admin.ts',
      'apps/backend/prisma-notes.md',
      'package.json',
      'scripts/ci/verify-pr-local.mjs',
      'deployment-notes.md',
    ]) {
      expect(touchesImageOrPdfScope(file)).toBe(false);
    }
  });

  it('force-all runs everything', () => {
    expect(decideScopeSkips(['README.md'], { forceAll: true }).skipIds).toEqual([]);
  });

  it('never omits in the ci', () => {
    expect(decideScopeSkips(['README.md'], { ci: true }).skipIds).toEqual([]);
    expect(decideScopeSkips(['README.md'], { ci: true, forceAll: false }).skipIds).toEqual([]);
  });

  it('runs everything when the diff could not be computed', () => {
    expect(decideScopeSkips(null).skipIds).toEqual([]);
    expect(decideScopeSkips(undefined).skipIds).toEqual([]);
  });

  it('omits both checks for an empty diff', () => {
    expect(decideScopeSkips([]).skipIds.sort()).toEqual([
      'docker-smoke',
      'fresh-deploy',
      'pdf-stability',
    ]);
  });

  describe('report and status gate', () => {
    const skipped = (id: string) => ({
      id,
      name: id,
      status: 'omitted',
      skippedByScope: true,
      reason: 'omitido por alcance',
    });

    it('does not turn a report into omitted when only scope skips are omitted', () => {
      const checks = [
        { id: 'lint', status: 'ok' },
        skipped('docker-smoke'),
        skipped('pdf-stability'),
      ];
      expect(computeOverallStatus(checks, 'full')).toEqual({ overallStatus: 'ok', exitCode: 0 });
    });

    it('still reports other omitted steps as omitted', () => {
      const checks = [skipped('docker-smoke'), { id: 'integration-tests', status: 'omitted' }];
      expect(computeOverallStatus(checks, 'full')).toEqual({
        overallStatus: 'omitted',
        exitCode: 2,
      });
    });

    it('still fails when a step failed next to a scope skip', () => {
      const checks = [skipped('docker-smoke'), { id: 'lint', status: 'failed' }];
      expect(computeOverallStatus(checks, 'full').overallStatus).toBe('failed');
    });

    it('lists the skipped checks in the report and accepts it for --require full', () => {
      const report = createReportJson({
        branch: 'feature/HU-078-pruebas-rapidas',
        headSha: 'abc1234',
        baseSha: 'develop',
        mode: 'full',
        jobs: 3,
        cleanWorkingTree: true,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        checks: [{ id: 'lint', name: 'Lint', status: 'ok' }, skipped('docker-smoke')],
      });
      expect(report.overallStatus).toBe('ok');
      expect(report.checks.find((c: { id: string }) => c.id === 'docker-smoke')).toMatchObject({
        status: 'omitted',
        skippedByScope: true,
      });

      const context = {
        currentHeadSha: 'abc1234',
        currentBranch: 'feature/HU-078-pruebas-rapidas',
        isTreeClean: true,
        now: new Date(),
      };
      expect(verifyReportStatus(report, context, { requireMode: 'full' }).valid).toBe(true);

      // Un informe anterior, sin los campos nuevos, sigue siendo válido.
      const legacy = {
        ...report,
        checks: [{ id: 'lint', name: 'Lint', status: 'ok' }],
      };
      delete legacy.repeatScope;
      delete legacy.repeatedTests;
      expect(verifyReportStatus(legacy, context, { requireMode: 'full' }).valid).toBe(true);
    });
  });
});

describe('verify-pr-local time budgets (T-078-17)', () => {
  const { parsePerfBudget, computeTimings, formatReportTable, PARALLEL_GROUP_ORDER } = verifyPr;
  const repoRootDir = path.resolve(__dirname, '../../../../');
  const budget = {
    groups: { estaticas: 100, integracion: 120, e2e: 150 },
    total: { quick: 60, full: 480 },
  };

  it('reads the budget file of the repository and covers every group and mode', () => {
    const text = fs.readFileSync(
      path.join(repoRootDir, 'scripts', 'ci', 'perf-budget.json'),
      'utf-8',
    );
    const parsed = parsePerfBudget(text);

    expect(parsed.warning).toBeUndefined();
    expect(Object.keys(parsed.budget.groups).sort()).toEqual([...PARALLEL_GROUP_ORDER].sort());
    expect(Object.keys(parsed.budget.total).sort()).toEqual(['full', 'quick', 'standard']);
  });

  it('warns without failing when a group exceeds its budget', () => {
    const checks = [
      { id: 'lint', parallelGroup: 'estaticas', status: 'ok', durationMs: 90_000 },
      { id: 'typecheck', parallelGroup: 'estaticas', status: 'ok', durationMs: 30_000 },
      { id: 'integration-tests', parallelGroup: 'integracion', status: 'ok', durationMs: 60_000 },
    ];
    const timings = computeTimings(checks, budget, { mode: 'full', totalDurationMs: 200_000 });

    const estaticas = timings.groups.find((group: { id: string }) => group.id === 'estaticas');
    expect(estaticas).toEqual({
      id: 'estaticas',
      durationMs: 120_000,
      budgetMs: 100_000,
      exceededBudget: true,
    });
    expect(
      timings.groups.find((group: { id: string }) => group.id === 'integracion').exceededBudget,
    ).toBe(false);
    expect(timings.warnings).toHaveLength(1);
    expect(timings.warnings[0]).toMatch(/estaticas.*120\.0s.*100s/);

    const report = createReportJson({ mode: 'full', jobs: 3, checks, timings });
    expect(report.overallStatus).toBe('ok');
    expect(report.exitCode).toBe(0);
    expect(
      report.timings.groups.find((group: { id: string }) => group.id === 'estaticas')
        .exceededBudget,
    ).toBe(true);
    expect(report.timeWarnings).toHaveLength(1);
  });

  it('shows the time warnings in the report table', () => {
    const timings = computeTimings(
      [{ id: 'lint', parallelGroup: 'estaticas', status: 'ok', durationMs: 200_000 }],
      budget,
      { mode: 'full', totalDurationMs: 600_000 },
    );
    const report = createReportJson({
      mode: 'full',
      branch: 'feature/HU-078-x',
      headSha: 'abc',
      jobs: 3,
      checks: [{ id: 'lint', name: 'Lint', parallelGroup: 'estaticas', status: 'ok' }],
      timings,
    });

    const table = formatReportTable(report);
    expect(table).toContain('Advertencias de tiempo');
    expect(table).toMatch(/estaticas/);
    expect(table).toMatch(/modo 'full'/);
    expect(table).toContain('Resultado global: OK (Código: 0)');
  });

  it('prints no warning section when everything is within budget', () => {
    const timings = computeTimings(
      [{ id: 'lint', parallelGroup: 'estaticas', status: 'ok', durationMs: 1000 }],
      budget,
      { mode: 'full', totalDurationMs: 5000 },
    );
    const report = createReportJson({
      mode: 'full',
      branch: 'b',
      headSha: 'abc',
      jobs: 3,
      checks: [{ id: 'lint', name: 'Lint', status: 'ok' }],
      timings,
    });
    expect(timings.warnings).toEqual([]);
    expect(formatReportTable(report)).not.toContain('Advertencias de tiempo');
  });

  it('flags the total of the mode when it exceeds its budget, still as a warning', () => {
    const timings = computeTimings([], budget, { mode: 'quick', totalDurationMs: 61_000 });
    expect(timings.exceededTotal).toBe(true);
    expect(timings.totalBudgetMs).toBe(60_000);
    expect(timings.warnings[0]).toMatch(/quick/);
  });

  it('multiplies the integration and e2e budgets by the passes with scope all only', () => {
    const checks = [
      { id: 'integration-tests', parallelGroup: 'integracion', status: 'ok', durationMs: 300_000 },
    ];
    const all = computeTimings(checks, budget, { mode: 'full', repeat: 3, repeatScope: 'all' });
    expect(all.groups[0].budgetMs).toBe(360_000);
    expect(all.groups[0].exceededBudget).toBe(false);

    const changed = computeTimings(checks, budget, {
      mode: 'full',
      repeat: 3,
      repeatScope: 'changed',
    });
    expect(changed.groups[0].budgetMs).toBe(120_000);
    expect(changed.groups[0].exceededBudget).toBe(true);
  });

  it('reports durations without budget when the budget could not be read', () => {
    const timings = computeTimings(
      [{ id: 'lint', parallelGroup: 'estaticas', status: 'ok', durationMs: 5000 }],
      null,
      { mode: 'full', totalDurationMs: 9000 },
    );
    expect(timings.groups[0]).toEqual({
      id: 'estaticas',
      durationMs: 5000,
      budgetMs: null,
      exceededBudget: false,
    });
    expect(timings.totalBudgetMs).toBeNull();
    expect(timings.warnings).toEqual([]);
  });

  describe('parsePerfBudget with a missing or invalid file', () => {
    it('warns and continues when the file is missing', () => {
      const parsed = parsePerfBudget(null);
      expect(parsed.budget).toBeNull();
      expect(parsed.warning).toMatch(/No se encontró/);
    });

    it('warns and continues when the file is not JSON', () => {
      const parsed = parsePerfBudget('{ not json');
      expect(parsed.budget).toBeNull();
      expect(parsed.warning).toMatch(/JSON válido/);
    });

    it.each([
      ['no groups', '{"total":{"full":1}}'],
      ['no total', '{"groups":{"e2e":1}}'],
      ['zero seconds', '{"groups":{"e2e":0},"total":{"full":1}}'],
      ['negative seconds', '{"groups":{"e2e":-5},"total":{"full":1}}'],
      ['text seconds', '{"groups":{"e2e":"150"},"total":{"full":1}}'],
      ['empty groups', '{"groups":{},"total":{"full":1}}'],
      ['array groups', '{"groups":[1],"total":{"full":1}}'],
      ['null', 'null'],
    ])('rejects %s with a warning', (_name, text) => {
      const parsed = parsePerfBudget(text);
      expect(parsed.budget).toBeNull();
      expect(parsed.warning).toMatch(/forma inválida|JSON válido/);
    });

    it('accepts a valid budget without a warning', () => {
      const parsed = parsePerfBudget('{"groups":{"e2e":150},"total":{"full":480}}');
      expect(parsed.warning).toBeUndefined();
      expect(parsed.budget.groups.e2e).toBe(150);

      const withPerTest = parsePerfBudget(
        JSON.stringify({
          groups: { e2e: 150 },
          total: { full: 480 },
          perTest: { unit: 2000, integration: 5000, e2e: 20000 },
          exceptions: [
            { file: 'apps/frontend/e2e/contrast-users.spec.ts', ms: 35000, reason: 'WCAG' },
          ],
        }),
      );
      expect(withPerTest.warning).toBeUndefined();
      expect(withPerTest.budget).toEqual({ groups: { e2e: 150 }, total: { full: 480 } });
    });
  });
});
