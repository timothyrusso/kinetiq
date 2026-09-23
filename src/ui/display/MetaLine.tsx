/**
 * A row of icon + value items: the replacement for every middle-dot string.
 *
 * Takes `theme` as a prop and draws with `CellText`, the same discipline as `rows.tsx`: this
 * renders inside list rows, and a context read per row would turn an appearance change into a
 * re-render of every visible row.
 *
 * `wrap` lets items flow onto a second line between items. Without it the line truncates, which
 * is right for a list row (fixed height, measured once) and wrong for a detail header.
 */
import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Theme } from '@/theme/theme';
import { spacing } from '@/theme/tokens';
import { Icon, ICON_SIZE } from '@/ui/icons';
import { CellText } from '@/ui/CellText';
import type { MetaItem } from './types';

export const MetaLine = memo(function MetaLine({
  items,
  theme,
  wrap = false,
  style,
}: {
  items: readonly MetaItem[];
  theme: Theme;
  wrap?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  if (items.length === 0) return null;
  return (
    <View
      style={[styles.line, wrap ? styles.wrap : styles.nowrap, style]}
      accessible
      accessibilityLabel={items.map((i) => i.a11y ?? i.label).join(', ')}
    >
      {items.map((item) => (
        <View key={`${item.icon}:${item.label}`} style={styles.item}>
          <Icon name={item.icon} size={ICON_SIZE.micro} color={theme.colors.textFaint} />
          <CellText
            text={item.label}
            variant="caption"
            color={theme.colors.textMuted}
            numberOfLines={1}
          />
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', columnGap: spacing.md, rowGap: spacing.xs },
  wrap: { flexWrap: 'wrap' },
  nowrap: { flexWrap: 'nowrap', overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 },
});
