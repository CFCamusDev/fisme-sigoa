#!/usr/bin/env bash
# ==============================================================================
# Verificación de construcción y salud de imágenes Docker (Backend y Frontend)
# Incluye validación de endurecimiento del contenedor y soporte Open Sans en PDF
# ==============================================================================
set -euo pipefail

BACKEND_IMG="fisme-backend:smoke-${RANDOM}"
FRONTEND_IMG="fisme-frontend:smoke-${RANDOM}"
BACKEND_CONTAINER="smoke-backend-${RANDOM}"
FRONTEND_CONTAINER="smoke-frontend-${RANDOM}"

SECCOMP_ARGS=()
if [ -f "deploy/seccomp/chromium.json" ]; then
  SECCOMP_ARGS=("--security-opt" "seccomp=deploy/seccomp/chromium.json")
fi

cleanup() {
  echo "==> Limpiando contenedores e imágenes temporales..."
  docker rm -f "$BACKEND_CONTAINER" >/dev/null 2>&1 || true
  docker rm -f "$FRONTEND_CONTAINER" >/dev/null 2>&1 || true
  docker rmi -f "$BACKEND_IMG" >/dev/null 2>&1 || true
  docker rmi -f "$FRONTEND_IMG" >/dev/null 2>&1 || true
}

trap cleanup EXIT

echo "==> 1. Construyendo imagen del backend (target runtime)..."
docker build -f apps/backend/Dockerfile --target runtime -t "$BACKEND_IMG" .

echo "==> 2. Construyendo imagen del frontend (Nginx Alpine)..."
docker build -f apps/frontend/Dockerfile --build-arg VITE_API_URL="http://localhost:3000" -t "$FRONTEND_IMG" .

echo "==> 3. Ejecutando contenedor de prueba para backend con restricciones de producción..."
docker run -d --name "$BACKEND_CONTAINER" \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  "${SECCOMP_ARGS[@]}" \
  --read-only \
  --tmpfs /tmp:size=256M \
  --pids-limit 512 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e DATABASE_URL="postgresql://user:pass@localhost:5432/sigoa_smoke?schema=public" \
  -e CORS_ORIGIN="http://localhost:8001" \
  -p 3000:3000 "$BACKEND_IMG"

echo "==> 4. Verificando que el backend no corre como root..."
CONTAINER_USER=$(docker inspect --format '{{.Config.User}}' "$BACKEND_CONTAINER")
if [ "$CONTAINER_USER" != "node" ]; then
  echo "ERROR: El backend se está ejecutando como '$CONTAINER_USER', se esperaba 'node'." >&2
  exit 1
fi
echo "✓ Backend ejecuta con el usuario no privilegiado 'node'."

echo "==> 5. Esperando respuesta HTTP 200 en GET /health del backend..."
RETRIES=30
READY=0
for ((i=1; i<=RETRIES; i++)); do
  if curl -s -f "http://localhost:3000/health" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done

if [ "$READY" -ne 1 ]; then
  echo "ERROR: El backend no respondió exitosamente en /health tras ${RETRIES}s." >&2
  docker logs "$BACKEND_CONTAINER" >&2
  exit 1
fi
echo "✓ Backend respondió exitosamente en /health bajo sistema de archivos de solo lectura."

docker rm -f "$BACKEND_CONTAINER" >/dev/null 2>&1

echo "==> 6. Verificando generación de PDF con Open Sans y Chromium con sandbox en contenedor endurecido..."
docker run --rm -i \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  "${SECCOMP_ARGS[@]}" \
  --read-only \
  --tmpfs /tmp:size=256M \
  --pids-limit 512 \
  -e NODE_ENV=production \
  --entrypoint node \
  "$BACKEND_IMG" \
  --input-type=module < scripts/ci/verify-pdf-font.mjs
echo "✓ Open Sans y sandbox de Chromium verificados exitosamente."

echo "==> 7. Ejecutando contenedor de prueba para frontend..."
docker run -d --name "$FRONTEND_CONTAINER" -p 8089:80 "$FRONTEND_IMG"

echo "==> 8. Esperando respuesta HTTP 200 en GET /healthz del frontend..."
READY=0
for ((i=1; i<=RETRIES; i++)); do
  if curl -s -f "http://localhost:8089/healthz" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done

if [ "$READY" -ne 1 ]; then
  echo "ERROR: El frontend no respondió exitosamente en /healthz tras ${RETRIES}s." >&2
  docker logs "$FRONTEND_CONTAINER" >&2
  exit 1
fi
echo "✓ Frontend respondió exitosamente en /healthz."

echo "==> 9. Verificando cabeceras de seguridad en frontend..."
HEADERS=$(curl -s -I "http://localhost:8089/")
if ! grep -qi "X-Frame-Options: DENY" <<< "$HEADERS"; then
  echo "ERROR: No se encontró la cabecera 'X-Frame-Options: DENY' en la respuesta del frontend." >&2
  exit 1
fi
if ! grep -qi "X-Content-Type-Options: nosniff" <<< "$HEADERS"; then
  echo "ERROR: No se encontró la cabecera 'X-Content-Type-Options: nosniff' en la respuesta del frontend." >&2
  exit 1
fi
echo "✓ Cabeceras de seguridad verificadas en el frontend."

echo "==> Todas las verificaciones de imágenes Docker pasaron exitosamente."
