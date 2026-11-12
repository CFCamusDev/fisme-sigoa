<!--
PLANTILLA POR DEFECTO · Ramas de trabajo → develop
Tipos: feature/ · fix/ · bug/ · docs/ · refactor/ · test/ · chore/
Rama:   tipo/HU-xxx-descripcion-corta
Título: tipo(módulo): HU-xxx descripción      ej. feat(encuestas): HU-034 constructor de encuestas
Merge:  Squash merge (el título será el commit en develop)
DoD completa: docs/DEFINITION_OF_DONE.md (sección 2)
Marca [x] lo cumplido. Si un ítem no aplica, márcalo y escribe "N/A" al lado.
-->

## 1. Identificación

| Campo               | Valor            |
| ------------------- | ---------------- |
| Historia de usuario | HU-xxx — título  |
| Requerimiento(s)    | RF-xxx / RNF-xxx |
| Reglas              | RN-xxx · RS-xxx  |
| Épica / módulo      | EP-xx · Mxx      |

**Tipo de cambio** (marca uno)

- [ ] `feature` — funcionalidad nueva
- [ ] `fix` / `bug` — corrección en develop
- [ ] `refactor` — sin cambio de comportamiento
- [ ] `test` — solo pruebas
- [ ] `docs` — solo documentación
- [ ] `chore` — configuración, dependencias, CI

## 2. Descripción

**Qué cambia:**

**Cómo probarlo localmente:**

1.
2.

**Capturas o video** (si toca la interfaz):

## 3. Criterios de aceptación de la HU

<!-- Copia los CA de la HU y marca cada uno. Cada CA debe tener al menos una prueba. -->

- [ ] CA1 — … · prueba: `ruta/al/test`
- [ ] CA2 — … · prueba: `ruta/al/test`

## 4. DoD base (todos los PR)

**Validado por el CI** (no se puede hacer merge si falla)

- [ ] Nombre de rama y título del PR con el formato correcto
- [ ] Lint, Prettier y typecheck sin errores
- [ ] Pruebas en verde; cobertura ≥ 80 % en casos de uso y dominio (RNF-030)
- [ ] Build de frontend y backend correcto
- [ ] `npm audit` sin vulnerabilidades altas ni críticas (RNF-011)
- [ ] Regla de dependencias de la arquitectura hexagonal cumplida (RNF-026)

**Revisión manual**

- [ ] El código vive en el módulo/feature que corresponde; el dominio no importa Express, Prisma ni librerías de infraestructura (RNF-026)
- [ ] `packages/shared` solo recibe código usado por 3 o más módulos y sin lógica de negocio (RNF-027)
- [ ] Sin `any` injustificado; TypeScript estricto (RNF-029)
- [ ] Sin secretos, tokens ni datos reales en el código, los logs o las pruebas (RNF-010)
- [ ] Mensajes de error claros para el usuario; sin trazas internas en respuestas (RNF-024, RNF-037)
- [ ] Commits con Conventional Commits
- [ ] Documentación actualizada si cambia el uso (README, OpenAPI, comentarios de dominio)

## 5. Secciones condicionales

> Marca solo las que aplican al PR y completa su checklist.

### 5.1 Lógica de negocio o caso de uso nuevo

- [ ] Aplica
- [ ] El caso de uso verifica el permiso `recurso.acción` y su alcance Global/Propio (RS-002, RNF-009)
- [ ] Las transiciones de estado respetan la máquina de estados de LS-OEAG-001 sección 5
- [ ] Toda operación que cambia datos o estado registra auditoría en la **misma transacción** (RS-020, RNF-016, RNF-022)
- [ ] No modifica nada Cerrado, Firmado o Aprobado (RNF-017)
- [ ] Prueba unitaria del caso de uso con los ports mockeados

### 5.2 API / endpoint nuevo o modificado

- [ ] Aplica
- [ ] Entrada validada con el esquema Zod compartido en front y back (RNF-008)
- [ ] Prueba de integración (Supertest) del caso exitoso, de validación y de **403 sin permiso**
- [ ] Contrato OpenAPI actualizado (RNF-032)
- [ ] p95 esperado < 500 ms en consulta / < 1 s en escritura (RNF-018)

### 5.3 Endpoint público (encuesta, activación, recuperación)

- [ ] Aplica
- [ ] Rate limit configurado (RNF-007)
- [ ] Token validado en servidor: vigencia, uso único, revocación; se guarda solo el hash (RNF-005)
- [ ] No expone datos personales de terceros (RNF-012)
- [ ] Usable desde 360 px (RNF-034)

### 5.4 Base de datos (Prisma)

- [ ] Aplica
- [ ] Migración generada y versionada; se aplica desde cero sin errores
- [ ] Migración reversible o con nota de cómo revertir
- [ ] Índices para las nuevas consultas frecuentes
- [ ] Seed actualizado si agrega catálogos, permisos o parámetros
- [ ] No se otorga UPDATE/DELETE sobre `Auditoria` (RNF-014)

### 5.5 Permisos, roles o seguridad

- [ ] Aplica
- [ ] Permisos nuevos agregados al catálogo y a la matriz por defecto del seed (LS 3.3)
- [ ] El frontend oculta las acciones sin permiso (`usePermission`)
- [ ] Contraseñas y tokens con hash; nada sensible en logs (RNF-002, RNF-005)

### 5.6 Parámetros o reglas configurables

- [ ] Aplica
- [ ] El valor se lee del parámetro vigente del semestre, no está fijo en código (RN-005)
- [ ] El cálculo guarda el snapshot de parámetros usados (RS-054)

### 5.7 Documentos / PDF / plantillas

- [ ] Aplica
- [ ] Se genera desde la versión de plantilla y la guarda en el documento (RN-004)
- [ ] Respeta el formato institucional (RNF-040); generación < 10 s (RNF-021)
- [ ] La descarga oficial se audita (RS-043)

### 5.8 Archivos y correo

- [ ] Aplica
- [ ] Usa los puertos `FileStorage` / `EmailSender`, no el SDK directo (RNF-033)
- [ ] Tipo y tamaño de archivo validados; se guarda el hash (RNF-013)

### 5.9 Interfaz (frontend)

- [ ] Aplica
- [ ] Componentes dentro de su feature (api, components, hooks, schemas, stores, types) (RNF-028)
- [ ] Estados de carga, vacío y error contemplados
- [ ] Textos en español; fechas dd/mm/aaaa (RNF-035)
- [ ] Navegable con teclado; componentes shadcn/ui (RNF-036)
- [ ] Colores solo con los tokens del sistema de diseño: sin `neutral-*`, `sky-*` ni hexadecimales sueltos; `check-design-tokens` en verde
- [ ] Estados con ícono y texto (nunca solo color); contraste AA; logo con `Logo` y documentos con el escudo oficial
- [ ] Prueba de componente (RTL) para formularios críticos

## 6. Riesgos o notas para el revisor

<!-- Deuda técnica, decisiones tomadas, algo que revisar con atención. -->

---

- [ ] Revisé mi propio diff completo antes de pedir el merge
