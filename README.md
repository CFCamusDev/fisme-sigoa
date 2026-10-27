# FISME-SIGOA

Sistema Integrado de Gestión de Objetivos Educacionales (OE) y Atributos del Graduado (AG) del Programa de Estudios de Ingeniería de Sistemas (EPIS) de la Universidad Nacional Toribio Rodríguez de Mendoza de Amazonas (UNTRM), alineado al modelo de acreditación ICACIT.

---

## 1. Requisitos del sistema

Antes de comenzar, asegúrate de tener instaladas las siguientes herramientas en tu entorno de desarrollo:

- **Node.js**: `>= 22.22.1` (22 LTS, administrable con `.nvmrc`).
- **pnpm**: `>= 10.0.0` (gestor de paquetes del monorepo; configurado con `packageManager: pnpm@10.8.0`).
- **Git**: Versión reciente con soporte para hooks de preparación.
- **Docker y Docker Compose**: Para levantar servicios locales como la base de datos PostgreSQL.

---

## 2. Estructura del monorepo

El proyecto está organizado como un monorepo administrado con **pnpm workspaces**:

```text
fisme-sigoa/
├── apps/
│   ├── backend/        # API REST con Node.js, Express, TypeScript y Prisma (arquitectura hexagonal)
│   └── frontend/       # SPA con React, TypeScript, Vite, TanStack Router y Tailwind CSS
├── packages/
│   └── shared/         # Tipos y esquemas de validación Zod compartidos (@sigoa/shared)
├── docs/               # Documentación funcional, técnica y Definition of Done
├── .github/            # Workflows de CI/CD para GitHub Actions
└── .husky/             # Hooks de Git locales (pre-commit y commit-msg)
```

---

## 3. Instalación y puesta en marcha

Sigue estos pasos para clonar e inicializar el entorno de desarrollo:

1. **Clonar el repositorio**:

   ```bash
   git clone <url-del-repositorio>
   cd fisme-sigoa
   ```

2. **Instalar dependencias del workspace**:

   ```bash
   pnpm install
   ```

   _Nota:_ Este comando inicializa automáticamente los hooks de calidad local mediante `husky`.

3. **Variables de entorno**:
   - Cada aplicación (`apps/backend`, `apps/frontend`) requiere su respectivo archivo `.env`. Copia las plantillas `.env.example`:
     ```bash
     cp apps/backend/.env.example apps/backend/.env
     cp apps/frontend/.env.example apps/frontend/.env
     ```
   - En `apps/frontend/.env`, configura `VITE_API_URL=http://localhost:3000` apuntando a la raíz del servidor backend (sin prefijo de ruta ni barra final). Esta variable es obligatoria y se valida estrictamente en runtime.
   - En `apps/backend/.env`, configura `PORT=3000`, `NODE_ENV=development` y la cadena de conexión a PostgreSQL.

### Imagen Docker del backend

La imagen de producción (`apps/backend/Dockerfile`) se construye desde la raíz del monorepo mediante un proceso multietapa:

```bash
docker build -f apps/backend/Dockerfile -t fisme-backend .
```

- Incluye el binario del sistema de **Chromium headless** (`/usr/bin/chromium`) para generación de reportes PDF con Puppeteer.
- Flags obligatorios para Puppeteer en el contenedor: `--no-sandbox`, `--disable-dev-shm-usage`, `--disable-gpu`.
- Se recomienda configurar `shm_size: 256m` o superior en Docker Compose.
- Ejecuta bajo el usuario no root `node` y expone un `HEALTHCHECK` sobre `/health`.

### Imagen Docker del frontend (Nginx)

La imagen de producción (`apps/frontend/Dockerfile`) compila la SPA y la sirve a través de un servidor web Nginx Alpine optimizado:

```bash
docker build -f apps/frontend/Dockerfile --build-arg VITE_API_URL=http://localhost:3000 -t fisme-frontend .
```

- Servidor web en puerto 80 con soporte de enrutamiento SPA (`try_files $uri $uri/ /index.html`).
- Compresión gzip activada y caché inmutable para activos en `/assets/`.
- Cabecera `Cache-Control: no-cache, no-store, must-revalidate` en `index.html` para despliegues instantáneos.
- Endpoint de verificación de salud en `/healthz`.

### Stack completo de desarrollo con Docker Compose

El repositorio incluye un archivo `docker-compose.yml` multietapa en la raíz para ejecutar el stack completo (PostgreSQL, ejecutor de migraciones Prisma, backend Express con Chromium headless y frontend SPA en Nginx):

1. **Configuración de variables (opcional):**
   El archivo `.env.example` en la raíz contiene las variables por defecto seguras para desarrollo. Si deseas personalizarlas, crea un archivo `.env` en la raíz:

   ```bash
   cp .env.example .env
   ```

2. **Levantar el stack completo:**

   ```bash
   docker compose up --build -d
   ```
   - `postgres`: Base de datos PostgreSQL 16 con healthcheck activo (puerto local `127.0.0.1:5433` para evitar conflictos con instancias nativas).
   - `migrate`: Contenedor transitorio que ejecuta `prisma migrate deploy` una vez la base de datos está lista.
   - `backend`: Servidor Express compilado corriendo bajo el usuario `node` en `http://localhost:3000`.
   - `frontend`: Servidor web Nginx Alpine sirviendo la aplicación SPA en `http://localhost:8001`.

3. **Verificar el estado del stack:**

   ```bash
   docker compose ps
   curl http://localhost:3000/health
   curl http://localhost:8001/healthz
   ```

4. **Detener y limpiar los contenedores:**
   ```bash
   docker compose down -v
   ```

### Stack de producción y staging (`docker-compose.prod.yml`)

Para entornos de staging o producción en VPS (gestionados con Portainer y Nginx Proxy Manager según `docs/despliegue.md`), se utiliza `docker-compose.prod.yml`. Este archivo aísla la base de datos (sin puerto expuesto al exterior), requiere variables obligatorias de entorno y acota los límites de memoria por servicio:

1. **Configurar el archivo de variables:**
   Copia la plantilla `deploy/stack.env.example` y asigna contraseñas seguras y URLs oficiales:

   ```bash
   cp deploy/stack.env.example .env.prod
   ```

2. **Levantar el stack con variables de producción:**

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.prod up --build -d
   ```

3. **Verificar estado de los servicios:**

   ```bash
   docker compose -f docker-compose.prod.yml ps
   curl http://localhost:3000/health
   curl http://localhost:8001/healthz
   ```

4. **Detener el stack:**
   ```bash
   docker compose -f docker-compose.prod.yml down
   ```

### Respaldo y restauración de base de datos

Tanto el stack de desarrollo como el de producción integran el servicio de respaldo automático `postgres-backup-local` (`prodrigestivill/postgres-backup-local:16`), el cual ejecuta respaldos diarios (`@daily`) con una retención rotativa de 30 días (conforme a **RNF-023**):

1. **Ubicación y retención de respaldos:**
   Los respaldos se almacenan comprimidos en formato `.sql.gz` dentro del volumen nombrado `pg_backups` (ruta `/backups` dentro del contenedor). Las variables `BACKUP_KEEP_DAYS=30`, `BACKUP_KEEP_WEEKS=0` y `BACKUP_KEEP_MONTHS=0` garantizan la depuración automática de copias con más de 30 días de antigüedad.

2. **Generar un respaldo inmediato manualmente:**
   Para forzar la creación de un punto de restauración antes de una actualización o mantenimiento:

   ```bash
   docker compose exec backup /backup.sh
   docker compose exec backup ls -lh /backups
   ```

3. **Procedimiento de restauración de respaldo:**
   Para restaurar un volcado en una base de datos PostgreSQL:
   ```bash
   # Opción A: Restaurar en la base de datos activa
   docker compose exec -T backup sh -c "gunzip -c /backups/<archivo_respaldo>.sql.gz" | docker compose exec -T postgres psql -U postgres -d sigoa_dev

   # Opción B: Restaurar en una base de datos limpia de verificación
   docker compose exec postgres createdb -U postgres sigoa_restore_test
   docker compose exec -T backup sh -c "gunzip -c /backups/<archivo_respaldo>.sql.gz" | docker compose exec -T postgres psql -U postgres -d sigoa_restore_test
   docker compose exec postgres psql -U postgres -d sigoa_restore_test -c "\dt"
   docker compose exec postgres dropdb -U postgres sigoa_restore_test
   ```

### Base de datos local (PostgreSQL)

Para iniciar una instancia local de PostgreSQL en desarrollo utilizando Docker:

```bash
docker run --name fisme-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=sigoa_dev -p 5432:5432 -d postgres:16
```

Configura en `apps/backend/.env`:

```text
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sigoa_dev?schema=public"
```

Aplica las migraciones y ejecuta el semillero inicial (idempotente):

```bash
pnpm --filter backend db:migrate
pnpm --filter backend db:seed
```

### Roles de Base de Datos y Política Append-Only (RS-040, RNF-014)

El sistema implementa una separación estricta de roles a nivel de PostgreSQL para garantizar la inmutabilidad de la auditoría:

1. **Separación de roles:**
   - **Rol dueño / migraciones (`DB_USER`):** Dueño de las tablas y del esquema. Es utilizado exclusivamente por el servicio `migrate` para ejecutar migraciones de Prisma y por el servicio `backup` para generar volcados completos.
   - **Rol de grupo `sigoa_app` (`NOLOGIN`):** Rol del clúster con acceso `USAGE` al esquema `public`, `SELECT` e `INSERT` sobre `audit_logs`, y explícitamente **sin permisos de `UPDATE`, `DELETE` ni `TRUNCATE`** (mediante `REVOKE`). En `audit_chain_heads` posee `SELECT, INSERT, UPDATE` pero `REVOKE DELETE, TRUNCATE`.
   - **Login de la aplicación (`APP_DB_USER` / `APP_DB_PASSWORD`):** Usuario no superusuario miembro de `sigoa_app`. El backend Express se conecta obligatoriamente con este usuario, asegurando que cualquier intento de alterar o borrar registros de auditoría sea rechazado a nivel de motor por PostgreSQL.

2. **Aprovisionamiento automático e idempotente:**
   - En despliegues con Docker Compose, el contenedor `migrate` ejecuta:
     ```bash
     pnpm exec prisma migrate deploy && pnpm run db:provision-app-role
     ```
   - Si el rol no existe, se crea; si ya existe, se actualizan sus credenciales y restricciones. Si la verificación de seguridad falla (por ejemplo, si tiene privilegios de más), el servicio aborta con código de salida ≠ 0 y el backend no arranca.
   - En desarrollo local sin Docker:
     ```bash
     pnpm --filter backend db:provision-app-role
     ```

3. **Rotación de contraseñas:**
   - Para rotar la contraseña del rol de aplicación, actualiza la variable `APP_DB_PASSWORD` en el archivo `.env` o en la configuración de la pila en Portainer y redespliega el servicio `migrate`. El aprovisionador ejecuta `ALTER ROLE` y valida la conectividad sin afectar las tablas ni requerir reinicializar volúmenes.

4. **Restauración de respaldos en un clúster nuevo:**
   - Los volcados de `pg_dump` no respaldan roles globales del clúster. Al restaurar un respaldo en un servidor PostgreSQL en blanco:
     1. Crear manualmente el rol de grupo base:
        ```sql
        CREATE ROLE sigoa_app NOLOGIN;
        ```
     2. Restaurar el archivo `.sql` o `.sql.gz`.
     3. Ejecutar el servicio `migrate` (`docker compose run --rm migrate` o `pnpm --filter backend db:provision-app-role`) para crear automáticamente el usuario `APP_DB_USER` y otorgarle su membresía en `sigoa_app`.

5. **Pasos manuales para el administrador en servidores (Staging / Producción):**
   - Antes de redesplegar el stack en Portainer, agregar `APP_DB_USER` y `APP_DB_PASSWORD` (mínimo 16 caracteres de `[A-Za-z0-9_-]`) en las variables del entorno del stack.

### Pruebas de integración y base de datos de test

Las pruebas de integración del backend (`*.integration.test.ts`) se ejecutan contra una base de datos PostgreSQL real. Por seguridad, el sistema aborta de inmediato (`assertTestDatabase`) si el nombre de la base de datos no termina en `_test`, protegiendo la base de desarrollo o producción de cualquier truncado accidental.

- Asegúrate de tener el contenedor de PostgreSQL iniciado (`fisme-postgres`).
- El proceso de `globalSetup` de Vitest crea automáticamente la base de datos `sigoa_test` y aplica las migraciones de Prisma.
- Cada suite de integración ejecuta un reseteo limpio (`TRUNCATE ... RESTART IDENTITY CASCADE`) antes de cada test.
- Comandos:
  ```bash
  pnpm --filter backend test:unit        # Ejecuta solo pruebas unitarias (sin base de datos)
  pnpm --filter backend test:integration # Ejecuta pruebas de integración contra la BD de prueba
  `
  ```

### Pruebas End-to-End (Playwright)

Las pruebas E2E verifican la integración completa de la interfaz de usuario con el backend y la base de datos de pruebas PostgreSQL:

- Requiere el navegador Chromium instalado (pnpm --filter frontend exec playwright install chromium).
- Inicia automáticamente el servidor backend en puerto 3100 apuntando a sigoa_test y el servidor frontend en puerto 4173.
- Comando:
  `ash
  pnpm test:e2e
  ```

  ```

---

## 4. Scripts disponibles

Desde la raíz del monorepo se pueden ejecutar los siguientes scripts en todos los paquetes del workspace:

| Comando              | Descripción                                                                   |
| -------------------- | ----------------------------------------------------------------------------- |
| `pnpm lint`          | Ejecuta el análisis estático de código con ESLint en todo el proyecto.        |
| `pnpm format`        | Aplica el formato automático de código con Prettier.                          |
| `pnpm format:check`  | Verifica que todos los archivos cumplan con las reglas de estilo de Prettier. |
| `pnpm typecheck`     | Comprueba la tipificación estricta de TypeScript (`tsc --noEmit`).            |
| `pnpm test`          | Ejecuta la suite de pruebas unitarias y de integración.                       |
| `pnpm test:coverage` | Ejecuta las pruebas generando reporte de cobertura de código.                 |
| `pnpm test:e2e`      | Ejecuta las pruebas end-to-end (Playwright) levantando frontend y backend.    |
| `pnpm build`         | Compila todos los paquetes y aplicaciones para producción.                    |
| `pnpm depcruise`     | Valida las reglas de arquitectura hexagonal y dependencias permitidas.        |

También puedes ejecutar comandos en un paquete específico utilizando filtros de pnpm:

```bash
pnpm --filter backend <script>
pnpm --filter frontend <script>
pnpm --filter @sigoa/shared <script>
```

---

## 5. Convenciones de desarrollo

### Flujo de ramas (GitFlow)

- **`main`**: Rama de producción. Solo recibe merges provenientes de ramas de `release/` o `hotfix/`.
- **`develop`**: Rama de integración continua. Base para todas las características y correcciones.
- **Ramas de trabajo**: Se crean siempre a partir de `develop` actualizado con la nomenclatura:
  - `feature/HU-xxx-descripcion`
  - `fix/HU-xxx-descripcion`
  - `bug/HU-xxx-descripcion`
  - `refactor/HU-xxx-descripcion`
  - `test/HU-xxx-descripcion`
  - `chore/HU-xxx-descripcion`

### Protección de ramas y hooks de Git

Para evitar modificaciones accidentales en las ramas de integración y producción (especialmente en repositorios sin plan GitHub Pro):

- **Hook local `pre-push` (`.husky/pre-push`)**: Husky intercepta el comando `git push` en los clones de desarrollo y bloquea automáticamente cualquier intento de empujar cambios directos hacia `main` o `develop`. Todo cambio hacia dichas ramas debe canalizarse obligatoriamente mediante un Pull Request.
- **Hooks de commit**: Husky ejecuta `lint-staged` (`pre-commit`) para formateo y verificación estática, y `commitlint` (`commit-msg`) para validar el estándar de Conventional Commits.

### Formato de commits (Conventional Commits)

Los commits deben seguir la especificación estricta de Conventional Commits con mensaje en **inglés**, modo imperativo, sin punto final, y con longitud máxima de cabecera de 72 caracteres:

```text
type(scope): imperative description

Refs: HU-xxx, T-xxx-yy
```

- **Tipos permitidos**: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `build`, `ci`, `style`.
- **Scope**: Módulo o paquete afectado (`monorepo`, `backend`, `frontend`, `shared`, etc.).
- **Pie obligatorio**: Referencia a la historia de usuario y tarea correspondiente (`Refs: HU-xxx, T-xxx-yy`).

Los hooks pre-commit (`lint-staged`) y commit-msg (`commitlint`) validarán automáticamente los archivos modificados y el formato del mensaje antes de confirmar el commit.

---

## 6. Despliegue y versiones

### Verificación de imágenes en etiquetas de versión (Release tags)

Al crear y publicar una etiqueta con formato semántico `vX.Y.Z` (por ejemplo `v0.1.0`), GitHub Actions dispara automáticamente el flujo `.github/workflows/release.yml`, el cual ejecuta el script `scripts/ci/smoke-image.sh`:

- Compila las imágenes Docker de producción (`backend` multietapa con Chromium headless y `frontend` con Nginx Alpine).
- Inicia contenedores de prueba efímeros y comprueba que:
  - El backend se ejecute bajo el usuario no root `node` y responda `200 OK` en `GET /health`.
  - El frontend responda `200 OK` en `GET /healthz` y devuelva las cabeceras de seguridad requeridas (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`).
- Si alguna imagen falla al construir o al iniciar, el flujo aborta en rojo antes de que la versión sea desplegada en el servidor.

### Despliegue automático a Staging (Portainer Webhook)

Al fusionar un Pull Request hacia la rama `develop`, GitHub Actions ejecuta `.github/workflows/deploy-staging.yml` para actualizar el stack de staging en Portainer:

- **Interruptor de despliegue**: Requiere configurar la variable de repositorio `STAGING_ENABLED="true"` en GitHub. Si la variable no está activada, el flujo se omite para evitar intentos fallidos antes de configurar el entorno.
- **Protección contra push directo**: El script `scripts/ci/verify-merged-pr.sh` comprueba que el commit provenga de un Pull Request cerrado y fusionado a `develop`; ante cualquier empujón directo sin PR, el job aborta inmediatamente en rojo impidiendo el despliegue.
- **Disparo seguro por webhook**: Utiliza el secreto de repositorio `PORTAINER_STAGING_WEBHOOK_URL` ejecutando `scripts/ci/trigger-portainer.sh`, el cual cuenta con reintentos automáticos y enmascara la URL en los registros de salida.
- **Validación de salud en Staging**: El script `scripts/ci/wait-for-health.sh` consulta periódicamente la variable de repositorio `STAGING_HEALTH_URL` (exigiendo protocolo seguro HTTPS conforme a **RNF-001**) hasta recibir `200 OK` con `{"status":"ok"}`.

### Despliegue a Producción (manual por etiqueta en Portainer)

En producción, la estabilidad y la gobernanza exigen aprobación humana y fijación estricta de versiones. Por ello, el stack de producción en Portainer apunta directamente a una referencia de etiqueta Git (`refs/tags/vX.Y.Z`) y **no utiliza webhook automático**.

El procedimiento de despliegue de una versión oficial es el siguiente:

1. **Fusión del PR de lanzamiento en `main`**: El Pull Request desde `release/X.Y.Z` o `hotfix/X.Y.Z` hacia `main` debe haberse completado mediante un _merge commit_, con todos los flujos de verificación en verde (`convenciones`, `calidad`, `seguridad` y `e2e`).
2. **Creación y publicación de la etiqueta**:
   ```bash
   git checkout main
   git pull origin main
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```
3. **Verificación automatizada en GitHub Actions (`release.yml`)**:
   - El job `verificar` ejecuta `scripts/ci/verify-release-tag.sh`: valida que la etiqueta cumpla `^v[0-9]+\.[0-9]+\.[0-9]+$`, que pertenezca al historial de `main` y que provenga de un PR fusionado cuya versión coincida exactamente.
   - El job `images` ejecuta `scripts/ci/smoke-image.sh` garantizando que las imágenes compilen y pasen sus pruebas de humo.
   - El job `resumen` genera una guía en el resumen de ejecución.
4. **Respaldo previo en el servidor VPS**:
   Antes de desplegar una nueva versión (especialmente si incluye cambios de esquema de base de datos), realizar un respaldo manual de la base de datos de producción:
   ```bash
   docker exec fisme-postgres-backup /backup.sh
   ```
5. **Actualización de referencia en Portainer**:
   - Acceder al panel de **Portainer** → **Stacks** → stack de producción (`fisme-sigoa-prod`).
   - Ir a la pestaña **Git repository**.
   - Cambiar **Repository reference** al nuevo tag: `refs/tags/vX.Y.Z`.
   - Confirmar que **GitOps updates** permanezca **desactivado**.
   - Hacer clic en **Pull and redeploy**.
6. **Ejecución de migraciones y verificación**:
   - El servicio `migrate` de `docker-compose.prod.yml` ejecuta automáticamente `prisma migrate deploy` antes de levantar el backend.
   - Verificar la respuesta del backend: `curl -fsSL https://<api-domain>/health` (debe responder `200 OK` con `{"status":"ok"}`).
   - Comprobar la carga del frontend y las cabeceras de seguridad en el navegador.

### Procedimiento de reversión (Rollback en Producción)

Si surge algún incidente crítico tras un despliegue en producción:

1. En Portainer, acceder al stack de producción (`fisme-sigoa-prod`).
2. En **Repository reference**, volver a colocar la etiqueta de la versión anterior (por ejemplo `refs/tags/vX.Y.(Z-1)`).
3. Si la versión problemática ejecutó migraciones incompatibles, restaurar el respaldo de base de datos generado en el paso previo:
   ```bash
   gunzip -c /ruta/backups/<archivo-respaldo>.sql.gz | docker exec -i fisme-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB
   ```
4. Hacer clic en **Pull and redeploy** en Portainer para compilar y levantar los contenedores en la versión anterior estable.
