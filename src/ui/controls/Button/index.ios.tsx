/**
 * The app's button. Primary and secondary are SwiftUI's own (`borderedProminent` and
 * `bordered`, tinted with the app's accent), so they carry the system's press states, Dynamic
 * Type and the iOS 26 material. Everything the native button has no variant for (ghost,
 * quiet, danger) and any button while it is loading is the drawn button.
 */
import { memo } from 'react';
import type { SFSymbol } from 'sf-symbols-typescript';
import { Button as NativeButton, Host, Text } from '@expo/ui/swift-ui';
import { buttonStyle, controlSize, disabled as disabledMod, frame, tint } from '@expo/ui/swift-ui/modifiers';

import { haptics } from '@/services/haptics';
import { useAppTheme } from '@/theme/theme';
import type { IconName } from '@/ui/icons';
import { DrawnButton } from './Drawn';
import type { ButtonProps } from './types';

export type { ButtonProps, ButtonSize, ButtonVariant } from './types';

/** The few glyphs that appear on buttons, as the SF Symbols a native button draws. */
const SF: Partial<Record<IconName, SFSymbol>> = {
  plus: 'plus',
  play: 'play.fill',
  pause: 'pause.fill',
  stop: 'stop.fill',
  trash: 'trash',
  mapPin: 'mappin',
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
      colorScheme={theme.mode}
      style={[fullWidth ? { alignSelf: 'stretch' } : { alignSelf: 'flex-start' }, style]}
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
          disabledMod(disabled),
        ]}
      >
        <Text modifiers={fullWidth ? [frame({ maxWidth: FILL })] : []}>{label}</Text>
      </NativeButton>
    </Host>
  );
});
