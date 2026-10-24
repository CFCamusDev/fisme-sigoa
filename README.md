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
