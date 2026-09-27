import { Host, SegmentedButton, SingleChoiceSegmentedButtonRow, Text } from '@expo/ui/jetpack-compose';
import type { SegmentedControlProps } from '@/features/core/design-system/controls/SegmentedControl/types';
import { haptics } from '@/features/core/haptics';
import { useAppTheme } from '@/features/core/theme';

export type { Segment, SegmentedControlProps } from '@/features/core/design-system/controls/SegmentedControl/types';

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
        {segments.map(s => (
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
