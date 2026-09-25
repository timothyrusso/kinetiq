/**
 * The stepper's number, which can also be typed.
 *
 * − and + are right for nudging (one more rep, 2.5 kg heavier) and wrong for jumping: rest from
 * 90 to 240 s is ten presses. Tapping the number opens the number pad instead, and both paths
 * write through the same `onChange`.
 *
 * ## Typing writes as you type
 *
 * Each keystroke that parses commits, clamped to the range, so there is no Done button to
 * miss: iOS's number pad has no return key, and a value that only lands on blur is a value lost
 * when the sheet is swiped away. What the field SHOWS while focused is what was typed, so
 * clearing "12" to type "8" does not flash the minimum in between. On blur it shows the value
 * that was kept.
 *
 * Typed values are clamped but not snapped to the step: the step is the size of a nudge, not
 * the set of legal answers, and 75 s of rest is a real choice.
 *
 * It is React Native's `TextInput`, which is UIKit's and Android's own text field, rather than
 * the Expo UI field: this sits inside a row next to the native stepper, where a second native
 * host would be a second view boundary for one number.
 */
import { memo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { useAppTheme } from '@/theme/theme';
import { fontFamilyOf, fontSizeOf, Txt, type TxtVariant } from '@/ui/Text';
import { formatStepperValue } from './types';

type Props = {
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  decimal: boolean;
  suffix?: string;
  label: string;
  compact: boolean;
  align: 'left' | 'center';
};

function parse(text: string): number | null {
  const n = Number(text.replace(',', '.'));
  return text.trim() === '' || !Number.isFinite(n) ? null : n;
}

export const StepperValue = memo(function StepperValue({
  value,
  onChange,
  min,
  max,
  decimal,
  suffix,
  label,
  compact,
  align,
}: Props) {
  const theme = useAppTheme();
  const [draft, setDraft] = useState<string | null>(null);
  const variant: TxtVariant = compact ? 'numeralSm' : 'numeral';
  const text = draft ?? formatStepperValue(value);
  // A text field does not size to its text the way a label does, so it is given the width of
  // what it holds: display numerals run about 0.62 em, plus room for the caret.
  const width = Math.ceil(Math.max(text.length, 1) * fontSizeOf(variant) * 0.62) + 4;

  const onChangeText = (typed: string) => {
    setDraft(typed);
    const n = parse(typed);
    if (n === null) return;
    const kept = Math.min(max, Math.max(min, decimal ? Math.round(n * 100) / 100 : Math.round(n)));
    if (kept !== value) onChange(kept);
  };

  return (
    <View style={[styles.row, align === 'center' ? styles.center : null]}>
      <TextInput
        value={text}
        onChangeText={onChangeText}
        onFocus={() => setDraft(formatStepperValue(value))}
        onBlur={() => setDraft(null)}
        selectTextOnFocus
        keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
        accessibilityLabel={label}
        maxLength={6}
        selectionColor={theme.colors.accent}
        style={[
          styles.input,
          {
            color: theme.colors.text,
            fontFamily: fontFamilyOf(variant),
            fontSize: fontSizeOf(variant),
            textAlign: align,
            width,
          },
        ]}
      />
      {suffix ? (
        <Txt variant="caption" tone="faint">
          {` ${suffix}`}
        </Txt>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline' },
  center: { justifyContent: 'center' },
  // No padding: the field must sit exactly where the static number used to.
  input: { padding: 0, margin: 0 },
});
