import { act, renderHook } from '@testing-library/react-native';
import { tr } from '@/features/core/translations';
import { aRoutineItem } from '@/features/home/__fixtures__/builders';
import { useRoutineListItemLogic } from '@/features/home/ui/components/RoutineListItem/RoutineListItem.logic';
import { type Routine, RoutineId } from '@/features/routines';

const opened: string[] = [];
const open = (id: string) => void opened.push(id);

beforeEach(() => {
  opened.length = 0;
});

const renderRow = (routine: Routine) => renderHook(() => useRoutineListItemLogic(routine, tr, 'en', open));

describe('useRoutineListItemLogic', () => {
  it('shows only the exercise count for a routine never trained', async () => {
    const { result } = await renderRow(aListedRoutine());

    expect(result.current.derived.meta).toEqual([{ icon: 'layers', label: tr('workout.exercise', { count: 1 }) }]);
  });

  it('adds the times done and the last session for a trained routine', async () => {
    const { result } = await renderRow(aListedRoutine({ timesCompleted: 3, lastPerformedAt: 1_700_000_000_000 }));

    expect(result.current.derived.meta.map(item => item.icon)).toEqual(['layers', 'checkCircle', 'calendar']);
    expect(result.current.derived.meta[1]?.label).toBe(tr('workoutTab.doneTimes', { count: 3 }));
  });

  it('opens the routine by its id on press', async () => {
    const { result } = await renderRow(aListedRoutine());

    await act(async () => result.current.effects.press());

    expect(opened).toEqual(['rtn_push']);
  });
});

function aListedRoutine(overrides: Partial<Routine> = {}): Routine {
  return {
    id: RoutineId.make('rtn_push'),
    name: 'Push Day',
    items: [aRoutineItem()],
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    timesCompleted: 0,
    lastPerformedAt: null,
    ...overrides,
  };
}
