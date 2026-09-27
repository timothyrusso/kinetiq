import { act, waitFor } from '@testing-library/react-native';
import { routes } from '@/features/core/navigation';
import { resetAllStores } from '@/features/core/state';
import { renderWithLayer, routerFake } from '@/features/core/testing';
import { tr } from '@/features/core/translations';
import { ProfileTestLayer } from '@/features/profile/di/__tests__/profileTestLayer';
import { useProfilePageLogic } from '@/features/profile/ui/pages/ProfilePage/ProfilePage.logic';
import { getSettings, updateSettings } from '@/features/settings';

beforeEach(() => {
  resetAllStores();
  updateSettings({ weeklyGoalWorkouts: 3 });
});

/** Renders the tab and waits for the four weeks of history to be read. */
const renderProfile = async () => {
  const rendered = await renderWithLayer(ProfileTestLayer, useProfilePageLogic, undefined);
  await waitFor(() => expect(rendered.result.current.derived.goalDetail).not.toBe(tr('profileScreen.readingHistory')));
  return rendered;
};

describe('useProfilePageLogic', () => {
  it('calls a user with no name the athlete', async () => {
    const { result, done } = await renderProfile();

    expect(result.current.derived.displayName).toBe(tr('profileScreen.athlete'));
    await done();
  });

  it('shows the stored name', async () => {
    updateSettings({ profile: { ...getSettings().profile, name: 'Alex' } });

    const { result, done } = await renderProfile();

    expect(result.current.derived.displayName).toBe('Alex');
    await done();
  });

  it('shows a week with no workouts against its goal', async () => {
    const { result, done } = await renderProfile();

    expect(result.current.derived.goalLabel).toBe('0/3');
    expect(result.current.derived.goalProgress).toBe(0);
    expect(result.current.derived.goalHeadline).toBe(tr('profileScreen.headlineNothing'));
    expect(result.current.derived.bestStreakLabel).toBeNull();
    await done();
  });

  it('says how many sessions are left this week', async () => {
    const { result, done } = await renderProfile();

    expect(result.current.derived.goalDetail).toBe(
      tr('profileScreen.goalLeftText', { phrase: `3 ${tr('profileScreen.sessionWord', { count: 3 })}` }),
    );
    await done();
  });

  it('writes the units, the theme and the language from their controls', async () => {
    const { result, done } = await renderProfile();

    await act(async () => result.current.effects.setUnits('imperial'));
    await act(async () => result.current.effects.setTheme('dark'));
    await act(async () => result.current.effects.setLanguage('it'));

    expect([getSettings().unitSystem, getSettings().themeMode, getSettings().language]).toEqual([
      'imperial',
      'dark',
      'it',
    ]);
    expect(result.current.state.themeMode).toBe('dark');
    await done();
  });

  it('opens each settings screen', async () => {
    const { result, done } = await renderProfile();

    await act(async () => result.current.effects.openEditor());
    await act(async () => result.current.effects.openTraining());
    await act(async () => result.current.effects.openNotifications());
    await act(async () => result.current.effects.openData());
    await act(async () => result.current.effects.openAbout());

    expect(routerFake.history.map(entry => entry.href)).toEqual([
      routes.editProfile(),
      routes.settingsTraining(),
      routes.settingsNotifications(),
      routes.settingsData(),
      routes.settingsAbout(),
    ]);
    await done();
  });

  it('offers the three themes, the languages and the two unit systems', async () => {
    const { result, done } = await renderProfile();

    expect(result.current.derived.themeSegments.map(segment => segment.value)).toEqual(['system', 'light', 'dark']);
    expect(result.current.derived.languageSegments.map(segment => segment.value)).toEqual(['system', 'en', 'it']);
    expect(result.current.derived.unitSegments.map(segment => segment.value)).toEqual(['metric', 'imperial']);
    await done();
  });
});
