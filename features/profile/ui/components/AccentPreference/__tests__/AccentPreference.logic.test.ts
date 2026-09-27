import { act, renderHook } from '@testing-library/react-native';
import { resetAllStores } from '@/features/core/state';
import { themeFor } from '@/features/core/theme';
import { tr } from '@/features/core/translations';
import { useAccentPreferenceLogic } from '@/features/profile/ui/components/AccentPreference/AccentPreference.logic';
import { getSettings } from '@/features/settings';

beforeEach(() => {
  resetAllStores();
});

describe('useAccentPreferenceLogic', () => {
  it('offers a named swatch for every accent the platform can draw', async () => {
    const { result } = await renderHook(() => useAccentPreferenceLogic(themeFor('dark')));

    expect(result.current.derived.title).toBe(tr('accent.title'));
    expect(result.current.derived.swatches.map(swatch => swatch.option)).toEqual([
      'kinetiq',
      'ocean',
      'sunset',
      'berry',
      'ruby',
    ]);
    expect(result.current.derived.swatches[1]?.label).toBe(tr('accent.ocean'));
  });

  it('writes the picked accent and shows it as the choice', async () => {
    const { result } = await renderHook(() => useAccentPreferenceLogic(themeFor('light')));

    await act(async () => result.current.effects.pick('ruby'));

    expect(getSettings().accentColor).toBe('ruby');
    expect(result.current.state.choice).toBe('ruby');
  });
});
