#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractFailedVitestFiles, findInsufficientSelection } from '../ci/affected/audit.mjs';
import { toPosixPath } from '../ci/affected/graph.mjs';
import { classifyTestFile, loadRules } from '../ci/affected/rules.mjs';
import { runSelection } from '../ci/affected/select.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_SAMPLES_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'affected-harness.samples.json');
const DEFAULT_REPORT_PATH = path.join(repoRoot, 'tmp', 'perf-affected', 'harness-report.json');

/**
 * Interpreta los argumentos del arnés de validación.
 * @param {string[]} argv
 */
export function parseArgs(argv) {
  const result = {
    mode: 'diffs',
    count: 12,
    withIntegration: false,
    samplesPath: DEFAULT_SAMPLES_PATH,
    outPath: DEFAULT_REPORT_PATH,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--mode') {
      const value = argv[i + 1];
      if (value !== 'diffs' && value !== 'inject') {
        throw new Error(`--mode debe ser 'diffs' o 'inject' (recibido: '${value ?? ''}').`);
      }
      result.mode = value;
      i += 1;
    } else if (arg === '--count') {
      const value = argv[i + 1];
      if (!value || !/^[0-9]+$/.test(value) || Number(value) < 1) {
        throw new Error(`--count debe ser un entero positivo (recibido: '${value ?? ''}').`);
      }
      result.count = Number(value);
      i += 1;
    } else if (arg === '--with-integration') {
      result.withIntegration = true;
    } else if (arg === '--samples') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new Error('--samples requiere una ruta.');
      result.samplesPath = path.resolve(repoRoot, value);
      i += 1;
    } else if (arg === '--out') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new Error('--out requiere una ruta.');
      result.outPath = path.resolve(repoRoot, value);
      i += 1;
    } else {
      throw new Error(`Argumento desconocido: ${arg}`);
    }
  }
  return result;
}

/**
 * Comprueba invariantes baratas sobre un diff de PR:
 * toda prueba cambiada debe quedar seleccionada y se informa si hubo archivo desconocido.
 * @param {{ changedFiles: string[], selectionResult: Record<string, any>, rules?: Record<string, any> }} params
 */
export function checkDiffInvariants({ changedFiles, selectionResult, rules = loadRules() }) {
  const missingChangedTests = [];
  if (selectionResult.mode !== 'all') {
    const sel = selectionResult.selection ?? {};
    const selectedSet = new Set([
      ...(sel.backendUnit ?? []),
      ...(sel.backendIntegration ?? []),
      ...(sel.frontend ?? []),
      ...(sel.shared ?? []),
    ]);

    for (const rawFile of changedFiles || []) {
      const file = toPosixPath(rawFile);
      const cat = classifyTestFile(file, rules);
      if (!cat) continue;
      if (cat === 'e2e') {
        if (sel.e2e?.scope !== 'full') missingChangedTests.push(file);
      } else if (!selectedSet.has(file)) {
        missingChangedTests.push(file);
      }
    }
  }

  const unknownReason =
    selectionResult.mode === 'all' && /Archivo desconocido/i.test(selectionResult.reason ?? '')
      ? selectionResult.reason
      : null;

  return {
    ok: missingChangedTests.length === 0,
    missingChangedTests: missingChangedTests.sort(),
    unknownReason,
  };
}

/**
 * Inserta un `throw` después de los `import` estáticos de un módulo para forzar fallo al cargarlo.
 * @param {string} content
 */
export function injectThrowIntoSource(content) {
  const lines = content.split(/\r?\n/);
  let insertAt = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('import ') || trimmed.startsWith('import{') || trimmed.startsWith('import*')) {
      insertAt = i + 1;
    } else if (insertAt > 0 && trimmed === '') {
      insertAt = i + 1;
    } else if (trimmed !== '' && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*')) {
      break;
    }
  }
  lines.splice(insertAt, 0, "throw new Error('__SIGOA_HARNESS_INJECT__');");
  return lines.join('\n');
}

/**
 * Compara las pruebas que fallaron tras inyectar un defecto con la selección calculada para esa muestra.
 */
export function compareInjectFailureWithSelection({
  sampleFile,
  failedTests,
  selectionResult,
  root = repoRoot,
}) {
  const missingTests = findInsufficientSelection({
    failedTests,
    selection: selectionResult,
    root,
  });

  return {
    ok: missingTests.length === 0,
    sampleFile,
    failedCount: failedTests.length,
    missingTests,
    suggestion:
      missingTests.length > 0
        ? `Revisar scripts/ci/affected/rules.json o symbols.mjs para ${sampleFile}`
        : null,
  };
}

/**
 * Restaura un archivo modificado usando `git checkout -- <archivo>`.
 */
export function restoreFileWithGit(filePath, root = repoRoot, execFn = execFileSync) {
  execFn('git', ['checkout', '--', filePath], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function runDiffsMode(args) {
  const commitsRaw = execFileSync(
    'git',
    ['log', 'develop', '--first-parent', '--merges', `-n`, String(args.count), '--format=%H'],
    { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  )
    .split(/\r?\n/)
    .filter(Boolean);

  const items = [];
  let hasFailures = false;

  for (const sha of commitsRaw) {
    const diffFiles = execFileSync(
      'git',
      ['-c', 'core.quotepath=false', 'diff', '--name-only', '--diff-filter=d', `${sha}^1..${sha}`],
      { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    )
      .split(/\r?\n/)
      .map((f) => toPosixPath(f))
      .filter(Boolean);

    const selectionResult = runSelection({ root: repoRoot, changedFiles: diffFiles });
    const inv = checkDiffInvariants({ changedFiles: diffFiles, selectionResult });
    if (!inv.ok) hasFailures = true;

    const t = selectionResult.totals;
    const selectedTotal =
      t.backendUnit.selected + t.backendIntegration.selected + t.frontend.selected + t.shared.selected;
    const suiteTotal =
      t.backendUnit.total + t.backendIntegration.total + t.frontend.total + t.shared.total;

    items.push({
      commit: sha.slice(0, 8),
      changedCount: diffFiles.length,
      mode: selectionResult.mode,
      selectedTotal,
      suiteTotal,
      e2eScope: selectionResult.selection.e2e.scope,
      ...inv,
    });
  }

  return {
    mode: 'diffs',
    checkedAt: new Date().toISOString(),
    commitsAnalyzed: items.length,
    ok: !hasFailures,
    items,
  };
}

function runVitestJson(commandArgs, outJsonPath) {
  spawnSync('pnpm', [...commandArgs, '--reporter=json', `--outputFile.json=${outJsonPath}`], {
    cwd: repoRoot,
    shell: true,
    stdio: 'pipe',
  });
  if (!fs.existsSync(outJsonPath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(outJsonPath, 'utf8'));
    return extractFailedVitestFiles(parsed, repoRoot);
  } catch {
    return [];
  }
}

function runInjectMode(args) {
  const status = execFileSync('git', ['status', '--porcelain'], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();
  if (status !== '') {
    throw new Error('El modo --mode inject requiere el árbol de trabajo limpio.');
  }

  const samplesConfig = JSON.parse(fs.readFileSync(args.samplesPath, 'utf8'));
  const samples = samplesConfig.samples ?? [];
  const tempDir = path.join(repoRoot, 'tmp', 'perf-affected');
  fs.mkdirSync(tempDir, { recursive: true });

  let activeFile = null;
  const onSignal = () => {
    if (activeFile) {
      try {
        restoreFileWithGit(activeFile, repoRoot);
      } catch {
        // Ignorar en limpieza de señal
      }
    }
    process.exit(1);
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  const items = [];
  let allOk = true;

  try {
    for (const sample of samples) {
      const relFile = toPosixPath(sample.file);
      const absFile = path.resolve(repoRoot, relFile);
      const selectionResult = runSelection({ root: repoRoot, changedFiles: [relFile] });

      const original = fs.readFileSync(absFile, 'utf8');
      activeFile = relFile;
      try {
        fs.writeFileSync(absFile, injectThrowIntoSource(original), 'utf8');

        const failedTests = [
          ...runVitestJson(
            ['--filter', 'backend', 'exec', 'vitest', 'run', '--project', 'unit'],
            path.join(tempDir, 'harness-backend-unit.json'),
          ),
          ...runVitestJson(
            ['--filter', 'frontend', 'exec', 'vitest', 'run'],
            path.join(tempDir, 'harness-frontend.json'),
          ),
          ...runVitestJson(
            ['--filter', '@sigoa/shared', 'exec', 'vitest', 'run'],
            path.join(tempDir, 'harness-shared.json'),
          ),
        ];

        if (args.withIntegration) {
          failedTests.push(
            ...runVitestJson(
              ['--filter', 'backend', 'exec', 'vitest', 'run', '--project', 'integration'],
              path.join(tempDir, 'harness-backend-integration.json'),
            ),
          );
        }

        const comparison = compareInjectFailureWithSelection({
          sampleFile: relFile,
          failedTests,
          selectionResult,
          root: repoRoot,
        });
        if (!comparison.ok) allOk = false;
        items.push(comparison);
      } finally {
        restoreFileWithGit(relFile, repoRoot);
        activeFile = null;
      }
    }
  } finally {
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
  }

  return {
    mode: 'inject',
    checkedAt: new Date().toISOString(),
    samplesTested: items.length,
    ok: allOk,
    items,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = args.mode === 'inject' ? runInjectMode(args) : runDiffsMode(args);

  fs.mkdirSync(path.dirname(args.outPath), { recursive: true });
  fs.writeFileSync(args.outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`Informe del arnés (${report.mode}) guardado en ${path.relative(repoRoot, args.outPath)}`);
  console.log(`Resultado: ${report.ok ? 'OK' : 'CON OBSERVACIONES'}`);
  if (!report.ok) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
