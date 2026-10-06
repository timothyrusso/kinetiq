/**
 * Two secondary buttons side by side, equal in width and in height. When one label wraps, the
 * other button grows to match and keeps its label centred. Two separate `Button`s cannot do
 * this: each native host sizes itself to its own label.
 *
 * One SwiftUI host holds both. The stack is fixed to its ideal height (the taller button) and
 * each label asks for all the height it is offered, so both fill that height.
 */

import { Host, HStack, Button as NativeButton, Text } from '@expo/ui/swift-ui';
import {
  buttonStyle,
  controlSize,
  disabled as disabledMod,
  fixedSize,
  frame,
  multilineTextAlignment,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { memo } from 'react';
import type { SFSymbol } from 'sf-symbols-typescript';
import type { ButtonPairItem, ButtonPairProps } from '@/features/core/design-system/controls/ButtonPair/types';
import type { IconName } from '@/features/core/design-system/icons/icons';
import { haptics } from '@/features/core/haptics';
import { spacing, useAppTheme } from '@/features/core/theme';

export type { ButtonPairItem, ButtonPairProps } from '@/features/core/design-system/controls/ButtonPair/types';

const SF: Partial<Record<IconName, SFSymbol>> = { plus: 'plus', play: 'play.fill' };

/** Larger than any phone; SwiftUI treats it as "as much as offered". */
const FILL = 10_000;

const HOST_STYLE = { width: '100%' } as const;

export const ButtonPair = memo(function ButtonPair({ left, right }: ButtonPairProps) {
  const theme = useAppTheme();
  const half = (item: ButtonPairItem) => {
    const systemImage = item.icon ? SF[item.icon] : undefined;
    return (
      <NativeButton
        {...(systemImage ? { systemImage } : {})}
        onPress={() => {
          haptics.medium();
          item.onPress();
        }}
        modifiers={[
          buttonStyle('bordered'),
          controlSize('large'),
          tint(theme.colors.accent),
          disabledMod(item.disabled ?? false),
        ]}
      >
        <Text modifiers={[frame({ maxWidth: FILL, maxHeight: FILL }), multilineTextAlignment('center')]}>
          {item.label}
        </Text>
      </NativeButton>
    );
  };
  return (
    <Host matchContents={{ vertical: true }} ignoreSafeArea="all" colorScheme={theme.mode} style={HOST_STYLE}>
      <HStack spacing={spacing.md} modifiers={[fixedSize({ horizontal: false, vertical: true })]}>
        {half(left)}
        {half(right)}
      </HStack>
    </Host>
  );
});
