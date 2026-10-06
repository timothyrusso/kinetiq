import type { IconName } from '@/features/core/design-system/icons/icons';

export type ButtonPairItem = {
  label: string;
  onPress: () => void;
  /** iOS draws it before the label; Android's outlined button is text only, as `Button` is. */
  icon?: IconName;
  disabled?: boolean;
};

export type ButtonPairProps = {
  left: ButtonPairItem;
  right: ButtonPairItem;
};
