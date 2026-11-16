/** Página mínima placeholder del registro maestro de constituyentes (se completa en T-021-17). */
export function StakeholdersPage() {
  return (
    <section className="space-y-6 bg-background text-foreground">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Constituyentes</h1>
        <p className="text-sm text-muted-foreground">
          Registro maestro de personas e instituciones vinculadas al programa.
        </p>
      </header>
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No hay constituyentes registrados en este momento.
      </div>
    </section>
  );
}
