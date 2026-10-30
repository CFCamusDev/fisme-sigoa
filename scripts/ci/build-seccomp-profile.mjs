/**
 * Generador determinista del perfil seccomp para Chromium en Docker.
 * Deriva del perfil oficial default.json de moby/profiles agregando
 * exclusivamente la regla incondicional para clone, setns y unshare
 * requerida por Chromium para su sandbox de user namespaces sin CAP_SYS_ADMIN.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DOCKER_DEFAULT_COMMIT_SHA = '6fe7deb1b9fb7c0397a4593480d7d22b9ee8caef';
export const DOCKER_DEFAULT_URL = `https://raw.githubusercontent.com/moby/profiles/${DOCKER_DEFAULT_COMMIT_SHA}/seccomp/default.json`;
export const DOCKER_DEFAULT_SHA256 = '6416b47770785a41ac59073cdc77d9fe98517df2799dc83ef207e622de3053f6';

/**
 * Función pura que devuelve el perfil de Chromium a partir del default de Docker.
 * @param {object} dockerDefault
 * @returns {object}
 */
export function buildChromiumProfile(dockerDefault) {
  const profile = JSON.parse(JSON.stringify(dockerDefault));

  // Regla adicional única: permitir clone, setns y unshare incondicionalmente
  // para permitir el sandbox de Chromium con user namespaces sin privilegios.
  const chromiumUserNamespaceRule = {
    names: ['clone', 'setns', 'unshare'],
    action: 'SCMP_ACT_ALLOW',
    comment: 'Permitir namespaces de usuario para el sandbox de Chromium sin CAP_SYS_ADMIN',
  };

  profile.syscalls.push(chromiumUserNamespaceRule);

  return profile;
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const rootDir = path.resolve(path.dirname(__filename), '../..');
  const dockerDefaultPath = path.resolve(rootDir, 'deploy/seccomp/docker-default.json');
  const chromiumProfilePath = path.resolve(rootDir, 'deploy/seccomp/chromium.json');

  if (!fs.existsSync(dockerDefaultPath)) {
    console.error(`ERROR: No se encontró el archivo base ${dockerDefaultPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(dockerDefaultPath, 'utf8');
  const dockerDefault = JSON.parse(raw);
  const chromiumProfile = buildChromiumProfile(dockerDefault);

  fs.writeFileSync(chromiumProfilePath, JSON.stringify(chromiumProfile, null, '\t') + '\n', 'utf8');
  console.log(`✓ Perfil seccomp para Chromium generado exitosamente en ${chromiumProfilePath}`);
}
