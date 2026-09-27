import { act, renderHook } from '@testing-library/react-native';
import { resetAllStores } from '@/features/core/state';
import { routerFake } from '@/features/core/testing';
import { tr } from '@/features/core/translations';
import { HEIGHT_MAX, HEIGHT_MIN } from '@/features/profile/domain/utils/profileDraft';
import { useEditProfilePageLogic } from '@/features/profile/ui/pages/EditProfilePage/EditProfilePage.logic';
import { DEFAULT_SETTINGS, getSettings, updateSettings } from '@/features/settings';

const STORED = { name: 'Alex', heightCm: 180, birthYear: 1990 };

beforeEach(() => {
  resetAllStores();
  updateSettings({ profile: STORED });
});

describe('useEditProfilePageLogic', () => {
  it('opens on the stored profile as text', async () => {
    const { result } = await renderHook(useEditProfilePageLogic);

    expect(result.current.state.draft).toEqual({ name: 'Alex', heightCm: '180', birthYear: '1990' });
  });

  it('saves the fields that moved and closes the sheet', async () => {
    const { result } = await renderHook(useEditProfilePageLogic);

    await act(async () => result.current.effects.setName('  Sam  '));
    await act(async () => result.current.effects.setHeight('175'));
    await act(async () => result.current.effects.save());

    expect(getSettings().profile).toEqual({ name: 'Sam', heightCm: 175, birthYear: 1990 });
    expect(routerFake.history).toEqual([{ verb: 'back', href: null }]);
  });

  it('keeps the stored profile when Save is pressed with nothing changed', async () => {
    const { result } = await renderHook(useEditProfilePageLogic);
    const before = getSettings().profile;

    await act(async () => result.current.effects.save());

    expect(getSettings().profile).toBe(before);
  });

  it('shows no problem before the first Save', async () => {
    const { result } = await renderHook(useEditProfilePageLogic);

    await act(async () => result.current.effects.setHeight('1'));

    expect(result.current.derived.errors).toEqual({ name: null, heightCm: null, birthYear: null });
  });

  it('refuses a height out of range, says why, and keeps the stored profile and the sheet', async () => {
    const { result } = await renderHook(useEditProfilePageLogic);

    await act(async () => result.current.effects.setHeight('1'));
    await act(async () => result.current.effects.save());

    expect(result.current.derived.errors.heightCm).toBe(
      tr('settingsScreen.heightRange', { min: HEIGHT_MIN, max: HEIGHT_MAX }),
    );
    expect(getSettings().profile).toEqual(STORED);
    expect(routerFake.history).toEqual([]);
  });

  it('refuses an empty birth year and a one-letter name, field by field', async () => {
    const { result } = await renderHook(useEditProfilePageLogic);

    await act(async () => result.current.effects.setBirthYear(''));
    await act(async () => result.current.effects.setName('A'));
    await act(async () => result.current.effects.save());

    expect(result.current.derived.errors).toEqual({
      name: tr('settingsScreen.nameTooShort'),
      heightCm: null,
      birthYear: tr('settingsScreen.birthYearRequired'),
    });
    expect(getSettings().profile).toEqual(STORED);
  });

  it('starts from the default profile on a fresh install', async () => {
    resetAllStores();

    const { result } = await renderHook(useEditProfilePageLogic);

    expect(result.current.state.draft.heightCm).toBe(`${DEFAULT_SETTINGS.profile.heightCm}`);
  });
});
