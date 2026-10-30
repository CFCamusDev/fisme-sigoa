import { createFileRoute, Outlet } from '@tanstack/react-router';
import { Logo } from '@/components/common/logo';

export const Route = createFileRoute('/_auth')({
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Saltar al contenido principal
      </a>

      {/* Panel izquierdo institucional: azul institucional con motivo y escudo oficial */}
      <aside className="brand-motif relative flex min-h-[120px] flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-700 to-brand-800 p-6 text-brand-50 lg:min-h-screen lg:w-1/2 lg:p-12">
        <div className="flex items-center gap-4 lg:flex-col lg:items-start lg:gap-6">
          <Logo variant="square" size={88} className="size-14 shrink-0 lg:size-[88px]" />
          <div className="space-y-1">
            <span className="block text-h3 font-bold tracking-tight text-primary-foreground lg:text-h1">
              FISME-SIGOA
            </span>
            <p className="hidden text-meta text-brand-100 sm:block lg:text-body">
              Sistema Integrado de Gestión de Objetivos Educacionales y Atributos del Graduado
            </p>
          </div>
        </div>

        <div className="hidden text-meta text-brand-200 lg:block">
          <p>Universidad Nacional Toribio Rodríguez de Mendoza de Amazonas</p>
          <p>Facultad de Ingeniería de Sistemas y Mecánica Eléctrica · EPIS</p>
        </div>
      </aside>

      {/* Panel derecho blanco con formulario de login */}
      <main
        id="main-content"
        tabIndex={-1}
        className="flex flex-1 items-center justify-center p-6 outline-none lg:p-12"
      >
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
