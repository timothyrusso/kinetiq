import { exerciseThumbTile, illustrationBackdrop } from '@/features/core/design-system/display/exerciseThumbTile';
import { themeFor } from '@/features/core/theme';

/** WCAG relative luminance of a `#RRGGBB` colour. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = channels.map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast of black line art drawn on `hex`. */
const contrastWithBlack = (hex: string) => (luminance(hex) + 0.05) / 0.05;

describe('exerciseThumbTile', () => {
  it('draws art on a tile black line art reads on, in dark mode', () => {
    expect(contrastWithBlack(exerciseThumbTile(themeFor('dark'), true))).toBeGreaterThanOrEqual(7);
  });

  it('keeps the light-mode art tile as it was', () => {
    expect(exerciseThumbTile(themeFor('light'), true)).toBe(themeFor('light').colors.placeholder);
  });

  it('keeps the initials on the theme placeholder', () => {
    expect(exerciseThumbTile(themeFor('dark'), false)).toBe(themeFor('dark').colors.placeholder);
  });
});

describe('illustrationBackdrop', () => {
  it('draws full-size art on a tile black line art reads on, in dark mode', () => {
    expect(contrastWithBlack(illustrationBackdrop(themeFor('dark')))).toBeGreaterThanOrEqual(7);
  });

  it('keeps light-mode art on the page', () => {
    expect(illustrationBackdrop(themeFor('light'))).toBe(themeFor('light').colors.background);
  });
});
