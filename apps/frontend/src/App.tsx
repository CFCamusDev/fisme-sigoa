import { Button } from './components/ui/button.js';

export function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-bold tracking-tight text-neutral-900">FISME-SIGOA</h1>
      <p className="text-neutral-600">
        Sistema Integrado de Gestión de Objetivos Educacionales y Atributos del Graduado (EPIS
        UNTRM)
      </p>
      <div className="flex gap-2">
        <Button variant="default">Botón Principal</Button>
        <Button variant="outline">Botón Secundario</Button>
      </div>
    </main>
  );
}

export default App;
