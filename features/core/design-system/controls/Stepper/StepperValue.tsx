/**
 * The stepper's number, which can also be typed.
 *
 * − and + are right for nudging (one more rep, 2.5 kg heavier) and wrong for jumping: rest from
 * 90 to 240 s is ten presses. Tapping the number opens the number pad instead, and both paths
 * write through the same `onChange`.
 *
 * ## Typing commits once
 *
 * While focused the field shows exactly what was typed and writes nothing; the number is parsed
 * and clamped when typing ends (blur, the done key, or the field going away), and a − or + press
 * steps from the typed number. See `useStepperField`, which the stepper owns so its press can
 * reach the draft.
 *
 * Typed values are clamped but not snapped to the step: the step is the size of a nudge, not
 * the set of legal answers, and 75 s of rest is a real choice.
 *
 * It is React Native's `TextInput`, which is UIKit's and Android's own text field, rather than
 * the Expo UI field: this sits inside a row next to the native stepper, where a second native
 * host would be a second view boundary for one number.
 */
import { memo, type RefObject } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { fontFamilyOf, fontSizeOf, Txt, type TxtVariant } from '@/features/core/design-system/text/Text';
import { useAppTheme } from '@/features/core/theme';

type Props = {
  text: string;
  input: RefObject<TextInput | null>;
  selectOnFocus: boolean;
  onFocus: () => void;
  onChangeText: (typed: string) => void;
  onBlur: () => void;
  decimal: boolean;
  suffix?: string;
  label: string;
  compact: boolean;
  align: 'left' | 'center';
};

export const StepperValue = memo(function StepperValue({
  text,
  input,
  selectOnFocus,
  onFocus,
  onChangeText,
  onBlur,
  decimal,
  suffix,
  label,
  compact,
  align,
}: Props) {
  const theme = useAppTheme();
  const variant: TxtVariant = compact ? 'numeralSm' : 'numeral';
  // NOTE: A text field does not size to its text the way a label does, so it is given the width of
  // what it holds: display numerals run about 0.62 em, plus room for the caret.
  const width = Math.ceil(Math.max(text.length, 1) * fontSizeOf(variant) * 0.62) + 4;

  return (
    <View style={[styles.row, align === 'center' ? styles.center : null]}>
      <TextInput
        ref={input}
        value={text}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        selectTextOnFocus={selectOnFocus}
        returnKeyType="done"
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
  // NOTE: No padding: the field must sit exactly where the static number used to.
  input: { padding: 0, margin: 0 },
});
