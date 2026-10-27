import { SampleEntity } from '../domain/sample.entity.js';

export class CreateSampleUseCase {
  execute(): SampleEntity {
    return new SampleEntity();
  }
}
