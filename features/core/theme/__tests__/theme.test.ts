import { act, renderHook } from '@testing-library/react-native';
import { resetAllStores } from '@/features/core/state';
import {
  palette,
  setAppearancePreferences,
  statusBarStyle,
  themeFor,
  useAccentSwatches,
  useAppTheme,
} from '@/features/core/theme';

beforeEach(() => {
  resetAllStores();
});

describe('themeFor', () => {
  it('matches the dark splash background in dark mode', () => {
    expect(themeFor('dark').brandBackground).toBe(palette.ink900);
  });

  it('matches the light splash background in light mode', () => {
    expect(themeFor('light').brandBackground).toBe(palette.paper0);
  });

  it('separates dark cards with borders rather than shadows', () => {
    expect(themeFor('dark').shadows.card).toBeNull();
  });

  it('gives light cards a soft shadow', () => {
    expect(themeFor('light').shadows.card).not.toBeNull();
  });
});

describe('statusBarStyle', () => {
  it('uses light content on dark and dark content on light', () => {
    expect([statusBarStyle('dark'), statusBarStyle('light')]).toEqual(['light', 'dark']);
  });
});

describe('useAppTheme', () => {
  it('draws the scheme the user fixed', async () => {
    setAppearancePreferences({ themePreference: 'dark', accentColor: 'kinetiq' });

    const { result } = await renderHook(useAppTheme);

    expect(result.current.mode).toBe('dark');
  });

  it('keeps the brand accent for the kinetiq choice', async () => {
    setAppearancePreferences({ themePreference: 'light', accentColor: 'kinetiq' });

    const { result } = await renderHook(useAppTheme);

    expect(result.current.colors.accent).toBe(themeFor('light').colors.accent);
  });

  it('paints the picked accent through the colours, the gradient and the accent shadow', async () => {
    setAppearancePreferences({ themePreference: 'dark', accentColor: 'ocean' });

    const { result } = await renderHook(useAppTheme);

    expect(result.current.colors.accent).toBe('#4DA3FF');
    expect(result.current.gradients.accent).toEqual(['#4DA3FF', '#7DBBFF']);
    expect(result.current.shadows.accent?.shadowColor).toBe('#4DA3FF');
  });

  it('follows a change of preference', async () => {
    setAppearancePreferences({ themePreference: 'light', accentColor: 'kinetiq' });
    const { result } = await renderHook(useAppTheme);

    await act(async () => setAppearancePreferences({ themePreference: 'dark', accentColor: 'kinetiq' }));

    expect(result.current.mode).toBe('dark');
  });
});

describe('useAccentSwatches', () => {
  it('offers the deeper colours on light paper', async () => {
    const { result } = await renderHook(() => useAccentSwatches('light'));

    expect(result.current).toEqual({
      kinetiq: '#5E8C0B',
      ocean: '#0A66C2',
      sunset: '#C25400',
      berry: '#8E3FC8',
      ruby: '#C62828',
    });
  });

  it('offers the volt brand swatch on black', async () => {
    const { result } = await renderHook(() => useAccentSwatches('dark'));

    expect(result.current.kinetiq).toBe(palette.volt);
  });
});
