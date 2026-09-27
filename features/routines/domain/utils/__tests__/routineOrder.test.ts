import { anotherRoutineItem, aRoutineItem } from '@/features/routines/__fixtures__/builders';
import { orderedItemIds } from '@/features/routines/domain/utils/routineOrder';

const ITEMS = [aRoutineItem(), anotherRoutineItem(), aRoutineItem({ id: 'rit_dips' })];

describe('orderedItemIds', () => {
  it('follows the order asked for', () => {
    expect(orderedItemIds(ITEMS, ['rit_dips', 'rit_press', 'rit_bench'])).toEqual([
      'rit_dips',
      'rit_press',
      'rit_bench',
    ]);
  });

  it('drops ids the routine does not have and repeats of the same id', () => {
    expect(orderedItemIds(ITEMS, ['rit_gone', 'rit_press', 'rit_press'])).toEqual([
      'rit_press',
      'rit_bench',
      'rit_dips',
    ]);
  });

  it('keeps an empty order as the current one', () => {
    expect(orderedItemIds(ITEMS, [])).toEqual(['rit_bench', 'rit_press', 'rit_dips']);
  });
});
