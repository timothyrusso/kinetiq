import type { GestureResponderEvent, StyleProp, ViewStyle } from 'react-native';

import type { IconName } from '@/ui/icons';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = {
  label: string;
  onPress: (e?: GestureResponderEvent) => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  /** Renders after the label: used for trailing chevrons on list-like buttons. */
  trailingIcon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  /** Fires `heavy` instead of `medium`: for committing something weighty. */
  weighty?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};
