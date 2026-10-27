import { ModuleAEntity } from '../../module-a/domain/a.js';

export class ModuleBEntity {
  a = new ModuleAEntity();
}
