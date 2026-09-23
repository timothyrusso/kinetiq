/**
 * Material 3's filter chip, for filter rails.
 *
 * Text only: a Compose chip's icon slot takes a Compose icon, and the app's glyphs are an RN
 * icon font. A removable token clears on press, which is what its remove control did too.
 * Chips inside list rows are not this component: those are `TagRow`, in plain RN, because a
 * native host per chip is a native view boundary per chip in a recycling list.
 */
import { memo } from 'react';
import { FilterChip, Host, Text } from '@expo/ui/jetpack-compose';

import { haptics } from '@/services/haptics';
import { useAppTheme } from '@/theme/theme';
import type { ChipProps } from './types';

export type { ChipProps } from './types';

export const Chip = memo(function Chip({ label, selected = false, onPress, count, onRemove, style }: ChipProps) {
  const theme = useAppTheme();
  const text = count === undefined ? label : `${label} ${count}`;
  return (
    <Host matchContents colorScheme={theme.mode} seedColor={theme.colors.accent} style={style}>
      <FilterChip
        selected={selected}
        onClick={() => {
          haptics.selection();
          (selected && onRemove ? onRemove : onPress)();
        }}
      >
        <FilterChip.Label>
          <Text>{text}</Text>
        </FilterChip.Label>
      </FilterChip>
    </Host>
  );
});
