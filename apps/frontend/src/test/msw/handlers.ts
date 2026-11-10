import { http, HttpResponse } from 'msw';

export const DEFAULT_TEST_PERMISSIONS = [
  { code: 'usuario.ver', scope: 'GLOBAL' as const },
  { code: 'usuario.crear', scope: 'GLOBAL' as const },
  { code: 'usuario.editar', scope: 'GLOBAL' as const },
  { code: 'rol.ver', scope: 'GLOBAL' as const },
  { code: 'rol.editar', scope: 'GLOBAL' as const },
  { code: 'permiso.asignar', scope: 'GLOBAL' as const },
  { code: 'parametro.ver', scope: 'GLOBAL' as const },
  { code: 'parametro.editar', scope: 'GLOBAL' as const },
];

export const handlers = [
  http.get('http://localhost:3000/health', () => {
    return HttpResponse.json({ status: 'ok' });
  }),
  http.get('http://localhost:3000/me/permissions', () => {
    return HttpResponse.json({ permissions: DEFAULT_TEST_PERMISSIONS });
  }),
];
