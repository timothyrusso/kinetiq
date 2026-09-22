/**
 * Chips for taxonomy: muscles, equipment, an activity kind.
 *
 * Plain React Native on purpose. These sit inside list rows, and a native host per chip is a
 * native view boundary per chip, which is exactly what a recycling list cannot afford.
 *
 * `max` caps the visible tags and shows the rest as `+n`, so a row stays one line tall however
 * many muscles an exercise works.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Theme } from '@/theme/theme';
import { radius, spacing } from '@/theme/tokens';
import { CellText } from '@/ui/rows';
import type { Tag, Tone } from './types';

export const TagRow = memo(function TagRow({
  tags,
  theme,
  max,
  style,
}: {
  tags: readonly Tag[];
  theme: Theme;
  max?: number;
  style?: StyleProp<ViewStyle>;
}) {
  if (tags.length === 0) return null;
  const shown = max === undefined ? tags : tags.slice(0, max);
  const hidden = tags.length - shown.length;
  return (
    <View style={[styles.row, style]}>
      {shown.map((tag) => (
        <TagChip key={tag.key} tag={tag} theme={theme} />
      ))}
      {hidden > 0 ? (
        <View style={[styles.chip, { backgroundColor: theme.colors.placeholder }]}>
          <CellText text={`+${hidden}`} variant="micro" color={theme.colors.textMuted} />
        </View>
      ) : null}
    </View>
  );
});

function TagChip({ tag, theme }: { tag: Tag; theme: Theme }) {
  const { background, text } = tonePalette(theme, tag.tone ?? 'neutral');
  const body = (
    <CellText text={tag.label} variant="micro" color={text} numberOfLines={1} />
  );
  if (!tag.onPress) {
    return <View style={[styles.chip, { backgroundColor: background }]}>{body}</View>;
  }
  return (
    <Pressable
      onPress={tag.onPress}
      accessibilityRole="button"
      accessibilityLabel={tag.label}
      hitSlop={spacing.xs}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: background, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {body}
    </Pressable>
  );
}

function tonePalette(theme: Theme, tone: Tone): { background: string; text: string } {
  if (tone === 'neutral') return { background: theme.colors.placeholder, text: theme.colors.textMuted };
  if (tone === 'accent') return { background: theme.colors.accentSoft, text: theme.colors.accent };
  return { background: theme.colors.toneSoft[tone], text: theme.colors.tone[tone] };
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
});
