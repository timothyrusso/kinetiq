import { memo } from 'react';
import { type GestureResponderEvent, type StyleProp, View, type ViewStyle } from 'react-native';
import { AnimatedPressable, usePressScale } from '@/features/core/design-system/animation/animation';
import { Icon, type IconName } from '@/features/core/design-system/icons/icons';
import { Txt } from '@/features/core/design-system/text/Text';
import { haptics } from '@/features/core/haptics';
import { radius, spacing, touchTarget, useAppTheme } from '@/features/core/theme';

/**
 * A full-width row that behaves like a button: a list cell, a settings item. Kept
 * separate from `Button` because its anatomy is different (title + supporting text
 * + trailing accessory) and because it must not inherit button skin.
 */
export const ActionRow = memo(function ActionRow({
  title,
  subtitle,
  icon,
  trailing,
  onPress,
  tone = 'default',
  style,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  trailing?: React.ReactNode;
  onPress: (e: GestureResponderEvent) => void;
  tone?: 'default' | 'danger';
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  const scale = usePressScale(0.995);
  const color = tone === 'danger' ? theme.colors.danger : theme.colors.text;

  return (
    <AnimatedPressable
      onPress={(e: GestureResponderEvent) => {
        haptics.light();
        onPress(e);
      }}
      onPressIn={scale.onPressIn}
      onPressOut={scale.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.lg,
          minHeight: touchTarget,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          borderRadius: radius.md,
          backgroundColor: theme.colors.surface,
        },
        scale.style,
        style,
      ]}
    >
      {icon ? (
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: radius.sm,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: tone === 'danger' ? theme.colors.dangerSoft : theme.colors.placeholder,
          }}
        >
          <Icon name={icon} size={18} color={color} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="bodyLg" weight="semibold" color={color} numberOfLines={1}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="caption" tone="muted" numberOfLines={2}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {trailing ?? <Icon name="chevronRight" size={18} color={theme.colors.textFaint} />}
    </AnimatedPressable>
  );
});
