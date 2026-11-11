import type { ResponseScale, ScaleType } from '../entities/response-scale.js';

export interface ResponseScaleReader {
  list(filter?: { type?: ScaleType }): Promise<ResponseScale[]>;
  findById(id: string): Promise<ResponseScale | null>;
  findByCode(code: string): Promise<ResponseScale | null>;
}
