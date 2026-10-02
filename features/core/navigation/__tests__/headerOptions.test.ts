import { renderHook } from '@testing-library/react-native';
import { formSheet, useHeaderOptions, useTabsScreenOptions } from '@/features/core/navigation';
import { useLargeTitleOptions } from '@/features/core/navigation/headerOptions';
import { resetAllStores } from '@/features/core/state';
import { radius, setAppearancePreferences, themeFor } from '@/features/core/theme';
import { setLanguagePreference } from '@/features/core/translations';

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

describe('useTabsScreenOptions', () => {
  const onTab = (name: string) => ({
    key: 'tabs',
    name: '(tabs)',
    state: { index: 0, routes: [{ key: name, name }] },
  });

  it('names the way back after the tab on show, not the product', async () => {
    setLanguagePreference('en');
    const { result } = await renderHook(useTabsScreenOptions);

    expect(result.current({ route: onTab('workout') })).toEqual({ headerShown: false, title: 'Workout' });
  });

  it('names it in Italian too', async () => {
    setLanguagePreference('it');
    const { result } = await renderHook(useTabsScreenOptions);

    expect(result.current({ route: onTab('profile') }).title).toBe('Profilo');
  });

  it('reads the initial tab, before the tabs have a state, as Home', async () => {
    setLanguagePreference('en');
    const { result } = await renderHook(useTabsScreenOptions);

    expect(result.current({ route: { key: 'tabs', name: '(tabs)' } }).title).toBe('Home');
  });
});

describe('useLargeTitleOptions', () => {
  it('is the shared header with a large title', async () => {
    const { result } = await renderHook(useLargeTitleOptions);

    expect(result.current.headerLargeTitle).toBe(true);
    expect(result.current.headerShown).toBe(true);
  });
});

const DARK = themeFor('dark');
const LIGHT = themeFor('light');

describe('formSheet', () => {
  it('sizes a short form to its content', () => {
    expect(formSheet('fit', DARK).sheetAllowedDetents).toBe('fitToContents');
  });

  it('dims the page at every detent and draws the sheet on the lifted sheet surface', () => {
    expect(formSheet('fit', DARK)).toMatchObject({
      sheetLargestUndimmedDetentIndex: 'none',
      contentStyle: { backgroundColor: DARK.colors.sheet },
    });
    expect(DARK.colors.sheet).not.toBe(DARK.colors.background);
    expect(formSheet('picker', LIGHT).contentStyle).toEqual({ backgroundColor: LIGHT.colors.sheet });
  });

  it('opens a picker at half height with the full list a drag away', () => {
    expect(formSheet('picker', DARK)).toMatchObject({
      presentation: 'formSheet',
      headerShown: false,
      sheetAllowedDetents: [0.5, 1],
      sheetCornerRadius: radius.xxl,
    });
  });
});
