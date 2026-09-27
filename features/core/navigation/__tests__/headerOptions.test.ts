import { renderHook } from '@testing-library/react-native';
import { formSheet, useHeaderOptions } from '@/features/core/navigation';
import { useLargeTitleOptions } from '@/features/core/navigation/headerOptions';
import { resetAllStores } from '@/features/core/state';
import { radius, setAppearancePreferences, themeFor } from '@/features/core/theme';

beforeEach(() => {
  resetAllStores();
  setAppearancePreferences({ themePreference: 'dark', accentColor: 'kinetiq' });
});

describe('useHeaderOptions', () => {
  it('tints the header with the theme accent over the theme canvas', async () => {
    const { result } = await renderHook(useHeaderOptions);

    expect(result.current.headerTintColor).toBe(themeFor('dark').colors.accent);
    expect(result.current.contentStyle).toEqual({ backgroundColor: themeFor('dark').colors.background });
  });

  it('shows the back chevron without the previous title', async () => {
    const { result } = await renderHook(useHeaderOptions);

    expect(result.current.headerBackButtonDisplayMode).toBe('minimal');
  });
});

describe('useLargeTitleOptions', () => {
  it('is the shared header with a large title', async () => {
    const { result } = await renderHook(useLargeTitleOptions);

    expect(result.current.headerLargeTitle).toBe(true);
    expect(result.current.headerShown).toBe(true);
  });
});

describe('formSheet', () => {
  it('sizes a short form to its content', () => {
    expect(formSheet('fit').sheetAllowedDetents).toBe('fitToContents');
  });

  it('opens a picker at half height with the full list a drag away', () => {
    expect(formSheet('picker')).toMatchObject({
      presentation: 'formSheet',
      headerShown: false,
      sheetAllowedDetents: [0.5, 1],
      sheetCornerRadius: radius.xxl,
    });
  });
});
