import { StyleSheet } from 'react-native';
import { stylesFor } from '@/features/core/design-system/styles/useStyles';
import { type Theme, themeFor } from '@/features/core/theme';

const createStyles = jest.fn((theme: Theme) => StyleSheet.create({ box: { backgroundColor: theme.colors.surface } }));

describe('stylesFor', () => {
  it('builds the styles once per theme object and hands back the same object after that', () => {
    const dark = themeFor('dark');
    const light = themeFor('light');

    const first = stylesFor(createStyles, dark);
    expect(stylesFor(createStyles, dark)).toBe(first);
    expect(stylesFor(createStyles, light)).not.toBe(first);
    expect(stylesFor(createStyles, light).box.backgroundColor).toBe(light.colors.surface);
    expect(createStyles).toHaveBeenCalledTimes(2);
  });
});
