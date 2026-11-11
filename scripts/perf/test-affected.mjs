#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Paquetes con pruebas unitarias relacionadas por `vitest related` (HU-078, D8).
 * Los archivos de E2E y las pruebas de integración no entran: tienen su propio comando.
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
 * @returns {{ base: string, dryRun: boolean }}
 */
export function parseArgs(argv) {
  const result = { base: 'develop', dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--base') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new Error('--base requiere una rama o commit.');
      result.base = value;
      i += 1;
    } else if (arg === '--dry-run') {
      result.dryRun = true;
    } else {
      throw new Error(`Argumento desconocido: ${arg}`);
    }
  }
  return result;
}

/**
 * Reparte los archivos cambiados por paquete, con rutas relativas al paquete y separadores `/`.
 * Descarta lo que no es código, los archivos de E2E, las salidas generadas y lo de otros paquetes.
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
 * Construye un comando `vitest related` por cada paquete con archivos cambiados.
 * @param {{ backend: string[], frontend: string[], shared: string[] }} groups
 * @returns {Array<{ id: string, command: string, files: string[] }>}
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

function git(args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean);
}

/** Archivos cambiados desde `base` (incluye lo no confirmado) más los archivos sin seguimiento. */
export function collectChangedFiles(base) {
  const changed = git([
    '-c',
    'core.quotepath=false',
    'diff',
    '--name-only',
    '--diff-filter=d',
    base,
  ]);
  const untracked = git(['ls-files', '--others', '--exclude-standard']);
  return [...changed, ...untracked];
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const groups = classifyChangedFiles(collectChangedFiles(args.base));
  const commands = buildAffectedCommands(groups);

  if (commands.length === 0) {
    console.log('No hay archivos de código cambiados: no se ejecuta ninguna prueba.');
    return;
  }

  let failed = false;
  for (const { id, command, files } of commands) {
    console.log(`\n[${id}] ${files.length} archivo(s) cambiado(s)`);
    if (args.dryRun) {
      console.log(command);
      continue;
    }
    const result = spawnSync(command, { cwd: repoRoot, shell: true, stdio: 'inherit' });
    if (result.status !== 0) failed = true;
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
