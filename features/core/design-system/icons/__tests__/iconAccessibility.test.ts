import { iconAccessibility } from '@/features/core/design-system/icons/iconAccessibility';

describe('iconAccessibility', () => {
  it('keeps a decorative icon out of the label its parent assembles', () => {
    expect(iconAccessibility(undefined)).toMatchObject({ accessible: false, accessibilityElementsHidden: true });
  });

  it('reads a labelled icon as an image', () => {
    expect(iconAccessibility('Streak')).toEqual({
      accessible: true,
      accessibilityRole: 'image',
      accessibilityLabel: 'Streak',
    });
  });
});
