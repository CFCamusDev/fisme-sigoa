import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execSync } from 'node:child_process';

function isSystem32Bash(filePath, pathImpl = path) {
  if (!filePath) return false;
  const normalized = pathImpl.normalize(filePath).toLowerCase();
  return normalized.includes('system32\\bash.exe') || normalized.includes('system32/bash.exe');
}

function defaultLocateGit() {
  try {
    const output = execSync('where.exe git', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    const lines = output.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const valid = lines.find((line) => !line.toLowerCase().includes('system32'));
    return valid || null;
  } catch {
    return null;
  }
}

function findBashFromGitPath(gitPath, existsSync, pathImpl = path) {
  if (!gitPath) return null;
  let dir = pathImpl.dirname(pathImpl.normalize(gitPath));

  for (let i = 0; i < 3; i++) {
    const cand1 = pathImpl.normalize(pathImpl.join(dir, 'bin', 'bash.exe'));
    if (existsSync(cand1) && !isSystem32Bash(cand1, pathImpl)) {
      return cand1;
    }

    const cand2 = pathImpl.normalize(pathImpl.join(dir, 'usr', 'bin', 'bash.exe'));
    if (existsSync(cand2) && !isSystem32Bash(cand2, pathImpl)) {
      return cand2;
    }

    const parent = pathImpl.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return null;
}

/**
 * Resuelve la ruta ejecutable a bash.
 * En Linux y macOS devuelve 'bash'.
 * En Windows busca Git Bash evitando el stub WSL de System32.
 */
export function resolveBashPath({
  platform = process.platform,
  env = process.env,
  existsSync = fs.existsSync,
  locateGit = defaultLocateGit,
} = {}) {
  if (platform !== 'win32') {
    return 'bash';
  }

  const pathImpl = path.win32;

  if (env.GIT_BASH) {
    const customBash = pathImpl.normalize(env.GIT_BASH);
    if (!existsSync(customBash)) {
      throw new Error(
        `La variable de entorno GIT_BASH está definida pero el archivo no existe: "${env.GIT_BASH}". Verifique la ruta a Git Bash.`,
      );
    }
    if (isSystem32Bash(customBash, pathImpl)) {
      throw new Error(
        `La variable de entorno GIT_BASH apunta a "${env.GIT_BASH}" (puente WSL de System32). Se requiere el bash nativo de Git for Windows.`,
      );
    }
    return customBash;
  }

  let gitExe = null;
  try {
    gitExe = locateGit();
  } catch {
    gitExe = null;
  }

  if (gitExe && !isSystem32Bash(gitExe, pathImpl)) {
    const bashFromGit = findBashFromGitPath(gitExe, existsSync, pathImpl);
    if (bashFromGit) {
      return bashFromGit;
    }
  }

  const standardCandidates = [
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
    env.LOCALAPPDATA ? pathImpl.join(env.LOCALAPPDATA, 'Programs', 'Git', 'bin', 'bash.exe') : null,
    env.ProgramFiles ? pathImpl.join(env.ProgramFiles, 'Git', 'bin', 'bash.exe') : null,
    env['ProgramFiles(x86)'] ? pathImpl.join(env['ProgramFiles(x86)'], 'Git', 'bin', 'bash.exe') : null,
  ].filter(Boolean);

  for (const candidate of standardCandidates) {
    const normalized = pathImpl.normalize(candidate);
    if (existsSync(normalized) && !isSystem32Bash(normalized, pathImpl)) {
      return normalized;
    }
  }

  throw new Error(
    'No se encontró una instalación funcional de Git Bash en Windows. ' +
      'Instale Git for Windows (https://git-scm.com/download/win) o defina la variable de entorno GIT_BASH con la ruta absoluta a bash.exe. ' +
      '(Se descarta C:\\Windows\\System32\\bash.exe por ser el puente WSL).',
  );
}
