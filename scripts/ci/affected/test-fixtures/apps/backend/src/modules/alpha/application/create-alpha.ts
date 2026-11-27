import { alphaSchema } from '@sigoa/shared';
import { alphaEntity } from '../domain/alpha.entity';

export const createAlpha = () => ({ entity: alphaEntity, schema: alphaSchema });
