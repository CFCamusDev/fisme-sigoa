#!/usr/bin/env bash
# ==============================================================================
# Prueba de despliegue desde cero (HU-079, RNF-039)
# Levanta docker-compose.prod.yml con volúmenes vacíos y valores ficticios, espera a `migrate`
# (migraciones, rol de la aplicación, seed y primer administrador), inicia sesión con el
# administrador, comprueba `parametro.ver` en /me/permissions, repite `migrate` sin las
# variables ADMIN_* sin cambiar nada y elimina todo con sus volúmenes.
# Solo usa datos ficticios fijos (AGENTS §6).
# ==============================================================================
set -euo pipefail

PROJECT="sigoa-fresh-smoke"
ENV_FILE=".env.smoke-fresh.local"
BACKEND_PORT=13000
FRONTEND_PORT=18001
MIGRATE_TIMEOUT_S=300
HEALTH_TIMEOUT_S=120

DB_NAME="sigoa_smoke"
DB_USER="sigoa_smoke_owner"
ADMIN_EMAIL="admin.smoke@example.test"
ADMIN_FULL_NAME="Ana Maria Quispe Rojas"
ADMIN_DNI="10203040"
ADMIN_PASSWORD="ClaveSmoke2026Prueba"

if [ ! -f "deploy/stack.env.example" ] || [ ! -f "docker-compose.prod.yml" ]; then
  echo "ERROR: Ejecuta el script desde la raíz del repositorio." >&2
  exit 1
fi

compose() {
  docker compose -p "$PROJECT" --env-file "$ENV_FILE" -f docker-compose.prod.yml "$@"
}

cleanup() {
  echo "==> Limpiando el stack temporal y sus volúmenes..."
  if [ -f "$ENV_FILE" ]; then
    compose down -v --remove-orphans >/dev/null 2>&1 || true
    rm -f "$ENV_FILE"
  fi
}
trap cleanup EXIT

# Reemplaza KEY=valor en el archivo de entorno (el valor no puede contener | ni &)
set_var() {
  local key="$1" value="$2"
  if ! grep -q "^${key}=" "$ENV_FILE"; then
    echo "ERROR: ${key} no existe en deploy/stack.env.example." >&2
    exit 1
  fi
  sed "s|^${key}=.*|${key}=${value}|" "$ENV_FILE" > "${ENV_FILE}.tmp"
  mv "${ENV_FILE}.tmp" "$ENV_FILE"
}

echo "==> 1. Preparando el archivo de entorno de prueba desde deploy/stack.env.example..."
cp deploy/stack.env.example "$ENV_FILE"
set_var DB_NAME "$DB_NAME"
set_var DB_USER "$DB_USER"
set_var DB_PASSWORD "smoke_owner_password_123"
set_var APP_DB_PASSWORD "smoke_app_password_1234567890"
set_var SERVER_PORT "$BACKEND_PORT"
set_var FRONTEND_PORT "$FRONTEND_PORT"
set_var HSTS_ENABLED "false"
set_var TRUST_PROXY "0"
set_var RESEND_API_KEY "re_smoke_test_123456789"
set_var EMAIL_FROM "notificaciones@sigoa.untrm.edu.pe"
set_var CLOUDINARY_CLOUD_NAME "smoke-cloud"
set_var CLOUDINARY_API_KEY "123456789012345"
set_var CLOUDINARY_API_SECRET "smoke-secret-key-123"
set_var AUTH_JWT_SECRET "smoke_test_jwt_secret_minimo_32_caracteres_seguro"
set_var VITE_API_URL "http://localhost:${BACKEND_PORT}"
set_var CORS_ORIGIN "http://localhost:${FRONTEND_PORT}"
# URL pública del frontend: de ella salen el enlace de activación y el escudo de los correos
PUBLIC_URL="http://localhost:${FRONTEND_PORT}"
set_var APP_PUBLIC_URL "$PUBLIC_URL"
set_var ADMIN_EMAIL "$ADMIN_EMAIL"
set_var ADMIN_FULL_NAME "$ADMIN_FULL_NAME"
set_var ADMIN_DNI "$ADMIN_DNI"
set_var ADMIN_INITIAL_PASSWORD "$ADMIN_PASSWORD"

echo "==> 2. Eliminando restos de ejecuciones anteriores..."
compose down -v --remove-orphans >/dev/null 2>&1 || true

echo "==> 3. Levantando postgres, migrate, backend y frontend con volúmenes vacíos (docker compose up --build)..."
compose up -d --build postgres migrate backend frontend

echo "==> 4. Esperando a que migrate termine (máximo ${MIGRATE_TIMEOUT_S}s)..."
MIGRATE_ID=""
for ((i=1; i<=MIGRATE_TIMEOUT_S; i++)); do
  MIGRATE_ID=$(compose ps -aq migrate | head -n1)
  if [ -n "$MIGRATE_ID" ]; then
    STATE=$(docker inspect --format '{{.State.Status}} {{.State.ExitCode}}' "$MIGRATE_ID")
    if [ "$STATE" = "exited 0" ]; then
      break
    fi
    case "$STATE" in
      exited*)
        echo "ERROR: migrate terminó con error ($STATE)." >&2
        compose logs migrate >&2
        exit 1
        ;;
    esac
  fi
  if [ "$i" -eq "$MIGRATE_TIMEOUT_S" ]; then
    echo "ERROR: migrate no terminó en ${MIGRATE_TIMEOUT_S}s." >&2
    compose logs migrate >&2
    exit 1
  fi
  sleep 1
done
echo "✓ migrate terminó con código 0."

echo "==> 5. Esperando GET /health del backend (máximo ${HEALTH_TIMEOUT_S}s)..."
READY=0
for ((i=1; i<=HEALTH_TIMEOUT_S; i++)); do
  if curl -s -f "http://localhost:${BACKEND_PORT}/health" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done
if [ "$READY" -ne 1 ]; then
  echo "ERROR: El backend no respondió en /health tras ${HEALTH_TIMEOUT_S}s." >&2
  compose logs backend >&2
  exit 1
fi
echo "✓ El backend respondió en /health."

echo "==> 6. Iniciando sesión con el administrador creado por el seed..."
LOGIN_BODY=$(printf '{"email":"%s","password":"%s"}' "$ADMIN_EMAIL" "$ADMIN_PASSWORD")
LOGIN_RESPONSE=$(curl -s -X POST "http://localhost:${BACKEND_PORT}/auth/login" \
  -H 'Content-Type: application/json' -d "$LOGIN_BODY")
TOKEN=$(printf '%s' "$LOGIN_RESPONSE" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
if [ -z "$TOKEN" ]; then
  echo "ERROR: El inicio de sesión del administrador falló (el seed no creó la cuenta o la contraseña no coincide)." >&2
  compose logs migrate >&2
  exit 1
fi
echo "✓ El administrador inició sesión."

echo "==> 7. Comprobando parametro.ver en GET /me/permissions..."
PERMISSIONS=$(curl -s "http://localhost:${BACKEND_PORT}/me/permissions" -H "Authorization: Bearer ${TOKEN}")
if ! grep -q '"parametro.ver"' <<< "$PERMISSIONS"; then
  echo "ERROR: /me/permissions no incluye parametro.ver (el seed no cargó los permisos del administrador)." >&2
  exit 1
fi
echo "✓ El administrador tiene parametro.ver."

echo "==> 8. Comprobando que el backend en ejecución no recibe las variables ADMIN_*..."
if compose exec -T backend env | grep -q '^ADMIN_'; then
  echo "ERROR: El contenedor backend tiene variables ADMIN_* en su entorno." >&2
  exit 1
fi
echo "✓ El backend no recibe ADMIN_*."

echo "==> 8b. Comprobando que la URL pública sirve el enlace de activación y el escudo de los correos..."
if ! compose exec -T backend printenv APP_PUBLIC_URL | grep -qx "$PUBLIC_URL"; then
  echo "ERROR: El backend no usa APP_PUBLIC_URL=$PUBLIC_URL (los correos tendrían enlaces rotos)." >&2
  exit 1
fi
FRONT_READY=0
for ((i=1; i<=HEALTH_TIMEOUT_S; i++)); do
  if curl -s -f "${PUBLIC_URL}/healthz" >/dev/null 2>&1; then
    FRONT_READY=1
    break
  fi
  sleep 1
done
if [ "$FRONT_READY" -ne 1 ]; then
  echo "ERROR: El frontend no respondió en ${PUBLIC_URL}/healthz tras ${HEALTH_TIMEOUT_S}s." >&2
  compose logs frontend >&2
  exit 1
fi
# Misma ruta que construye el correo de activación (/activar/<token>): debe abrir la aplicación
ACTIVATION_STATUS=$(curl -s -o /dev/null -w '%{http_code}' "${PUBLIC_URL}/activar/token-de-prueba")
if [ "$ACTIVATION_STATUS" != "200" ]; then
  echo "ERROR: ${PUBLIC_URL}/activar/<token> respondió $ACTIVATION_STATUS (el botón del correo no abriría)." >&2
  exit 1
fi
# Escudo oficial de los correos (LogoUrlResolver: APP_PUBLIC_URL + /assets/<archivo>)
for LOGO_FILE in logo-untrm-v1-64.png logo-untrm-v1-256.png; do
  LOGO_TYPE=$(curl -s -o /dev/null -w '%{http_code} %{content_type}' "${PUBLIC_URL}/assets/${LOGO_FILE}")
  if [ "$LOGO_TYPE" != "200 image/png" ]; then
    echo "ERROR: El escudo ${PUBLIC_URL}/assets/${LOGO_FILE} respondió '$LOGO_TYPE' (el correo saldría sin logo)." >&2
    exit 1
  fi
done
echo "✓ El enlace de activación y el escudo de los correos se sirven desde ${PUBLIC_URL}."

count_users() {
  compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -tAc 'SELECT count(*) FROM users' | tr -d '[:space:]'
}

USERS_BEFORE=$(count_users)
if [ "$USERS_BEFORE" != "1" ]; then
  echo "ERROR: Se esperaba 1 usuario tras el primer despliegue y hay '$USERS_BEFORE'." >&2
  exit 1
fi

echo "==> 9. Repitiendo migrate sin las variables ADMIN_* (redespliegue)..."
(
  export ADMIN_EMAIL="" ADMIN_FULL_NAME="" ADMIN_DNI="" ADMIN_INITIAL_PASSWORD=""
  compose run --rm migrate
)
USERS_AFTER=$(count_users)
if [ "$USERS_AFTER" != "$USERS_BEFORE" ]; then
  echo "ERROR: El redespliegue cambió el recuento de usuarios ($USERS_BEFORE -> $USERS_AFTER)." >&2
  exit 1
fi

RELOGIN_RESPONSE=$(curl -s -X POST "http://localhost:${BACKEND_PORT}/auth/login" \
  -H 'Content-Type: application/json' -d "$LOGIN_BODY")
if ! grep -q '"accessToken"' <<< "$RELOGIN_RESPONSE"; then
  echo "ERROR: Tras el redespliegue el administrador ya no puede iniciar sesión con su contraseña." >&2
  exit 1
fi
echo "✓ El redespliegue no duplicó datos ni cambió la contraseña."

echo "==> Prueba de despliegue desde cero superada."
