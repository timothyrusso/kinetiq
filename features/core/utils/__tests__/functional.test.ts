import { clamp, localId, moveItem, sum } from '@/features/core/utils';

describe('clamp', () => {
  it('holds a value inside the bounds', () => {
    expect([clamp(-1, 0, 10), clamp(5, 0, 10), clamp(11, 0, 10)]).toEqual([0, 5, 10]);
  });
});

describe('sum', () => {
  it('adds every value', () => {
    expect(sum([1, 2, 3.5])).toBe(6.5);
  });

  it('is zero for no values', () => {
    expect(sum([])).toBe(0);
  });
});

describe('moveItem', () => {
  it('moves an item to its new position', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
  });

  it('returns an unchanged copy for a position outside the list', () => {
    const list = ['a', 'b'];

    const moved = moveItem(list, 0, 5);

    expect(moved).toEqual(['a', 'b']);
    expect(moved).not.toBe(list);
  });
});

describe('localId', () => {
  it('starts with the prefix', () => {
    expect(localId('rtn')).toMatch(/^rtn_/);
  });

  it('never repeats', () => {
    expect(new Set(Array.from({ length: 50 }, () => localId())).size).toBe(50);
  });
});
