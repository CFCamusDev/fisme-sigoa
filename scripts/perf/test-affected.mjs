#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectChangedFiles, runSelection } from '../ci/affected/select.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export { collectChangedFiles };

/**
 * Paquetes con pruebas unitarias (HU-078, D8).
 */
export const PACKAGES = [
  { id: 'backend', prefix: 'apps/backend/', filter: 'backend', extraArgs: ['--project', 'unit'] },
  { id: 'frontend', prefix: 'apps/frontend/', filter: 'frontend', extraArgs: [] },
  { id: 'shared', prefix: 'packages/shared/', filter: '@sigoa/shared', extraArgs: [] },
];

const CODE_FILE_REGEX = /\.(ts|tsx|mjs|js)$/;
const IGNORED_FRAGMENTS = ['/node_modules/', '/dist/', '/coverage/', '/test-results/'];

/**
 * Interpreta los argumentos.
 * @param {string[]} argv
 * @returns {{ base: string, dryRun: boolean, explain: boolean, all: boolean }}
 */
export function parseArgs(argv) {
  const result = { base: 'develop', dryRun: false, explain: false, all: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--base') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new Error('--base requiere una rama o commit.');
      result.base = value;
      i += 1;
    } else if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (arg === '--explain') {
      result.explain = true;
    } else if (arg === '--all') {
      result.all = true;
    } else {
      throw new Error(`Argumento desconocido: ${arg}`);
    }
  }
  return result;
}

/**
 * Reparte los archivos cambiados por paquete, con rutas relativas al paquete y separadores `/`.
 * @param {string[]} files
 * @returns {{ backend: string[], frontend: string[], shared: string[] }}
 */
export function classifyChangedFiles(files) {
  const groups = { backend: [], frontend: [], shared: [] };
  const seen = new Set();
  for (const raw of files) {
    const file = raw.trim().replace(/\\/g, '/');
    if (!file || seen.has(file)) continue;
    seen.add(file);
    if (!CODE_FILE_REGEX.test(file)) continue;
    if (IGNORED_FRAGMENTS.some((fragment) => `/${file}`.includes(fragment))) continue;
    for (const pkg of PACKAGES) {
      if (!file.startsWith(pkg.prefix)) continue;
      const relative = file.slice(pkg.prefix.length);
      if (pkg.id === 'frontend' && relative.startsWith('e2e/')) break;
      groups[pkg.id].push(relative);
      break;
    }
  }
  return groups;
}

function quote(value) {
  return `"${value}"`;
}

/**
 * Construye comandos `vitest related` por paquete (compatibilidad con pruebas previas).
 * @param {{ backend: string[], frontend: string[], shared: string[] }} groups
 */
export function buildAffectedCommands(groups) {
  const commands = [];
  for (const pkg of PACKAGES) {
    const files = groups[pkg.id];
    if (!files || files.length === 0) continue;
    const args = [
      `pnpm --filter ${pkg.filter} exec vitest related`,
      ...files.map(quote),
      '--run',
      '--passWithNoTests',
      ...pkg.extraArgs,
    ];
    commands.push({ id: pkg.id, command: args.join(' '), files });
  }
  return commands;
}

const SELECTION_SUITES = [
  {
    key: 'backendUnit',
    id: 'backend-unit',
    prefix: 'apps/backend/',
    filter: 'backend',
    extraArgs: ['--project', 'unit'],
  },
  {
    key: 'backendIntegration',
    id: 'backend-integration',
    prefix: 'apps/backend/',
    filter: 'backend',
    extraArgs: ['--project', 'integration'],
    requiresPostgres: true,
  },
  {
    key: 'frontend',
    id: 'frontend',
    prefix: 'apps/frontend/',
    filter: 'frontend',
    extraArgs: [],
  },
  {
    key: 'shared',
    id: 'shared',
    prefix: '@sigoa/shared/',
    repoPrefix: 'packages/shared/',
    filter: '@sigoa/shared',
    extraArgs: [],
  },
];

/**
 * Construye comandos `vitest run` a partir del resultado del motor de selección.
 * @param {ReturnType<typeof runSelection>} result
 * @param {{ all?: boolean }} [options]
 */
export function buildCommandsFromSelection(result, options = {}) {
  const forceAll = Boolean(options.all) || result.mode === 'all';
  const commands = [];

  for (const suite of SELECTION_SUITES) {
    const stripPrefix = suite.repoPrefix ?? suite.prefix;
    const rawFiles = result.selection?.[suite.key] ?? [];
    const relFiles = rawFiles.map((file) =>
      file.startsWith(stripPrefix) ? file.slice(stripPrefix.length) : file,
    );

    if (forceAll) {
      const args = [`pnpm --filter ${suite.filter} exec vitest run`, ...suite.extraArgs];
      commands.push({
        id: suite.id,
        command: args.join(' '),
        files: relFiles,
        requiresPostgres: Boolean(suite.requiresPostgres),
      });
      continue;
    }

    if (relFiles.length === 0) continue;

    const args = [
      `pnpm --filter ${suite.filter} exec vitest run`,
      ...suite.extraArgs,
      ...relFiles.map(quote),
    ];
    commands.push({
      id: suite.id,
      command: args.join(' '),
      files: relFiles,
      requiresPostgres: Boolean(suite.requiresPostgres),
    });
  }

  return commands;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = runSelection({ base: args.base });
  const commands = buildCommandsFromSelection(result, { all: args.all });

  if (args.explain) {
    console.log(`Modo: ${args.all ? 'all (--all)' : result.mode} · Motivo: ${result.reason}`);
    for (const item of result.explain) {
      console.log(`  - ${item.target}: ${item.reason}`);
    }
  }

  if (commands.length === 0) {
    console.log('No hay pruebas afectadas seleccionadas.');
    return;
  }

  let failed = false;
  for (const { id, command, files, requiresPostgres } of commands) {
    const countLabel = args.all || result.mode === 'all' ? 'suite completa' : `${files.length} archivo(s)`;
    console.log(`\n[${id}] ${countLabel}`);
    if (requiresPostgres) {
      console.log('Nota: las pruebas de integración requieren PostgreSQL activo.');
    }
    if (args.dryRun) {
      console.log(command);
      continue;
    }
    const execResult = spawnSync(command, { cwd: repoRoot, shell: true, stdio: 'inherit' });
    if (execResult.status !== 0) {
      if (requiresPostgres) {
        console.error(
          '[backend-integration] Falló la ejecución. Verifica que PostgreSQL esté levantado.',
        );
      }
      failed = true;
    }
  }
  process.exitCode = failed ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
