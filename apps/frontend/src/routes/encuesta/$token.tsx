import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/encuesta/$token')({
  component: SurveyPublicPage,
});

function SurveyPublicPage() {
  const { token } = Route.useParams();

  return (
    <main
      role="region"
      aria-label="Encuesta pública"
      className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 p-6"
    >
      <div className="w-full max-w-lg rounded-lg border border-neutral-200 bg-white p-8 shadow-xs">
        <header className="mb-4">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Encuesta institucional
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Acceso público seguro a encuesta con token de un solo uso.
          </p>
        </header>
        <section className="rounded-md bg-neutral-100 p-4 text-xs font-mono break-all text-neutral-700">
          <span className="font-semibold text-neutral-900">Token recibido: </span>
          {token}
        </section>
      </div>
    </main>
  );
}
