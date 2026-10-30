export interface ApiErrorParams {
  code: string;
  message: string;
  status?: number;
  details?: unknown;
  requestId?: string;
  retryAfterSeconds?: number;
}

export class ApiError extends Error {
  public readonly code: string;
  public readonly status?: number;
  public readonly details?: unknown;
  public readonly requestId?: string;
  public readonly retryAfterSeconds?: number;

  constructor(params: ApiErrorParams) {
    super(params.message);
    this.name = 'ApiError';
    this.code = params.code;
    this.status = params.status;
    this.details = params.details;
    this.requestId = params.requestId;
    this.retryAfterSeconds = params.retryAfterSeconds;

    // Mantiene la cadena de prototipos correcta al extender Error
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}
