import type { RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';
import type { ValidationDetail } from '@sigoa/shared';
import { ValidationError } from '../errors/app-error.js';

export interface RequestValidationSchemas<TBody = unknown, TParams = unknown, TQuery = unknown> {
  body?: ZodType<TBody>;
  params?: ZodType<TParams>;
  query?: ZodType<TQuery>;
}

export interface ValidatedRequest<TBody = unknown, TParams = unknown, TQuery = unknown> {
  body: TBody;
  params: TParams;
  query: TQuery;
}

export function validateRequest<TBody, TParams, TQuery>(
  schemas: RequestValidationSchemas<TBody, TParams, TQuery>,
): RequestHandler {
  return (req, res, next) => {
    const details: ValidationDetail[] = [];
    let parsedBody: TBody | undefined;
    let parsedParams: TParams | undefined;
    let parsedQuery: TQuery | undefined;

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        for (const issue of result.error.issues) {
          const path = issue.path.length > 0 ? `body.${issue.path.join('.')}` : 'body';
          details.push({ path, message: issue.message });
        }
      } else {
        parsedBody = result.data;
        req.body = result.data;
      }
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        for (const issue of result.error.issues) {
          const path = issue.path.length > 0 ? `params.${issue.path.join('.')}` : 'params';
          details.push({ path, message: issue.message });
        }
      } else {
        parsedParams = result.data;
        req.params = result.data as Record<string, string>;
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        for (const issue of result.error.issues) {
          const path = issue.path.length > 0 ? `query.${issue.path.join('.')}` : 'query';
          details.push({ path, message: issue.message });
        }
      } else {
        parsedQuery = result.data;
      }
    }

    if (details.length > 0) {
      next(new ValidationError('La solicitud contiene errores de validación', details));
      return;
    }

    res.locals['validated'] = {
      body: parsedBody,
      params: parsedParams,
      query: parsedQuery,
    };

    next();
  };
}

export function getValidated<TBody = unknown, TParams = unknown, TQuery = unknown>(
  res: Response,
): ValidatedRequest<TBody, TParams, TQuery> {
  return res.locals['validated'] as ValidatedRequest<TBody, TParams, TQuery>;
}
