import { renderHook } from '@testing-library/react-native';
import { setLanguagePreference, tr } from '@/features/core/translations';
import { useTrainingGridLogic } from '@/features/home/ui/components/TrainingGrid/TrainingGrid.logic';
import type { TrainingHeatmap } from '@/features/workouts';

describe('useTrainingGridLogic', () => {
  afterEach(() => setLanguagePreference('system'));

  it('counts the workouts in the footer and the trained days in the spoken summary', async () => {
    const heatmap = aHeatmap([0, 45, 0, 30], 3);

    const { result } = await renderHook(() => useTrainingGridLogic(heatmap, 20, tr));

    const footer = tr('heatmap.workouts', { count: 3, weeks: 20 });
    expect(result.current.derived.footer).toBe(footer);
    expect(result.current.derived.a11y).toBe(
      tr('heatmap.a11y', { days: tr('heatmap.days', { count: 2 }), weeks: 20, workouts: footer }),
    );
  });

  it.each([
    ['en', 'Training days: you trained on 1 day in the last 20 weeks, 1 workout in 20 weeks'],
    [
      'it',
      'Giorni di allenamento: ti sei allenato in 1 giorno nelle ultime 20 settimane, 1 allenamento in 20 settimane',
    ],
  ] as const)('says one trained day in the singular in %s', async (language, spoken) => {
    const heatmap = aHeatmap([0, 45, 0], 1);
    setLanguagePreference(language);

    const { result } = await renderHook(() => useTrainingGridLogic(heatmap, 20, tr));

    expect(result.current.derived.a11y).toBe(spoken);
  });

  it.each([
    ['en', 'Training days: you trained on 2 days in the last 20 weeks, 3 workouts in 20 weeks'],
    [
      'it',
      'Giorni di allenamento: ti sei allenato in 2 giorni nelle ultime 20 settimane, 3 allenamenti in 20 settimane',
    ],
  ] as const)('says several trained days in the plural in %s', async (language, spoken) => {
    const heatmap = aHeatmap([0, 45, 0, 30], 3);
    setLanguagePreference(language);

    const { result } = await renderHook(() => useTrainingGridLogic(heatmap, 20, tr));

    expect(result.current.derived.a11y).toBe(spoken);
  });
});

/** A grid of `minutes` per day from Monday 16 June 2025, holding `workouts` workouts. */
function aHeatmap(minutes: readonly number[], workouts: number): TrainingHeatmap {
  const monday = new Date(2025, 5, 16).getTime();
  return { days: minutes.map((value, index) => ({ dayStart: monday + index * 86_400_000, value })), workouts };
}
