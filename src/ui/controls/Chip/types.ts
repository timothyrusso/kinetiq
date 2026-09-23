import type { StyleProp, ViewStyle } from 'react-native';

import type { IconName } from '@/ui/icons';

/** A filter token: a label that is on or off, optionally with a result count or a remove. */
export type ChipProps = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: IconName;
  count?: number;
  size?: 'sm' | 'md';
  /** Turns the chip into a removable filter token with an inline remove control. */
  onRemove?: () => void;
  style?: StyleProp<ViewStyle>;
};
