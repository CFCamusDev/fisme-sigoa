import { SampleEntity } from '../domain/sample.entity.js';

export class SampleRepository {
  find(): SampleEntity {
    return new SampleEntity();
  }
}
