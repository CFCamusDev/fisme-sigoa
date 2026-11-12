import { describe, expect, it } from 'vitest';
import {
  CATALOG_PERMISSIONS,
  PERMISSION_CODES,
  getPermissionDefinition,
  isPermissionCode,
  isValidPermissionCodeFormat,
  type PermissionCode,
} from './permission-catalog.js';

describe('Permission Catalog Domain (T-006-06, T-006-23, RS-010, LS 3.3)', () => {
  const STORY_PERMISSION_CODES = [
    'academico.editar',
    'academico.importar',
    'accion_mejora.avanzar',
    'accion_mejora.editar',
    'acta.anular',
    'acta.editar',
    'acta.enviar_revision',
    'acta.firmar',
    'auditoria.ver',
    'backup.descargar',
    'backup.ejecutar',
    'catalogo.editar',
    'catalogo.ver',
    'comite.editar',
    'constituyente.editar',
    'constituyente.importar',
    'constituyente.ver',
    'cronograma.editar',
    'documento.descargar',
    'ejecucion.anular',
    'ejecucion.avanzar',
    'ejecucion.cerrar',
    'ejecucion.crear',
    'ejecucion.ver',
    'encuesta.cerrar',
    'encuesta.editar',
    'encuesta.publicar',
    'encuesta.ver',
    'instrumento.aprobar',
    'instrumento.editar',
    'instrumento.enviar',
    'invitacion.enviar',
    'invitacion.reenviar',
    'invitacion.revocar',
    'matriz.editar',
    'medicion.enviar',
    'medicion.registrar',
    'medicion.revisar',
    'medicion.ver',
    'parametro.editar',
    'parametro.ver',
    'permiso.asignar',
    'plan_assessment.aprobar',
    'plan_assessment.editar',
    'plan_mejora.editar',
    'plantilla.editar',
    'plantilla.publicar',
    'plantilla.ver',
    'reporte.ver',
    'resolucion.aprobar',
    'resolucion.registrar',
    'resultado.recalcular',
    'resultado.ver',
    'rol.editar',
    'rol.ver',
    'sesion.editar',
    'usuario.crear',
    'usuario.editar',
    'usuario.ver',
  ] as const;

  it('has 72 unique permission codes', () => {
    expect(CATALOG_PERMISSIONS).toHaveLength(72);
    expect(PERMISSION_CODES).toHaveLength(72);

    const uniqueCodes = new Set(PERMISSION_CODES);
    expect(uniqueCodes.size).toBe(72);
  });

  it('every code matches recurso.accion with underscores', () => {
    for (const code of PERMISSION_CODES) {
      expect(isValidPermissionCodeFormat(code)).toBe(true);
      const parts = code.split('.');
      expect(parts).toHaveLength(2);
      expect(parts[0]).toMatch(/^[a-z]+(_[a-z]+)*$/);
      expect(parts[1]).toMatch(/^[a-z]+(_[a-z]+)*$/);
    }
  });

  it('derives the code type from the list', () => {
    const sampleCode: PermissionCode = 'usuario.ver';
    expect(isPermissionCode(sampleCode)).toBe(true);
    expect(PERMISSION_CODES.includes(sampleCode)).toBe(true);
  });

  it('rejects malformed codes', () => {
    const malformed = [
      '',
      'USUARIO.VER',
      'usuario',
      'usuario.',
      '.ver',
      'usuario..ver',
      'usuario.ver.',
      'usuario ver',
      'usuario-ver',
      'usuario.ver_1',
      'usuario_._ver',
    ];

    for (const bad of malformed) {
      expect(isValidPermissionCodeFormat(bad)).toBe(false);
      expect(isPermissionCode(bad)).toBe(false);
    }
  });

  it('resolves a definition by code and returns undefined for unknown ones', () => {
    const def = getPermissionDefinition('plan_assessment.ver');
    expect(def).toBeDefined();
    expect(def?.code).toBe('plan_assessment.ver');
    expect(def?.module).toBe('M10 Medición Directa');

    expect(getPermissionDefinition('inexistente.accion')).toBeUndefined();
  });

  it('every permission has a Spanish description and an M01–M13 module', () => {
    const modulePattern = /^M(0[1-9]|1[0-3])\s/;

    for (const p of CATALOG_PERMISSIONS) {
      expect(p.description.trim().length).toBeGreaterThan(10);
      expect(p.module).toMatch(modulePattern);
    }
  });

  it('covers every code used in the user stories', () => {
    expect(STORY_PERMISSION_CODES).toHaveLength(59);

    for (const storyCode of STORY_PERMISSION_CODES) {
      expect(isPermissionCode(storyCode)).toBe(true);
      expect(getPermissionDefinition(storyCode)).toBeDefined();
    }
  });
});
