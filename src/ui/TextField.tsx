/**
 * Text input. The two things that make an RN form feel unfinished are keyboard
 * behaviour and focus feedback, so both are handled here once:
 *
 * - **Focus is a state, not a guess.** `onFocus`/`onBlur` drive the ring and the
 *   background tint. Android also fires blur for reasons unrelated to the field
 *   losing intent, so the ring is cleared on `onBlur` only — never inferred from a
 *   keyboard event.
 * - **Keyboard avoidance is per-platform.** iOS needs `padding` because the keyboard
 *   overlays the window; Android's `adjustResize` already shrinks the window, so a
 *   second shift there moves the form twice. The behaviour is picked from the
 *   platform rather than guessed by measuring frames.
 * - **Labels are never placeholders.** A placeholder vanishes the moment the user
 *   types, which is exactly when they need to remember whether the box is weight or
 *   distance.
 */
import React, {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { fontFamily, radius, spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme';
import { haptics } from '@/services/haptics';
import { Row } from './layout';
import { Icon } from './icons';
import { Txt } from './Text';

export type TextFieldHandle = {
  focus: () => void;
  blur: () => void;
  isFocused: () => boolean;
};

type OwnProps = {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  /** Validation copy. Also flips the field to the danger palette. */
  error?: string | null;
  hint?: string;
  /** Leading unit, e.g. `kg` — inside the box so the number and its unit read together. */
  unit?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export type TextFieldProps = OwnProps & Omit<TextInputProps, 'value' | 'onChangeText'>;

export const TextField = forwardRef<TextFieldHandle, TextFieldProps>(function TextField(
  {
    label,
    value,
    onChangeText,
    error,
    hint,
    unit,
    accessibilityLabel,
    disabled = false,
    style,
    multiline = false,
    secureTextEntry = false,
    onFocus,
    onBlur,
    ...rest
  },
  ref,
) {
  const theme = useAppTheme();
  const input = useRef<TextInput | null>(null);
  const [focused, setFocused] = useState(false);
  const [secretHidden, setSecretHidden] = useState(true);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => input.current?.focus(),
      blur: () => input.current?.blur(),
      isFocused: () => input.current?.isFocused() ?? false,
    }),
    [],
  );

  // RN 0.86 types these with its synthesized `FocusEvent`/`BlurEvent` rather than the
  // legacy `NativeSyntheticEvent<TextInputFocusEventData>`. Deriving the parameter type
  // from the prop means this file does not break the next time RN renames the event.
  const handleFocus = useCallback<NonNullable<TextInputProps['onFocus']>>(
    (e) => {
      setFocused(true);
      onFocus?.(e);
    },
    [onFocus],
  );

  const handleBlur = useCallback<NonNullable<TextInputProps['onBlur']>>(
    (e) => {
      setFocused(false);
      onBlur?.(e);
    },
    [onBlur],
  );

  const borderColor = error
    ? theme.colors.danger
    : focused
      ? theme.colors.accent
      : theme.colors.border;

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
      // A soft tint of the focus colour reads as "this field is live" without the box
      // changing hue twice (border, then background) as the user types.
      backgroundColor: focused ? theme.colors.accentSoft : theme.colors.surface,
      opacity: disabled ? 0.5 : 1,
    }),
    [borderColor, disabled, focused, multiline, theme.colors.accentSoft, theme.colors.surface],
  );

  const canClear = !rest.readOnly && !secureTextEntry && value.length > 0;

  return (
    <View style={[{ gap: spacing.xs }, style]}>
      <Txt variant="micro" tone={error ? 'danger' : focused ? 'accent' : 'faint'} uppercase tracking={0.8}>
        {label}
      </Txt>
      <View style={box}>
        {unit ? (
          <Txt variant="body" tone="faint" style={multiline ? { marginTop: 3 } : undefined}>
            {unit}
          </Txt>
        ) : null}
        <TextInput
          ref={input}
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          editable={!disabled}
          multiline={multiline}
          secureTextEntry={secureTextEntry ? secretHidden : undefined}
          placeholderTextColor={theme.colors.textFaint}
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityState={{ disabled }}
          // RN's defaults spell-check and autocorrect on iOS, which turns
          // "Bulgarian Split Squat" into "Bulgarian Split Span" mid-typing.
          autoCorrect={rest.autoCorrect ?? false}
          // iOS only keeps the caret sane on `decimal-pad` when spellcheck and
          // suggestions are explicitly off; leaving them on inserts a hyphen for a minus.
          spellCheck={rest.spellCheck ?? false}
          autoCapitalize={rest.autoCapitalize ?? 'sentences'}
          style={{
            flex: 1,
            margin: 0,
            padding: 0,
            fontFamily: fontFamily.regular,
            fontSize: theme.fontSize.bodyLg,
            lineHeight: Math.round(theme.fontSize.bodyLg * 1.4),
            color: theme.colors.text,
            ...(multiline ? { minHeight: 68, textAlignVertical: 'top' as const } : null),
          }}
          {...rest}
        />
        {secureTextEntry ? (
          <Pressable
            onPress={() => {
              haptics.light();
              setSecretHidden((h) => !h);
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={secretHidden ? 'Show text' : 'Hide text'}
          >
            <Icon name={secretHidden ? 'eye' : 'close'} size={17} color={theme.colors.textMuted} />
          </Pressable>
        ) : canClear ? (
          <Pressable
            onPress={(e: GestureResponderEvent) => {
              e.stopPropagation?.();
              haptics.light();
              onChangeText('');
              input.current?.focus();
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label}`}
          >
            <Icon name="close" size={15} color={theme.colors.textFaint} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Row gap="xs">
          <Icon name="warning" size={13} color={theme.colors.danger} />
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

/**
 * Numeric field for weight/reps/distance. Uses `decimal-pad`, not `number-pad`:
 * `number-pad` has no `.` on iOS, which makes a 2.5 kg plate untypeable.
 */
export const NumberField = memo(function NumberField({
  allowDecimal = true,
  autoFocus = false,
  ...props
}: {
  allowDecimal?: boolean;
  autoFocus?: boolean;
} & TextFieldProps) {
  return (
    <TextField
      {...props}
      keyboardType={allowDecimal ? 'decimal-pad' : 'number-pad'}
      returnKeyType="done"
      autoComplete="off"
      autoFocus={autoFocus}
    />
  );
});

/**
 * Keyboard-avoiding wrapper for forms and sheets. See the file header for why the
 * behaviour differs by platform.
 */
export function KeyboardAvoid({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={style}>
      {children}
    </KeyboardAvoidingView>
  );
}

/**
 * Keyboard height on Android, where a bottom-pinned sheet is not always rescued by
 * `adjustResize` (a `Presentation`-style modal over a modal is not resized). Empty on
 * iOS, where `KeyboardAvoid` is the right tool and this would double the offset.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  const last = useRef(0);

  const publish = useCallback((next: number) => {
    if (last.current === next) return;
    last.current = next;
    setInset(next);
  }, []);

  React.useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => publish(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => publish(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [publish]);

  return inset;
}
