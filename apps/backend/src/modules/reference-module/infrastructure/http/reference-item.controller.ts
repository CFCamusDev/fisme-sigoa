import type { Request, Response, NextFunction } from 'express';
import type { CreateReferenceItemUseCase } from '../../application/create-reference-item.js';
import { getValidated } from '../../../../shared/middleware/validate-request.js';
import type { CreateReferenceItemInput } from './reference-item.schema.js';

export class ReferenceItemController {
  constructor(private readonly createUseCase: CreateReferenceItemUseCase) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = getValidated<CreateReferenceItemInput>(res);
      const input = validated?.body ?? req.body;
      const result = await this.createUseCase.execute(input);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };
}
