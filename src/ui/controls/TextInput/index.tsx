/**
 * A labelled text field: the platform's own text input (SwiftUI's `TextField`, Compose's
 * `TextField`) inside the app's field box.
 *
 * The box, the label above it, the unit, the clear control and the hint or error below are
 * drawn in React Native, because they are layout around the field rather than the field. The
 * editable text itself is native: the system caret, selection handles, keyboard behaviour,
 * autofill and Dynamic Type come with it.
 *
 * ## Controlled, through an observable
 *
 * The native field owns its text in an observable value. Typing flows out through
 * `onChangeText`; a `value` that changes from outside (a clear, a reset, a store hydrating)
 * is written back into the observable, so the field and its state cannot disagree.
 */
import { memo, useEffect, useMemo, useRef, useState, type Ref } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type KeyboardTypeOptions,
  type ReturnKeyTypeOptions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Host, TextInput as NativeTextInput, useNativeState, type TextInputRef } from '@expo/ui';

import { useT } from '@/i18n/useT';
import { haptics } from '@/services/haptics';
import { useAppTheme } from '@/theme/theme';
import { fontFamily, radius, spacing } from '@/theme/tokens';
import { Icon, ICON_SIZE } from '@/ui/icons';
import { Row } from '@/ui/layout';
import { Txt } from '@/ui/Text';

export type TextInputHandle = TextInputRef;

export type TextInputProps = {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  /** Validation copy. Also turns the field to the danger colour. */
  error?: string | null;
  hint?: string;
  /** Trailing unit, e.g. `cm`: inside the box, after the value, so the two read together. */
  unit?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  multiline?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  keyboardType?: KeyboardTypeOptions;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  maxLength?: number;
  ref?: Ref<TextInputHandle>;
};

export const TextInput = memo(function TextInput({
  label,
  value,
  onChangeText,
  error,
  hint,
  unit,
  accessibilityLabel,
  accessibilityHint,
  disabled = false,
  style,
  multiline = false,
  placeholder,
  autoFocus,
  keyboardType,
  returnKeyType,
  onSubmitEditing,
  autoCapitalize = 'sentences',
  // Off by default: autocorrect turns "Bulgarian Split Squat" into "Bulgarian Split Span".
  autoCorrect = false,
  maxLength,
  ref,
}: TextInputProps) {
  const { t } = useT();
  const theme = useAppTheme();
  const [focused, setFocused] = useState(false);
  const text = useNativeState(value);
  const inner = useRef<TextInputRef>(null);
  // Written back only when the value really came from outside, so a keystroke never races
  // its own echo.
  const lastEmitted = useRef(value);
  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      text.value = value;
    }
  }, [text, value]);

  const borderColor = error ? theme.colors.danger : focused ? theme.colors.accent : theme.colors.border;
  const box = useMemo<ViewStyle>(
    () => ({
      flexDirection: 'row',
      alignItems: multiline ? 'flex-start' : 'center',
      gap: spacing.sm,
      minHeight: multiline ? 96 : 50,
      paddingHorizontal: spacing.lg,
      paddingVertical: multiline ? spacing.md : 0,
      borderRadius: radius.md,
      borderWidth: focused ? 1.5 : 1,
      borderColor,
      backgroundColor: focused ? theme.colors.accentSoft : theme.colors.surface,
      opacity: disabled ? 0.5 : 1,
    }),
    [borderColor, disabled, focused, multiline, theme.colors.accentSoft, theme.colors.surface],
  );

  return (
    <View style={[styles.field, style]}>
      <Txt variant="micro" tone={error ? 'danger' : focused ? 'accent' : 'faint'} uppercase tracking={0.8}>
        {label}
      </Txt>
      <View style={box} {...(accessibilityHint ? { accessibilityHint } : {})}>
        <Host
          matchContents={{ vertical: true }}
          colorScheme={theme.mode}
          seedColor={theme.colors.accent}
          style={styles.host}
        >
          <NativeTextInput
            ref={(node) => {
              inner.current = node;
              if (typeof ref === 'function') ref(node);
              else if (ref) (ref as { current: TextInputRef | null }).current = node;
            }}
            value={text}
            onChangeText={(next) => {
              lastEmitted.current = next;
              onChangeText(next);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            editable={!disabled}
            multiline={multiline}
            {...(multiline ? { rows: 3 } : {})}
            {...(placeholder ? { placeholder } : {})}
            {...(autoFocus ? { autoFocus } : {})}
            {...(keyboardType ? { keyboardType } : {})}
            {...(returnKeyType ? { returnKeyType } : {})}
            {...(onSubmitEditing ? { onSubmitEditing: () => onSubmitEditing() } : {})}
            {...(maxLength ? { maxLength } : {})}
            autoCapitalize={autoCapitalize}
            autoCorrect={autoCorrect}
            cursorColor={theme.colors.accent}
            testID={accessibilityLabel ?? label}
            textStyle={{
              fontFamily: fontFamily.regular,
              fontSize: theme.fontSize.bodyLg,
              color: theme.colors.text,
            }}
          />
        </Host>
        {unit ? (
          <Txt variant="body" tone="faint" style={multiline ? styles.unitTop : undefined}>
            {unit}
          </Txt>
        ) : null}
        {value.length > 0 && !disabled ? (
          <Pressable
            onPress={() => {
              haptics.light();
              lastEmitted.current = '';
              text.value = '';
              onChangeText('');
              inner.current?.focus();
            }}
            hitSlop={spacing.sm}
            accessibilityRole="button"
            accessibilityLabel={t('textInput.clear', { label })}
          >
            <Icon name="close" size={ICON_SIZE.micro} color={theme.colors.textFaint} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Row gap="xs">
          <Icon name="warning" size={ICON_SIZE.micro} color={theme.colors.danger} />
          <Txt variant="caption" color={theme.colors.danger}>
            {error}
          </Txt>
        </Row>
      ) : hint ? (
        <Txt variant="caption" tone="faint">
          {hint}
        </Txt>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  host: { flex: 1 },
  unitTop: { marginTop: 3 },
});
