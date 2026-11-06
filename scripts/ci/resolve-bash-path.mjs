import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execSync } from 'node:child_process';

function isSystem32Bash(filePath) {
  if (!filePath) return false;
  const normalized = path.normalize(filePath).toLowerCase();
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

function findBashFromGitPath(gitPath, existsSync) {
  if (!gitPath) return null;
  let dir = path.dirname(path.normalize(gitPath));

  for (let i = 0; i < 3; i++) {
    const cand1 = path.normalize(path.join(dir, 'bin', 'bash.exe'));
    if (existsSync(cand1) && !isSystem32Bash(cand1)) {
      return cand1;
    }

    const cand2 = path.normalize(path.join(dir, 'usr', 'bin', 'bash.exe'));
    if (existsSync(cand2) && !isSystem32Bash(cand2)) {
      return cand2;
    }

    const parent = path.dirname(dir);
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

  if (env.GIT_BASH) {
    const customBash = path.normalize(env.GIT_BASH);
    if (!existsSync(customBash)) {
      throw new Error(
        `La variable de entorno GIT_BASH está definida pero el archivo no existe: "${env.GIT_BASH}". Verifique la ruta a Git Bash.`,
      );
    }
    if (isSystem32Bash(customBash)) {
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

  if (gitExe && !isSystem32Bash(gitExe)) {
    const bashFromGit = findBashFromGitPath(gitExe, existsSync);
    if (bashFromGit) {
      return bashFromGit;
    }
  }

  const standardCandidates = [
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
    env.LOCALAPPDATA ? path.join(env.LOCALAPPDATA, 'Programs', 'Git', 'bin', 'bash.exe') : null,
    env.ProgramFiles ? path.join(env.ProgramFiles, 'Git', 'bin', 'bash.exe') : null,
    env['ProgramFiles(x86)'] ? path.join(env['ProgramFiles(x86)'], 'Git', 'bin', 'bash.exe') : null,
  ].filter(Boolean);

  for (const candidate of standardCandidates) {
    const normalized = path.normalize(candidate);
    if (existsSync(normalized) && !isSystem32Bash(normalized)) {
      return normalized;
    }
  }

  throw new Error(
    'No se encontró una instalación funcional de Git Bash en Windows. ' +
      'Instale Git for Windows (https://git-scm.com/download/win) o defina la variable de entorno GIT_BASH con la ruta absoluta a bash.exe. ' +
      '(Se descarta C:\\Windows\\System32\\bash.exe por ser el puente WSL).',
  );
}
