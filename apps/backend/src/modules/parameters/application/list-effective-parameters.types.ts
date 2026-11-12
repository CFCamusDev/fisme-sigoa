export interface ListEffectiveParametersQuery {
  readonly actorId: string;
  /** Semestre consultado; sin él rige el último semestre iniciado hasta hoy. */
  readonly semesterCode?: string;
}
