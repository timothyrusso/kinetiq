import { Host, SegmentedButton, SingleChoiceSegmentedButtonRow, Text } from '@expo/ui/jetpack-compose';

import { haptics } from '@/services/haptics';
import { useAppTheme } from '@/theme/theme';
import type { SegmentedControlProps } from './types';

export type { Segment, SegmentedControlProps } from './types';

/** Material 3's single-choice segmented button row. */
export function SegmentedControl<T extends string>({ segments, value, onChange }: SegmentedControlProps<T>) {
  const theme = useAppTheme();
  return (
    <Host
      matchContents={{ vertical: true }}
      colorScheme={theme.mode}
      seedColor={theme.colors.accent}
      style={{ width: '100%' }}
    >
      <SingleChoiceSegmentedButtonRow>
        {segments.map((s) => (
          <SegmentedButton
            key={s.value}
            selected={s.value === value}
            onClick={() => {
              if (s.value === value) return;
              haptics.selection();
              onChange(s.value);
            }}
          >
            <SegmentedButton.Label>
              <Text>{s.label}</Text>
            </SegmentedButton.Label>
          </SegmentedButton>
        ))}
      </SingleChoiceSegmentedButtonRow>
    </Host>
  );
}
