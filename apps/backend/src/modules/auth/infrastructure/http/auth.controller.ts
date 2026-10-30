import type { Request, Response, NextFunction } from 'express';
import { loginResponseSchema, type LoginRequest } from '@sigoa/shared';
import { getValidated } from '../../../../shared/middleware/validate-request.js';
import type { LoginUseCase } from '../../application/login.js';

export class AuthController {
  constructor(private readonly loginUseCase: LoginUseCase) {}

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { body } = getValidated<LoginRequest>(res);
      const ip =
        (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
        req.ip ||
        req.socket.remoteAddress ||
        '';

      const result = await this.loginUseCase.execute({
        email: body.email,
        password: body.password,
        ip,
      });

      // Parseo estricto de la respuesta para garantizar cumplimiento de Ley 29733 (sin filtrar campos sensibles)
      const parsedResponse = loginResponseSchema.parse(result);

      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Pragma', 'no-cache');
      res.status(200).json(parsedResponse);
    } catch (error) {
      next(error);
    }
  };
}
