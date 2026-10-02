import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Txt, type TxtProps } from '@/features/core/design-system/text/Text';
import { spacing } from '@/features/core/theme';

/** Tabular digits share one width, so two zeros size the column for any step up to 99. */
const WIDEST_NUMBER = '00.';

/**
 * Steps in order, each with its number in a column of its own, so a wrapped line starts under
 * the text rather than under the number. A how-to read mid-set is scanned for "where was I", and
 * a number finds the place a paragraph break does not.
 *
 * The column is as wide as a hidden two-digit label in the same variant, so it follows the type
 * scale and the text of step 10 starts where the text of step 9 does.
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
          <View>
            <Txt
              variant={variant}
              style={[styles.number, styles.numberSizer]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {WIDEST_NUMBER}
            </Txt>
            <Txt variant={variant} tone="faint" align="right" style={[styles.number, styles.numberLabel]}>
              {`${index + 1}.`}
            </Txt>
          </View>
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
  number: { fontVariant: ['tabular-nums'] },
  numberSizer: { opacity: 0 },
  numberLabel: { position: 'absolute', left: 0, right: 0 },
  text: { flex: 1 },
});
