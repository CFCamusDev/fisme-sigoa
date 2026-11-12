# Registro de cambios

Todos los cambios relevantes de FISME-SIGOA se documentan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versionado semántico.

## [0.1.0] - Base

Primer release: base técnica, seguridad, parámetros y despliegue automatizado.
Incluye 18 historias de usuario.

### EP-00 Habilitadoras técnicas

- HU-074 Monorepo, Docker y CI.
- HU-075 Base de auditoría transversal (tabla append-only).
- HU-076 Adaptadores de correo y archivos.
- HU-077 Sistema de diseño institucional y verificación de tokens.
- HU-078 Pruebas rápidas y verificación en paralelo.
- HU-079 Despliegue desde cero automatizado (migraciones, semilla y primer administrador).

### EP-01 M01 Seguridad

- HU-001 Iniciar sesión.
- HU-002 Mantener y cerrar sesión.
- HU-003 Gestionar usuarios.
- HU-004 Activar cuenta y crear contraseña.
- HU-005 Recuperar contraseña.
- HU-006 Gestionar roles.
- HU-007 Asignar roles y permisos a un usuario.
- HU-008 Autorizar operaciones por permiso.

### EP-02 M02 Parámetros y catálogos base

- HU-009 Configurar el programa.
- HU-010 Gestionar semestres.
- HU-011 Gestionar parámetros con vigencia.
- HU-012 Gestionar escalas de respuesta.

### Herramientas

- La verificación local previa al push acepta ramas `release/X.Y.Z` y `hotfix/X.Y.Z` y el pie `Refs: T-REL-nnn-nn`.
