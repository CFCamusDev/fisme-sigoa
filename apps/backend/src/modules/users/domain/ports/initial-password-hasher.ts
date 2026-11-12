export interface InitialPasswordHasher {
  hash(plainPassword: string): Promise<string>;
}
