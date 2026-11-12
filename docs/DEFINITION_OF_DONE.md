# Definition of Done (DoD)

**FISME-SIGOA · Sistema Integrado de Gestión de Objetivos Educacionales y Atributos del Graduado — EPIS / UNTRM**
Código: DOD-OEAG-001 · Versión 1.0 (22/10/2026) · Autor: Est. Camus Aguirre Cristoper Fernando

Documentos relacionados: LN-OEAG-001 (reglas RN) · LS-OEAG-001 (reglas RS) · RQ-OEAG-001 (RF/RNF) · HU-OEAG-001 (historias) · Definición Técnica (sección 6, GitFlow).

---

## 1. Propósito y niveles

Una historia o versión está **terminada** solo cuando cumple sus criterios de aceptación **y** la DoD de su nivel. Los criterios de aceptación son propios de cada HU; la DoD es igual para todas y verifica la calidad.

| Nivel | Rama → destino | Plantilla | Merge |
|---|---|---|---|
| Feature | `feature/ fix/ bug/ docs/ refactor/ test/ chore/` → `develop` | `.github/pull_request_template.md` (se carga sola) | Squash |
| Release | `release/X.Y.Z` → `main` (y de vuelta a `develop`) | `.github/PULL_REQUEST_TEMPLATE/release.md` | Merge commit |
| Hotfix | `hotfix/X.Y.Z` (desde `main`) → `main` y `develop` | `.github/PULL_REQUEST_TEMPLATE/hotfix.md` | Merge commit |

Abrir un PR con plantilla específica:

```
https://github.com/<owner>/<repo>/compare/main...release/X.Y.Z?template=release.md
https://github.com/<owner>/<repo>/compare/main...hotfix/X.Y.Z?template=hotfix.md
```

### Convenciones

| Elemento | Formato | Ejemplo |
|---|---|---|
| Rama de trabajo | `tipo/HU-xxx-descripcion-corta` | `feature/HU-034-constructor-encuesta` |
| Título PR a develop | `tipo(módulo): HU-xxx descripción` | `feat(encuestas): HU-034 constructor de encuestas` |
| Rama / título release | `release/X.Y.Z` · `release: vX.Y.Z — nombre` | `release: v0.3.0 — Encuestas y actas` |
| Rama / título hotfix | `hotfix/X.Y.Z` · `fix(módulo): hotfix vX.Y.Z descripción` | `fix(encuestas): hotfix v1.0.1 token expira antes` |
| Versión | SemVer; hotfix sube el parche | `v1.0.0` → `v1.0.1` |

Tipos de rama y su prefijo de commit: `feature→feat`, `fix/bug→fix`, `docs→docs`, `refactor→refactor`, `test→test`, `chore→chore`.

---

## 2. DoD de feature (rama de trabajo → develop)

### 2.1 Siempre

| # | Criterio | Verifica | Origen |
|---|---|---|---|
| F01 | HU, RF y reglas referenciados en el PR | Manual | Trazabilidad RN→RS→RF→HU |
| F02 | Todos los criterios de aceptación de la HU cumplidos, cada uno con al menos una prueba | Manual | HU-OEAG-001 |
| F03 | Nombre de rama y título del PR con formato correcto; misma HU en ambos | **CI** | GitFlow |
| F04 | Lint, Prettier y typecheck sin errores | **CI** | RNF-029, RNF-031 |
| F05 | Pruebas en verde; cobertura ≥ 80 % en casos de uso y dominio | **CI** | RNF-030 |
| F06 | Build correcto | **CI** | — |
| F07 | `npm audit` sin vulnerabilidades altas ni críticas | **CI** | RNF-011 |
| F08 | Regla de dependencias hexagonal: el dominio no importa infraestructura | **CI** + manual | RNF-026 |
| F09 | `shared` solo con código usado por 3+ módulos, sin lógica de negocio | Manual | RNF-027 |
| F10 | Sin secretos ni datos reales en código, logs o pruebas | Manual | RNF-010 |
| F11 | Errores claros al usuario, sin trazas internas | Manual | RNF-024, RNF-037 |
| F12 | Conventional Commits; documentación actualizada si cambia el uso | Manual | RNF-031, RNF-032 |
| F13 | Autorrevisión del diff completo | Manual | — |

### 2.2 Condicionales (según lo que toque el PR)

| Sección | Aplica cuando… | Criterios clave | Origen |
|---|---|---|---|
| Lógica de negocio | Hay caso de uso nuevo o modificado | Permiso y alcance verificados; transiciones según LS sección 5; auditoría en la misma transacción; no toca lo Cerrado/Firmado/Aprobado; prueba unitaria con ports mockeados | RS-002, RS-020, RNF-016, RNF-017, RNF-022 |
| API | Endpoint nuevo o modificado | Zod compartido; pruebas de integración: éxito, validación y 403; OpenAPI; p95 | RNF-008, RNF-009, RNF-018, RNF-032 |
| Endpoint público | Encuesta, activación o recuperación | Rate limit; token en servidor (hash, uso único, vigencia); sin datos de terceros; 360 px | RNF-005, RNF-007, RNF-012, RNF-034 |
| Base de datos | Cambia el esquema Prisma | Migración versionada y probada desde cero; reversible; índices; seed; sin UPDATE/DELETE en Auditoria | RNF-014 |
| Permisos / seguridad | Permisos, roles, contraseñas o tokens | Catálogo y matriz del seed; UI oculta acciones; hashes; nada sensible en logs | LS 3.3, RNF-002, RNF-005 |
| Parámetros | Usa una regla configurable | Lee el parámetro vigente; guarda snapshot | RN-005, RS-054 |
| Documentos / PDF | Genera anexos o actas | Versión de plantilla guardada; formato institucional; < 10 s; descarga auditada | RN-004, RNF-021, RNF-040 |
| Archivos y correo | Sube archivos o envía correos | Puertos `FileStorage` / `EmailSender`; tipo, tamaño y hash | RNF-013, RNF-033 |
| Interfaz | Cambia el frontend | Feature-based; estados de carga/vacío/error; español y dd/mm/aaaa; teclado; solo tokens del sistema de diseño (sin colores sueltos); estados con ícono y texto; prueba RTL en formularios críticos | RNF-028, RNF-035, RNF-036 |

Para `docs/`, `test/` y `chore/` las secciones que no aplican se marcan **N/A**.

---

## 3. DoD de release (release/X.Y.Z → main)

| Bloque | Criterios | Origen |
|---|---|---|
| Contenido | Lista de HU con su PR; HU que quedan fuera y motivo; sin funcionalidades nuevas en la rama release | Plan de entregas HU-OEAG-001 |
| Calidad | CI en verde sobre la rama release; `npm audit` limpio | RNF-011, RNF-030 |
| Pruebas | End-to-end de los flujos del release; acceso por cada rol; encuesta en 360 px; desempeño; inmutabilidad | RNF-017 a RNF-021, RNF-034 |
| Datos | Migraciones sobre copia de producción; seed probado; backup previo; restauración probada; integridad de auditoría antes y después | RNF-015, RNF-023 |
| Documentación | CHANGELOG; versión en package.json; manual de usuario; OpenAPI; `.env.example` | RNF-032 |
| Despliegue | Staging con el mismo docker compose; plan de rollback; prueba de humo; HTTPS y cabeceras | RNF-001, RNF-006, RNF-039 |
| Cierre | Tag `vX.Y.Z`; merge de vuelta a develop; borrar rama; (opcional) demo al asesor/Comité con fecha | GitFlow |

---

## 4. DoD de hotfix (hotfix/X.Y.Z → main → develop)

| Momento | Criterios |
|---|---|
| **Antes de desplegar (obligatorio)** | Incidente descrito (impacto, reproducción, causa raíz); cambio mínimo sin features; prueba automatizada que reproduce el error; CI en verde; backup; integridad de auditoría; plan de rollback; verificación en producción |
| **Cierre inmediato** | Tag `vX.Y.Z`; merge a develop (o a la release abierta); aviso a afectados si corresponde |
| **Dentro de 24 h** | CHANGELOG; versión en package.json; manual si cambia el uso; lección aprendida (qué prueba faltaba y cuál se agregó) |

Un hotfix **nunca** corrige datos a mano: si hay que corregir datos, se usa un script versionado y auditado. Nunca toca registros Cerrados, Firmados, Aprobados ni la auditoría (RNF-014, RNF-017).

---

## 5. Verificación automática (CI)

Workflow: `.github/workflows/pr-checks.yml`. Configurar sus jobs como *required status checks* en la protección de `main` y `develop`.

| Job | Verifica | Criterio DoD |
|---|---|---|
| `convenciones` | Nombre de rama, título del PR, HU coincidente; a main solo release/hotfix | F03 |
| `calidad` | Lint, Prettier, typecheck, dependency-cruiser, migraciones desde cero, pruebas con cobertura ≥ 80 %, build | F04, F05, F06, F08 |
| `seguridad` | `pnpm audit --audit-level high` | F07 |

Configuración requerida en el repositorio:

- `package.json` raíz con los scripts `lint`, `format:check`, `typecheck`, `test:coverage`, `build`, `depcruise`.
- `vitest.config.ts` con `coverage.thresholds` en 80 para casos de uso y dominio.
- `.dependency-cruiser.cjs` con la regla: `modules/*/domain` no puede importar `express`, `@prisma/client`, `infrastructure` ni otro módulo.
- Protección de ramas en GitHub: `main` y `develop` solo por PR, checks obligatorios, sin push directo; squash habilitado para develop y merge commit para main.

---

## 6. Mantenimiento de la DoD

La DoD se revisa al cerrar cada release. Un cambio de la DoD se hace por PR `docs/HU-xxx-…` que actualiza este archivo y las plantillas a la vez.
