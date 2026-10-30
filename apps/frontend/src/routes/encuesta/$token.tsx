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
      className="flex min-h-screen flex-col items-center justify-center bg-background p-6"
    >
      <div className="surface w-full max-w-lg p-8">
        <header className="mb-4">
          <h1 className="text-h2 font-bold tracking-tight text-foreground">
            Encuesta institucional
          </h1>
          <p className="mt-1 text-body text-muted-foreground">
            Acceso público seguro a encuesta con token de un solo uso.
          </p>
        </header>
        <section className="rounded-md bg-muted p-4 font-mono text-meta break-all text-muted-foreground">
          <span className="font-semibold text-foreground">Token recibido: </span>
          {token}
        </section>
      </div>
    </main>
  );
}
