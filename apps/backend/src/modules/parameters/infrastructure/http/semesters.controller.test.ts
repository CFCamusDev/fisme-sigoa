import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { SemestersController } from './semesters.controller.js';
import type { CreateSemesterUseCase } from '../../application/create-semester.js';
import type { ListSemestersUseCase } from '../../application/list-semesters.js';
import { UnauthorizedError } from '../../../../shared/errors/app-error.js';

describe('SemestersController (unit tests, T-010-07, T-010-08, CA1, CA2, CA3)', () => {
  let mockCreateSemesterUseCase: CreateSemesterUseCase;
  let mockListSemestersUseCase: ListSemestersUseCase;
  let controller: SemestersController;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    mockCreateSemesterUseCase = {
      execute: vi.fn(),
    } as unknown as CreateSemesterUseCase;

    mockListSemestersUseCase = {
      execute: vi.fn(),
    } as unknown as ListSemestersUseCase;

    controller = new SemestersController({
      createSemesterUseCase: mockCreateSemesterUseCase,
      listSemestersUseCase: mockListSemestersUseCase,
    });

    res = {
      setHeader: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn() as unknown as NextFunction;
  });

  describe('createSemester', () => {
    it('returns 201 with DTO and Cache-Control: no-store upon successful creation', async () => {
      req = {
        user: { id: 'admin-1' },
        ip: '10.0.0.1',
        body: {
          code: '2027-I',
          startDate: '2027-03-01',
          endDate: '2027-07-31',
        },
      } as unknown as Request;

      const expectedDto = {
        id: 'sem-1',
        code: '2027-I',
        startDate: '2027-03-01',
        endDate: '2027-07-31',
        updatedAt: '2026-11-09T00:00:00.000Z',
      };
      vi.mocked(mockCreateSemesterUseCase.execute).mockResolvedValue(expectedDto);

      await controller.createSemester(req as Request, res as Response, next);

      expect(mockCreateSemesterUseCase.execute).toHaveBeenCalledWith({
        actorId: 'admin-1',
        ip: '10.0.0.1',
        code: '2027-I',
        startDate: '2027-03-01',
        endDate: '2027-07-31',
      });
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expectedDto);
      expect(next).not.toHaveBeenCalled();
    });

    it('passes UnauthorizedError to next when actor is not present', async () => {
      req = {
        body: {
          code: '2027-I',
          startDate: '2027-03-01',
          endDate: '2027-07-31',
        },
      } as Request;

      await controller.createSemester(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('forwards domain or conflict errors to next', async () => {
      req = {
        user: { id: 'admin-1' },
        body: {
          code: '2027-I',
          startDate: '2027-03-01',
          endDate: '2027-07-31',
        },
      } as unknown as Request;

      const domainError = new Error('Overlap error');
      vi.mocked(mockCreateSemesterUseCase.execute).mockRejectedValue(domainError);

      await controller.createSemester(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(domainError);
    });
  });
});
