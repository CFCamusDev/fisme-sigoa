export type ImportStep = 1 | 2 | 3;

export interface ImportStepDescriptor {
  readonly step: ImportStep;
  readonly label: string;
}

export const IMPORT_STEPS: readonly ImportStepDescriptor[] = [
  { step: 1, label: 'Plantilla' },
  { step: 2, label: 'Vista previa' },
  { step: 3, label: 'Confirmación' },
];

export function getImportStep(hasPreview: boolean, isConfirmingStep: boolean): ImportStep {
  if (!hasPreview) {
    return 1;
  }
  return isConfirmingStep ? 3 : 2;
}
