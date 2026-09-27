import { act, renderHook } from '@testing-library/react-native';
import type { SettingsSection } from '@/features/core/design-system';
import { resetAllStores } from '@/features/core/state';
import { tr } from '@/features/core/translations';
import { useTrainingSettingsPageLogic } from '@/features/profile/ui/pages/TrainingSettingsPage/TrainingSettingsPage.logic';
import { getSettings, updateSettings } from '@/features/settings';

beforeEach(() => {
  resetAllStores();
});

/** The row `key` of the rendered sections. */
const rowOf = (sections: readonly SettingsSection[], key: string) => {
  const row = sections.flatMap(section => section.rows).find(candidate => candidate.key === key);
  if (row === undefined) throw new Error(`no row ${key}`);
  return row;
};

describe('useTrainingSettingsPageLogic', () => {
  it('shows the rest, session and goal sections under the page title', async () => {
    const { result } = await renderHook(useTrainingSettingsPageLogic);

    expect(result.current.derived.title).toBe(tr('trainingPrefs.title'));
    expect(result.current.derived.sections.map(section => section.key)).toEqual(['rest', 'session', 'goal']);
  });

  it('writes a new default rest from its stepper', async () => {
    const { result } = await renderHook(useTrainingSettingsPageLogic);
    const rest = rowOf(result.current.derived.sections, 'rest');

    await act(async () => void (rest.kind === 'stepper' && rest.onChange(120)));

    expect(getSettings().defaultRestSeconds).toBe(120);
    const updated = rowOf(result.current.derived.sections, 'rest');
    expect(updated.kind === 'stepper' && updated.value).toBe(120);
  });

  it('writes the weekly goal from its stepper', async () => {
    const { result } = await renderHook(useTrainingSettingsPageLogic);
    const goal = rowOf(result.current.derived.sections, 'goal');

    await act(async () => void (goal.kind === 'stepper' && goal.onChange(5)));

    expect(getSettings().weeklyGoalWorkouts).toBe(5);
  });

  it('turns keep screen awake off from its switch', async () => {
    updateSettings({ keepScreenAwake: true });
    const { result } = await renderHook(useTrainingSettingsPageLogic);
    const keepAwake = rowOf(result.current.derived.sections, 'keepAwake');

    await act(async () => void (keepAwake.kind === 'switch' && keepAwake.onChange(false)));

    expect(getSettings().keepScreenAwake).toBe(false);
  });

  it('writes auto start rest from its switch, with the subtitle that says so', async () => {
    updateSettings({ autoStartRest: false });
    const { result } = await renderHook(useTrainingSettingsPageLogic);
    const autoStart = rowOf(result.current.derived.sections, 'autoStart');

    await act(async () => void (autoStart.kind === 'switch' && autoStart.onChange(true)));

    expect(getSettings().autoStartRest).toBe(true);
    const updated = rowOf(result.current.derived.sections, 'autoStart');
    expect(updated.kind === 'switch' && updated.subtitle).toBe(tr('states.autoStartOn'));
  });

  it('shows the rest countdown off and disabled while haptics are off', async () => {
    updateSettings({ hapticsEnabled: true, restCountdownHaptics: true });
    const { result } = await renderHook(useTrainingSettingsPageLogic);
    const haptics = rowOf(result.current.derived.sections, 'haptics');

    await act(async () => void (haptics.kind === 'switch' && haptics.onChange(false)));

    const countdown = rowOf(result.current.derived.sections, 'restCountdown');
    expect(countdown.kind === 'switch' && [countdown.value, countdown.disabled]).toEqual([false, true]);
    expect(getSettings().restCountdownHaptics).toBe(true);
  });

  it('writes the rest countdown from its switch', async () => {
    updateSettings({ hapticsEnabled: true, restCountdownHaptics: true });
    const { result } = await renderHook(useTrainingSettingsPageLogic);
    const countdown = rowOf(result.current.derived.sections, 'restCountdown');

    await act(async () => void (countdown.kind === 'switch' && countdown.onChange(false)));

    expect(getSettings().restCountdownHaptics).toBe(false);
  });
});
