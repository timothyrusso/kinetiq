/**
 * A section title with an optional counter and one trailing text action.
 *
 * The action is data (`{ label, onPress }`), not a node, so every section's trailing action is
 * the same size, weight and colour. When it was a free slot, sections carried a quiet button in
 * one place, a chip in another and an icon in a third, and a screen with three sections looked
 * like three screens.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/theme/theme';
import { spacing } from '@/theme/tokens';
import { Txt } from '@/ui/Text';

export const SectionHeader = memo(function SectionHeader({
  title,
  eyebrow,
  counter,
  action,
  style,
}: {
  title: string;
  /** The small uppercase line above the title. Spoken before it, in the case it is drawn in. */
  eyebrow?: string;
  /** Announced with the title rather than read as a stray number. */
  counter?: number;
  action?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  return (
    <View style={[styles.row, style]}>
      <View
        style={styles.titles}
        accessible
        accessibilityRole="header"
        accessibilityLabel={[
          eyebrow?.toLocaleUpperCase(),
          counter === undefined ? title : `${title}, ${counter}`,
        ]
          .filter(Boolean)
          .join('. ')}
      >
        {eyebrow ? (
          <Txt variant="micro" tone="faint" uppercase tracking={0.8}>
            {eyebrow}
          </Txt>
        ) : null}
        <View style={styles.titleLine}>
          <Txt variant="title" numberOfLines={1} style={styles.title}>
            {title}
          </Txt>
          {counter === undefined ? null : (
            <Txt variant="label" tone="faint">
              {counter}
            </Txt>
          )}
        </View>
      </View>
      {action ? (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          hitSlop={spacing.sm}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Txt variant="label" weight="600" color={theme.colors.accent}>
            {action.label}
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  titles: { flexShrink: 1, gap: spacing.xxs },
  titleLine: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  title: { flexShrink: 1 },
});
