import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Txt, useStyles } from '@/features/core/design-system';
import { createStyles } from '@/features/profile/ui/components/Preference/Preference.style';

/** A label and the control beneath it. */
export function Preference({ label, children }: { label: string; children: ReactNode }) {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.block}>
      <Txt variant="strong">{label}</Txt>
      {children}
    </View>
  );
}
