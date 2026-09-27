import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Keyboard-avoiding wrapper for forms. iOS pads; Android's window already resizes for the
 * keyboard (`adjustResize`), and padding there too would lift the form twice.
 */
export function KeyboardAvoid({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={style}>
      {children}
    </KeyboardAvoidingView>
  );
}
