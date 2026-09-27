import { act, renderHook } from '@testing-library/react-native';
import type { AccentChoice } from '@/features/core/theme';
import { themeFor } from '@/features/core/theme';
import { useAccentSwatchLogic } from '@/features/profile/ui/components/AccentSwatch/AccentSwatch.logic';

const theme = themeFor('dark');
const picked: AccentChoice[] = [];
const pick = (option: AccentChoice) => void picked.push(option);

beforeEach(() => {
  picked.length = 0;
});

describe('useAccentSwatchLogic', () => {
  it('rings the selected swatch in the text colour and fills it with its accent', async () => {
    const { result } = await renderHook(() => useAccentSwatchLogic('ocean', '#1E88E5', true, theme, pick));

    expect(result.current.derived.ring.borderColor).toBe(theme.colors.text);
    expect(result.current.derived.fill.backgroundColor).toBe('#1E88E5');
  });

  it('leaves an unselected swatch without a ring', async () => {
    const { result } = await renderHook(() => useAccentSwatchLogic('ocean', '#1E88E5', false, theme, pick));

    expect(result.current.derived.ring.borderColor).toBe('transparent');
  });

  it('picks its own option on press', async () => {
    const { result } = await renderHook(() => useAccentSwatchLogic('berry', '#8E24AA', false, theme, pick));

    await act(async () => result.current.effects.press());

    expect(picked).toEqual(['berry']);
  });
});
