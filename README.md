# FISME-SIGOA

Sistema Integrado de Gestión de Objetivos Educacionales (OE) y Atributos del Graduado (AG) del Programa de Estudios de Ingeniería de Sistemas (EPIS) de la Universidad Nacional Toribio Rodríguez de Mendoza de Amazonas (UNTRM), alineado al modelo de acreditación ICACIT.

---

## 1. Requisitos del sistema

Antes de comenzar, asegúrate de tener instaladas las siguientes herramientas en tu entorno de desarrollo:

- **Node.js**: `>= 20.19.0` (recomendado: `22 LTS`, administrable mediante `.nvmrc`).
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
