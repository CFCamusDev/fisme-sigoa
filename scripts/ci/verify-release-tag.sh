#!/usr/bin/env bash
# ==============================================================================
# Verificación de etiqueta de versión (release tag) para despliegue
# Valida formato SemVer (vX.Y.Z), integración en main y PR de origen
# ==============================================================================
set -euo pipefail

TAG_NAME="${1:-${GITHUB_REF_NAME:-}}"
COMMIT_SHA="${GITHUB_SHA:-$(git rev-parse HEAD)}"

if [ -z "$TAG_NAME" ]; then
  echo "ERROR: No se proporcionó el nombre de la etiqueta de versión (TAG_NAME)." >&2
  exit 1
fi

echo "==> Verificando etiqueta de versión '$TAG_NAME' en commit $COMMIT_SHA..."

# 1. Validación de formato de versión semántica (vX.Y.Z estricto)
if [[ ! "$TAG_NAME" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "ERROR: La etiqueta '$TAG_NAME' no cumple el formato semántico 'vX.Y.Z' (ejemplo: v1.0.0)." >&2
  echo "Se rechazan sufijos pre-release, etiquetas sin 'v' o formatos numéricos no estándar." >&2
  exit 1
fi

EXPECTED_VERSION="${TAG_NAME#v}"

# 2. Validación de ancestralidad con la rama principal (main)
MAIN_REF="origin/main"
if ! git rev-parse --verify "$MAIN_REF" >/dev/null 2>&1; then
  if git rev-parse --verify "main" >/dev/null 2>&1; then
    MAIN_REF="main"
  else
    echo "ERROR: No se encontró la referencia 'origin/main' ni 'main' en el repositorio." >&2
    exit 1
  fi
fi

if ! git merge-base --is-ancestor "$COMMIT_SHA" "$MAIN_REF"; then
  echo "ERROR: El commit $COMMIT_SHA asociado a la etiqueta '$TAG_NAME' no es ancestro de '$MAIN_REF'." >&2
  echo "Las etiquetas de versión solo deben crearse sobre commits integrados en la rama principal ('main')." >&2
  exit 1
fi

echo "✓ El commit $COMMIT_SHA está integrado en '$MAIN_REF'."

# 3. Validación de procedencia desde un PR fusionado a main
if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: La herramienta GitHub CLI (gh) no está disponible en el entorno." >&2
  exit 1
fi

REPO="${GITHUB_REPOSITORY:-local/repo}"
if ! PULLS_JSON=$(gh api "repos/${REPO}/commits/${COMMIT_SHA}/pulls" 2>/dev/null); then
  echo "ERROR: No se pudo consultar a GitHub los Pull Requests del commit $COMMIT_SHA (revisa el permiso pull-requests: read del workflow)." >&2
  exit 1
fi

export EXPECTED_VERSION
export TAG_NAME

VALIDATION_RESULT=$(node -e "
const fs = require('fs');
try {
  const input = fs.readFileSync(0, 'utf-8');
  const pulls = JSON.parse(input);
  if (!Array.isArray(pulls)) {
    process.exit(1);
  }
  const tagVersion = process.env.EXPECTED_VERSION;
  const match = pulls.find(p => p.state === 'closed' && p.merged_at && p.base && p.base.ref === 'main');
  if (!match) {
    console.error('ERROR: El commit no proviene de ningún Pull Request fusionado hacia \"main\".');
    process.exit(1);
  }
  const headRef = match.head ? match.head.ref : '';
  const branchMatch = headRef.match(/^(release|hotfix)\/(\d+\.\d+\.\d+)$/);
  if (!branchMatch) {
    console.error(\`ERROR: La rama de origen del PR #\${match.number} ('\${headRef}') no es una rama release/X.Y.Z o hotfix/X.Y.Z autorizada.\`);
    process.exit(2);
  }
  const branchVersion = branchMatch[2];
  if (branchVersion !== tagVersion) {
    console.error(\`ERROR: Discrepancia de versión: la etiqueta es '\${process.env.TAG_NAME}' (versión \${tagVersion}), pero el PR #\${match.number} proviene de la rama '\${headRef}' (versión \${branchVersion}).\`);
    process.exit(3);
  }
  console.log(\`\${match.number}|\${headRef}\`);
  process.exit(0);
} catch (err) {
  console.error('ERROR al analizar la respuesta de la API de GitHub:', err.message);
  process.exit(4);
}
" <<< "$PULLS_JSON")

PR_NUMBER="${VALIDATION_RESULT%%|*}"
PR_BRANCH="${VALIDATION_RESULT##*|}"

echo "✓ Confirmado: La etiqueta '$TAG_NAME' es válida, pertenece a '$MAIN_REF' y proviene del PR #$PR_NUMBER ('$PR_BRANCH') fusionado a 'main'."
