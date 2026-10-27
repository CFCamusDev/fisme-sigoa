export interface ApiErrorParams {
  code: string;
  message: string;
  status?: number;
  details?: unknown;
  requestId?: string;
}

export class ApiError extends Error {
  public readonly code: string;
  public readonly status?: number;
  public readonly details?: unknown;
  public readonly requestId?: string;

  constructor(params: ApiErrorParams) {
    super(params.message);
    this.name = 'ApiError';
    this.code = params.code;
    this.status = params.status;
    this.details = params.details;
    this.requestId = params.requestId;

    // Mantiene la cadena de prototipos correcta al extender Error
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}
