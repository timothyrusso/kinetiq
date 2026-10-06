import { act, renderHook } from '@testing-library/react-native';
import type { AccessibilityActionEvent } from 'react-native';
import { tr } from '@/features/core/translations';
import {
  aDurationItem,
  anExerciseSnapshot,
  aRepsOnlyItem,
  aRoutineItem,
} from '@/features/routines/__fixtures__/builders';
import { uniformSets } from '@/features/routines/domain/utils/itemTargets';
import {
  type RoutineItemRowInput,
  useRoutineItemRowLogic,
} from '@/features/routines/ui/components/RoutineItemRow/RoutineItemRow.logic';

const renderRow = (overrides: Partial<RoutineItemRowInput> = {}) =>
  renderHook(useRoutineItemRowLogic, {
    initialProps: {
      item: aRoutineItem(),
      snapshot: anExerciseSnapshot(),
      units: 'metric',
      index: 1,
      count: 3,
      ...overrides,
    },
  });

describe('useRoutineItemRowLogic', () => {
  it('shows sets, reps and load, and the primary muscle as the tag', async () => {
    const { result } = await renderRow();

    expect(result.current.derived.meta.map(item => item.label)).toEqual([
      tr('workout.set', { count: 3 }),
      tr('details.repsValue', { reps: '8' }),
      '60 kg',
    ]);
    expect(result.current.derived.tags).toEqual([{ key: 'muscle', label: 'Chest' }]);
  });

  it('says bodyweight instead of a load of 0', async () => {
    const { result } = await renderRow({ item: aRoutineItem({ sets: uniformSets(3, 8, 0) }) });

    expect(result.current.derived.meta[2]?.label).toBe(tr('itemEditor.bodyweightShort'));
  });

  it('shows sets and reps for a reps-only item, with no load', async () => {
    const sets = [10, 8, 6].map((reps, index) => ({ type: 'repsOnly' as const, index, reps, targetRpe: null }));
    const { result } = await renderRow({ item: aRepsOnlyItem({ sets }) });

    expect(result.current.derived.meta.map(item => item.label)).toEqual([
      tr('workout.set', { count: 3 }),
      tr('details.repsValue', { reps: '6-10' }),
    ]);
  });

  it('shows sets and the time per set for a timed item, as m:ss', async () => {
    const { result } = await renderRow({ item: aDurationItem() });

    expect(result.current.derived.meta.map(item => [item.icon, item.label])).toEqual([
      ['layers', tr('workout.set', { count: 3 })],
      ['timer', '0:45'],
    ]);
  });

  it('draws no tag and no thumbnail without a snapshot', async () => {
    const { result } = await renderRow({ snapshot: null });

    expect(result.current.derived.tags).toBeUndefined();
    expect(result.current.derived.thumbnail).toBeNull();
  });

  it('hands the row’s id and index to the screen’s callbacks', async () => {
    const calls: unknown[] = [];
    const { result } = await renderRow({
      onOpen: id => void calls.push(['open', id]),
      onMove: (from, to) => void calls.push(['move', from, to]),
      onRemove: id => void calls.push(['remove', id]),
    });

    await act(async () => {
      result.current.effects.open();
      result.current.effects.up();
      result.current.effects.down();
      result.current.effects.remove();
    });

    expect(calls).toEqual([
      ['open', 'rit_bench'],
      ['move', 1, 0],
      ['move', 1, 2],
      ['remove', 'rit_bench'],
    ]);
  });

  it('offers the move and remove buttons to a screen reader as the row’s actions', async () => {
    const calls: unknown[] = [];
    const { result } = await renderRow({
      onMove: (from, to) => void calls.push(['move', from, to]),
      onRemove: id => void calls.push(['remove', id]),
    });

    expect(result.current.derived.accessibilityActions).toEqual([
      { name: 'moveUp', label: tr('routineItemA11y.moveUp', { name: 'Bench Press' }) },
      { name: 'moveDown', label: tr('routineItemA11y.moveDown', { name: 'Bench Press' }) },
      { name: 'remove', label: tr('routineItemA11y.remove', { name: 'Bench Press' }) },
    ]);
    const perform = (actionName: string) =>
      result.current.effects.onAccessibilityAction({ nativeEvent: { actionName } } as AccessibilityActionEvent);
    await act(async () => {
      perform('moveUp');
      perform('moveDown');
      perform('remove');
    });
    expect(calls).toEqual([
      ['move', 1, 0],
      ['move', 1, 2],
      ['remove', 'rit_bench'],
    ]);
  });

  it('leaves out the move the first and the last row cannot make', async () => {
    const onMove = () => undefined;
    const first = await renderRow({ onMove, index: 0 });
    const last = await renderRow({ onMove, index: 2 });

    expect(first.result.current.derived.accessibilityActions.map(action => action.name)).toEqual(['moveDown']);
    expect(last.result.current.derived.accessibilityActions.map(action => action.name)).toEqual(['moveUp']);
  });

  it('has no actions on a row that can only be opened', async () => {
    const { result } = await renderRow({ onOpen: () => undefined });

    expect(result.current.derived.accessibilityActions).toEqual([]);
  });
});
