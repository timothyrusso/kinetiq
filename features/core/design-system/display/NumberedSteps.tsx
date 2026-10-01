import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Txt, type TxtProps } from '@/features/core/design-system/text/Text';
import { spacing } from '@/features/core/theme';

/**
 * Steps in order, each with its number in a column of its own, so a wrapped line starts under
 * the text rather than under the number. A how-to read mid-set is scanned for "where was I", and
 * a number finds the place a paragraph break does not.
 */
export const NumberedSteps = memo(function NumberedSteps({
  steps,
  variant = 'body',
  tone = 'default',
}: {
  steps: readonly string[];
  variant?: TxtProps['variant'];
  tone?: TxtProps['tone'];
}) {
  return (
    <View style={styles.list}>
      {steps.map((step, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the steps are a fixed list, and two may read the same.
        <View key={index} style={styles.step}>
          <Txt variant={variant} tone="faint" style={styles.number}>
            {`${index + 1}.`}
          </Txt>
          <Txt variant={variant} tone={tone} style={styles.text}>
            {step}
          </Txt>
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  step: { flexDirection: 'row', gap: spacing.sm },
  number: { minWidth: spacing.xl, fontVariant: ['tabular-nums'] },
  text: { flex: 1 },
});
