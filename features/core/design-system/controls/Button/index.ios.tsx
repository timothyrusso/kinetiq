/**
 * The app's button. Primary and secondary are SwiftUI's own (`borderedProminent` and
 * `bordered`, tinted with the app's accent), so they carry the system's press states, Dynamic
 * Type and the iOS 26 material. Everything the native button has no variant for (ghost,
 * quiet, danger) and any button while it is loading is the drawn button.
 */

import { Host, Button as NativeButton, Text } from '@expo/ui/swift-ui';
import {
  buttonStyle,
  controlSize,
  disabled as disabledMod,
  foregroundStyle,
  frame,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { memo } from 'react';
import type { SFSymbol } from 'sf-symbols-typescript';
import { DrawnButton, FILL_STYLE, HUG_STYLE } from '@/features/core/design-system/controls/Button/Drawn';
import type { ButtonProps } from '@/features/core/design-system/controls/Button/types';
import type { IconName } from '@/features/core/design-system/icons/icons';
import { haptics } from '@/features/core/haptics';
import { useAppTheme } from '@/features/core/theme';

export type { ButtonProps, ButtonSize, ButtonVariant } from '@/features/core/design-system/controls/Button/types';

/** The few glyphs that appear on buttons, as the SF Symbols a native button draws. */
const SF: Partial<Record<IconName, SFSymbol>> = {
  plus: 'plus',
  play: 'play.fill',
  pause: 'pause.fill',
  stop: 'stop.fill',
  trash: 'trash',
  bell: 'bell',
  search: 'magnifyingglass',
  refresh: 'arrow.clockwise',
  info: 'info.circle',
  home: 'house',
  close: 'xmark',
};

/** Wide enough to fill any phone; SwiftUI treats it as "as wide as offered". */
const FILL = 10_000;

export const Button = memo(function Button(props: ButtonProps) {
  const theme = useAppTheme();
  const { variant = 'primary', size = 'md', loading = false } = props;
  if (loading || (variant !== 'primary' && variant !== 'secondary')) return <DrawnButton {...props} />;
  const { label, onPress, icon, disabled = false, fullWidth = false, weighty = false, style } = props;
  const systemImage = icon ? SF[icon] : undefined;
  return (
    <Host
      matchContents={fullWidth ? { vertical: true } : true}
      // NOTE: A host inside a ScrollView takes the window's safe-area insets as it moves, and draws
      // its content offset by them until the next layout: the button visibly jumped the first
      // time its card was scrolled.
      ignoreSafeArea="all"
      colorScheme={theme.mode}
      style={[fullWidth ? FILL_STYLE : HUG_STYLE, style]}
    >
      <NativeButton
        {...(systemImage ? { systemImage } : {})}
        onPress={() => {
          if (weighty) haptics.heavy();
          else haptics.medium();
          onPress();
        }}
        modifiers={[
          buttonStyle(variant === 'primary' ? 'borderedProminent' : 'bordered'),
          controlSize(size === 'sm' ? 'small' : 'large'),
          tint(theme.colors.accent),
          // NOTE: The label on the filled button is the theme's own ink for the accent, not SwiftUI's
          // default white: white on the dark mode's lime was barely readable.
          ...(variant === 'primary' ? [foregroundStyle(theme.colors.onAccent)] : []),
          disabledMod(disabled),
        ]}
      >
        <Text modifiers={fullWidth ? [frame({ maxWidth: FILL })] : []}>{label}</Text>
      </NativeButton>
    </Host>
  );
});
