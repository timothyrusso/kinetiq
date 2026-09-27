import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Routine } from '@/domain/types';
import { MetaLine } from '@/features/core/design-system/display/MetaLine';
import type { MetaItem } from '@/features/core/design-system/display/types';
import { Icon, IconTile } from '@/features/core/design-system/icons/icons';
import { CellText } from '@/features/core/design-system/text/CellText';
import { screenGutter, spacing, type Theme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';

/** Routine row. Its metadata is the routine's volume and history, not its description. */
export const RoutineRow = memo(function RoutineRow({
  routine,
  theme,
  onPress,
  onLongPress,
  meta,
  trailing,
  topDivider = true,
}: {
  routine: Routine;
  theme: Theme;
  onPress: () => void;
  onLongPress?: () => void;
  meta: readonly MetaItem[];
  trailing?: React.ReactNode;
  topDivider?: boolean;
}) {
  const { t } = useT();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${routine.name}. ${meta.map(m => m.a11y ?? m.label).join(' · ')}`}
      accessibilityHint={t('misc.opensRoutine')}
      style={({ pressed }) => [
        {
          paddingHorizontal: screenGutter,
          paddingVertical: spacing.lg,
          gap: spacing.lg,
          flexDirection: 'row',
          alignItems: 'center',
          borderTopWidth: topDivider ? StyleSheet.hairlineWidth : 0,
          borderTopColor: theme.colors.hairline,
          backgroundColor: pressed ? theme.colors.surfacePressed : 'transparent',
        },
      ]}
    >
      <IconTile name="layers" color={theme.colors.accent} background={theme.colors.accentSoft} />
      <View style={{ flex: 1, gap: 4 }}>
        <CellText text={routine.name} variant="subhead" weight="600" color={theme.colors.text} numberOfLines={1} />
        <MetaLine items={meta} theme={theme} wrap />
      </View>
      {trailing ?? <Icon name="play" size={18} color={theme.colors.accent} />}
    </Pressable>
  );
});
