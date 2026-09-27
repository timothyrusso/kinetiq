import { act, waitFor } from '@testing-library/react-native';
import { resetAllStores } from '@/features/core/state';
import { renderWithLayer } from '@/features/core/testing';
import { tr } from '@/features/core/translations';
import {
  mirrorCalls,
  ProfileTestLayer,
  saveRoutine,
  storedRoutines,
} from '@/features/profile/di/__tests__/profileTestLayer';
import { useAboutPageLogic } from '@/features/profile/ui/pages/AboutPage/AboutPage.logic';
import { DEFAULT_SETTINGS, getSettings, updateSettings } from '@/features/settings';

beforeEach(() => {
  resetAllStores();
  mirrorCalls.length = 0;
});

/** The rows of section `key`, by their keys. */
const rowKeys = (sections: ReturnType<typeof useAboutPageLogic>['derived']['sections'], key: string) =>
  sections.find(section => section.key === key)?.rows.map(row => row.key);

/** The value the routines row shows. */
const routinesRow = (sections: ReturnType<typeof useAboutPageLogic>['derived']['sections']) => {
  const row = sections.find(section => section.key === 'device')?.rows.find(candidate => candidate.key === 'routines');
  return row?.kind === 'info' ? row.value : undefined;
};

/** Renders About, with one routine stored under it when `withRoutine`, once both counts were read. */
const renderAbout = async (withRoutine = false) => {
  const rendered = await renderWithLayer(ProfileTestLayer, useAboutPageLogic, undefined);
  if (withRoutine) await act(async () => void (await rendered.runtime.runPromise(saveRoutine)));
  await waitFor(() =>
    expect(rowKeys(rendered.result.current.derived.sections, 'device')).toEqual(['none', 'routines']),
  );
  await waitFor(() => expect(routinesRow(rendered.result.current.derived.sections)).not.toBe(tr('about.counting')));
  return rendered;
};

describe('useAboutPageLogic', () => {
  it('names the catalog provider in words', async () => {
    const { result, done } = await renderAbout();

    const catalog = result.current.derived.sections.find(section => section.key === 'catalog');
    expect(catalog?.rows[0]?.title).toBe('wger Workout Manager');
    await done();
  });

  it('says nothing is stored when there are no workouts', async () => {
    const { result, done } = await renderAbout();

    const device = result.current.derived.sections.find(section => section.key === 'device');
    expect(device?.rows[0]?.title).toBe(tr('about.nothingStored'));
    await done();
  });

  it('asks before erasing, counting what goes', async () => {
    const { result, done } = await renderAbout();
    const erase = result.current.derived.sections.find(section => section.key === 'reset')?.rows[0];

    await act(async () => void (erase?.kind === 'button' && erase.onPress()));

    expect(result.current.state.confirming).toBe(true);
    expect(result.current.derived.eraseMessage).toBe(
      tr('about.eraseMessage', {
        activities: tr('about.activityCount', { count: 0 }),
        routines: tr('about.routineCount', { count: 0 }),
      }),
    );
    await done();
  });

  it('keeps everything when the user backs out', async () => {
    const { result, runtime, done } = await renderAbout(true);

    await act(async () => result.current.effects.keep());

    expect(result.current.state.confirming).toBe(false);
    expect(await runtime.runPromise(storedRoutines)).toHaveLength(1);
    await done();
  });

  it('erases the routines, resets the settings and pushes the empty list to the watch', async () => {
    updateSettings({ weeklyGoalWorkouts: 6 });
    const { result, runtime, done } = await renderAbout(true);

    await act(async () => result.current.effects.confirmErase());

    await waitFor(() => expect(getSettings().weeklyGoalWorkouts).toBe(DEFAULT_SETTINGS.weeklyGoalWorkouts));
    await waitFor(() => expect(result.current.state.erasing).toBe(false));
    await waitFor(() => expect(routinesRow(result.current.derived.sections)).toBe('0'));
    expect(mirrorCalls).toEqual(['push']);
    expect(await runtime.runPromise(storedRoutines)).toEqual([]);
    expect(result.current.state.confirming).toBe(false);
    await done();
  });
});
