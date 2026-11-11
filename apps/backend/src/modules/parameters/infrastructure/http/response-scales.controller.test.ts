import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedError } from '../../../../shared/errors/app-error.js';
import type { CreateResponseScaleUseCase } from '../../application/create-response-scale.js';
import type { EditResponseScaleUseCase } from '../../application/edit-response-scale.js';
import { ResponseScalesController } from './response-scales.controller.js';

describe('ResponseScalesController (unit tests, T-012-11, RF-012)', () => {
  let createUseCase: CreateResponseScaleUseCase;
  let editUseCase: EditResponseScaleUseCase;
  let controller: ResponseScalesController;
  let res: Partial<Response>;
  let next: NextFunction;

  const dto = {
    id: 'scale-1',
    code: 'EVIDENCE_4',
    name: 'Evidencia 4',
    type: 'EVIDENCE',
    inUse: false,
    levels: [{ order: 1, label: 'A', value: 1, countsAsAchievement: false }],
  };

  beforeEach(() => {
    createUseCase = { execute: vi.fn() } as unknown as CreateResponseScaleUseCase;
    editUseCase = { execute: vi.fn() } as unknown as EditResponseScaleUseCase;
    controller = new ResponseScalesController({
      createResponseScaleUseCase: createUseCase,
      editResponseScaleUseCase: editUseCase,
    });
    res = {
      setHeader: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn() as unknown as NextFunction;
  });

  describe('createResponseScale', () => {
    const body = {
      code: 'EVIDENCE_4',
      name: 'Evidencia 4',
      type: 'EVIDENCE',
      levels: [{ label: 'A', value: 1, countsAsAchievement: false }],
    };

    it('answers 201 with the DTO and forbids caching', async () => {
      vi.mocked(createUseCase.execute).mockResolvedValue(dto as never);
      const req = { user: { id: 'admin-1' }, ip: '10.0.0.1', body } as unknown as Request;

      await controller.createResponseScale(req, res as Response, next);

      expect(createUseCase.execute).toHaveBeenCalledWith({
        actorId: 'admin-1',
        ip: '10.0.0.1',
        ...body,
      });
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(dto);
      expect(next).not.toHaveBeenCalled();
    });

    it('passes UnauthorizedError to next when there is no session', async () => {
      const req = { body } as unknown as Request;

      await controller.createResponseScale(req, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      expect(createUseCase.execute).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('passes the errors of the use case to next', async () => {
      const failure = new Error('boom');
      vi.mocked(createUseCase.execute).mockRejectedValue(failure);
      const req = { user: { id: 'admin-1' }, ip: '10.0.0.1', body } as unknown as Request;

      await controller.createResponseScale(req, res as Response, next);

      expect(next).toHaveBeenCalledWith(failure);
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe('editResponseScale', () => {
    it('answers 200 with the DTO, passing the id from the path and forbidding caching', async () => {
      vi.mocked(editUseCase.execute).mockResolvedValue(dto as never);
      const req = {
        user: { id: 'admin-1' },
        ip: '10.0.0.1',
        params: { id: 'scale-1' },
        body: { name: 'Nuevo' },
      } as unknown as Request;

      await controller.editResponseScale(req, res as Response, next);

      expect(editUseCase.execute).toHaveBeenCalledWith({
        actorId: 'admin-1',
        ip: '10.0.0.1',
        id: 'scale-1',
        name: 'Nuevo',
        levels: undefined,
      });
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(dto);
    });

    it('passes UnauthorizedError to next when there is no session', async () => {
      const req = { params: { id: 'scale-1' }, body: { name: 'X' } } as unknown as Request;

      await controller.editResponseScale(req, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      expect(editUseCase.execute).not.toHaveBeenCalled();
    });

    it('passes the errors of the use case to next', async () => {
      const failure = new Error('boom');
      vi.mocked(editUseCase.execute).mockRejectedValue(failure);
      const req = {
        user: { id: 'admin-1' },
        params: { id: 'scale-1' },
        body: { name: 'X' },
      } as unknown as Request;

      await controller.editResponseScale(req, res as Response, next);

      expect(next).toHaveBeenCalledWith(failure);
      expect(res.json).not.toHaveBeenCalled();
    });
  });
});
