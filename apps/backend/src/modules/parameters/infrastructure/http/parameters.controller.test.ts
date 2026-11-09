import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { ParametersController } from './parameters.controller.js';
import type { GetProgramUseCase } from '../../application/get-program.js';
import type { EditProgramUseCase } from '../../application/edit-program.js';
import { UnauthorizedError } from '../../../../shared/errors/app-error.js';

describe('ParametersController (unit tests)', () => {
  let mockGetProgramUseCase: GetProgramUseCase;
  let mockEditProgramUseCase: EditProgramUseCase;
  let controller: ParametersController;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    mockGetProgramUseCase = {
      execute: vi.fn(),
    } as unknown as GetProgramUseCase;

    mockEditProgramUseCase = {
      execute: vi.fn(),
    } as unknown as EditProgramUseCase;

    controller = new ParametersController({
      getProgramUseCase: mockGetProgramUseCase,
      editProgramUseCase: mockEditProgramUseCase,
    });

    res = {
      setHeader: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn() as unknown as NextFunction;
  });

  describe('getProgram', () => {
    it('returns 200 with DTO and Cache-Control: no-store', async () => {
      req = {
        user: { id: 'admin-1' },
      } as unknown as Request;

      const expectedDto = {
        id: 'prog-1',
        code: 'EPIS',
        name: 'Ingeniería de Sistemas',
        faculty: 'Facultad de Ingeniería',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      vi.mocked(mockGetProgramUseCase.execute).mockResolvedValue(expectedDto);

      await controller.getProgram(req as Request, res as Response, next);

      expect(mockGetProgramUseCase.execute).toHaveBeenCalledWith({ actorId: 'admin-1' });
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expectedDto);
      expect(next).not.toHaveBeenCalled();
    });

    it('passes UnauthorizedError to next when actor is not present', async () => {
      req = {} as Request;

      await controller.getProgram(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });
  });

  describe('updateProgram', () => {
    it('calls editProgramUseCase and returns 200 with DTO', async () => {
      req = {
        user: { id: 'admin-1' },
        ip: '10.0.0.1',
        body: {
          name: 'Ingeniería de Sistemas e Informática',
        },
      } as unknown as Request;

      const expectedDto = {
        id: 'prog-1',
        code: 'EPIS',
        name: 'Ingeniería de Sistemas e Informática',
        faculty: 'Facultad de Ingeniería',
        updatedAt: '2026-01-02T00:00:00.000Z',
      };
      vi.mocked(mockEditProgramUseCase.execute).mockResolvedValue(expectedDto);

      await controller.updateProgram(req as Request, res as Response, next);

      expect(mockEditProgramUseCase.execute).toHaveBeenCalledWith({
        actorId: 'admin-1',
        ip: '10.0.0.1',
        name: 'Ingeniería de Sistemas e Informática',
        code: undefined,
        faculty: undefined,
      });
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expectedDto);
      expect(next).not.toHaveBeenCalled();
    });

    it('passes UnauthorizedError to next when actor is not present', async () => {
      req = {
        body: { name: 'Nuevo Nombre' },
      } as Request;

      await controller.updateProgram(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('forwards domain or application error to next', async () => {
      req = {
        user: { id: 'admin-1' },
        body: { name: 'Nuevo' },
      } as unknown as Request;

      const error = new Error('Database connection failed');
      vi.mocked(mockEditProgramUseCase.execute).mockRejectedValue(error);

      await controller.updateProgram(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
