import { Host, Picker, Text } from '@expo/ui/swift-ui';
import { pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';

import { haptics } from '@/services/haptics';
import { useAppTheme } from '@/theme/theme';
import type { SegmentedControlProps } from './types';

export type { Segment, SegmentedControlProps } from './types';

/** UIKit's segmented control, through SwiftUI's `Picker` in segmented style. */
export function SegmentedControl<T extends string>({ segments, value, onChange }: SegmentedControlProps<T>) {
  const theme = useAppTheme();
  return (
    // `vertical` only: the host hugs the control's height, which Dynamic Type can change, and
    // fills the width it is given rather than shrinking to its labels.
    <Host
      matchContents={{ vertical: true }}
      colorScheme={theme.mode}
      seedColor={theme.colors.accent}
      style={{ width: '100%' }}
    >
      <Picker
        selection={value}
        onSelectionChange={(next) => {
          haptics.selection();
          onChange(next as T);
        }}
        modifiers={[pickerStyle('segmented')]}
      >
        {segments.map((s) => (
          <Text key={s.value} modifiers={[tag(s.value)]}>
            {s.label}
          </Text>
        ))}
      </Picker>
    </Host>
  );
}
