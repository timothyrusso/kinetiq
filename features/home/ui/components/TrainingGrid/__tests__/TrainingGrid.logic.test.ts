import { renderHook } from '@testing-library/react-native';
import { tr } from '@/features/core/translations';
import { useTrainingGridLogic } from '@/features/home/ui/components/TrainingGrid/TrainingGrid.logic';
import type { TrainingHeatmap } from '@/features/workouts';

describe('useTrainingGridLogic', () => {
  it('counts the workouts in the footer and the trained days in the spoken summary', async () => {
    const heatmap = aHeatmap([0, 45, 0, 30], 3);

    const { result } = await renderHook(() => useTrainingGridLogic(heatmap, 20, tr));

    const footer = tr('heatmap.workouts', { count: 3, weeks: 20 });
    expect(result.current.derived.footer).toBe(footer);
    expect(result.current.derived.a11y).toBe(tr('heatmap.a11y', { days: 2, weeks: 20, workouts: footer }));
  });
});

/** A grid of `minutes` per day from Monday 16 June 2025, holding `workouts` workouts. */
function aHeatmap(minutes: readonly number[], workouts: number): TrainingHeatmap {
  const monday = new Date(2025, 5, 16).getTime();
  return { days: minutes.map((value, index) => ({ dayStart: monday + index * 86_400_000, value })), workouts };
}
