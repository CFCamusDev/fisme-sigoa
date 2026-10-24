import { describe, expect, it } from 'vitest';
import { defineFactory } from './define-factory';

interface Item {
  id: string;
  name: string;
  count: number;
}

describe('defineFactory', () => {
  it('build applies defaults and overrides correctly', () => {
    const itemFactory = defineFactory<Item>((seq) => ({
      id: `item-${seq}`,
      name: `Elemento ${seq}`,
      count: 0,
    }));

    const defaultItem = itemFactory.build();
    expect(defaultItem.id).toBe('item-1');
    expect(defaultItem.name).toBe('Elemento 1');
    expect(defaultItem.count).toBe(0);

    const overriddenItem = itemFactory.build({ name: 'Personalizado', count: 42 });
    expect(overriddenItem.id).toBe('item-2');
    expect(overriddenItem.name).toBe('Personalizado');
    expect(overriddenItem.count).toBe(42);
  });

  it('sequence values are unique and deterministic', () => {
    const itemFactory = defineFactory<Item>((seq) => ({
      id: `id-${seq}`,
      name: `Name ${seq}`,
      count: seq,
    }));

    itemFactory.resetSequence();

    const first = itemFactory.build();
    const second = itemFactory.build();
    const third = itemFactory.build();

    expect(first.id).toBe('id-1');
    expect(second.id).toBe('id-2');
    expect(third.id).toBe('id-3');

    itemFactory.resetSequence();
    const resetFirst = itemFactory.build();
    expect(resetFirst.id).toBe('id-1');
  });

  it('buildList returns independent objects with sequential values', () => {
    const itemFactory = defineFactory<Item>((seq) => ({
      id: `list-${seq}`,
      name: `List ${seq}`,
      count: 10,
    }));

    const items = itemFactory.buildList(3, { count: 99 });
    expect(items).toHaveLength(3);
    expect(items[0]?.count).toBe(99);
    expect(items[1]?.count).toBe(99);
    expect(items[2]?.count).toBe(99);

    // Los objetos son independientes en memoria
    expect(items[0]).not.toBe(items[1]);
  });
});
