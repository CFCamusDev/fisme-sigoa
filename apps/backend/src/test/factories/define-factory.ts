export interface Factory<T> {
  build(overrides?: Partial<T>): T;
  buildList(count: number, overrides?: Partial<T> | ((seq: number) => Partial<T>)): T[];
  resetSequence(): void;
}

export function defineFactory<T>(defaults: (seq: number) => T): Factory<T> {
  let sequence = 0;

  return {
    build(overrides?: Partial<T>): T {
      sequence += 1;
      const base = defaults(sequence);
      return {
        ...base,
        ...overrides,
      };
    },

    buildList(count: number, overrides?: Partial<T> | ((seq: number) => Partial<T>)): T[] {
      return Array.from({ length: count }, () => {
        const itemOverrides = typeof overrides === 'function' ? overrides(sequence + 1) : overrides;
        return this.build(itemOverrides);
      });
    },

    resetSequence(): void {
      sequence = 0;
    },
  };
}
