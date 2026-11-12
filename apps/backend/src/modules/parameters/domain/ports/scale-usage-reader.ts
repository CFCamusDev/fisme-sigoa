/** Indica si una escala la usa una pregunta de una encuesta publicada (RF-012, RN-052). */
export interface ScaleUsageReader {
  isInUse(scaleId: string): Promise<boolean>;
}
