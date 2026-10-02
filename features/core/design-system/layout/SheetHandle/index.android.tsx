import { StyleSheet, View } from 'react-native';
import { spacing, useAppTheme } from '@/features/core/theme';

/**
 * Material 3's bottom sheet drag handle, 32 by 4 dp and centred, which react-native-screens does
 * not draw (its grabber option is iOS only). It marks the sheet's top edge as the part to drag,
 * which the dim alone does not do on a dark page. Decorative: the sheet's own gestures and the
 * title bar under it carry the meaning, so a screen reader skips it.
 */
export function SheetHandle() {
  const theme = useAppTheme();
  return (
    <View
      style={[styles.handle, { backgroundColor: theme.colors.textFaint }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

const styles = StyleSheet.create({
  handle: { alignSelf: 'center', width: 32, height: 4, borderRadius: 2, marginTop: spacing.md },
});
