import { useRef } from 'react';
import { Alert, Button, Host, Spacer, Text } from '@expo/ui/swift-ui';
import { accessibilityHidden, frame } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet } from 'react-native';

import type { ConfirmDialogProps } from './types';

export type { ConfirmDialogProps } from './types';

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // SwiftUI reports the alert closing after a button's action has run, so without this the
  // confirm would be followed by a cancel.
  const answered = useRef(false);
  const answer = (fn: () => void) => () => {
    answered.current = true;
    fn();
  };
  return (
    // Zero-size: the alert is presented over the window, the host only anchors it.
    <Host style={styles.anchor}>
      <Alert
        title={title}
        isPresented={visible}
        onIsPresentedChange={(presented) => {
          if (presented) {
            answered.current = false;
            return;
          }
          if (!answered.current) onCancel();
        }}
      >
        {/* The alert hangs off its trigger. Without one the native view is an EmptyView,
            which SwiftUI never renders, so nothing is there to present from. */}
        <Alert.Trigger>
          <Spacer modifiers={[frame({ width: 0, height: 0 }), accessibilityHidden(true)]} />
        </Alert.Trigger>
        <Alert.Actions>
          {cancelLabel !== undefined ? (
            <Button role="cancel" label={cancelLabel} onPress={answer(onCancel)} />
          ) : null}
          <Button
            role={destructive ? 'destructive' : 'default'}
            label={confirmLabel}
            onPress={answer(onConfirm)}
          />
        </Alert.Actions>
        {message ? (
          <Alert.Message>
            <Text>{message}</Text>
          </Alert.Message>
        ) : null}
      </Alert>
    </Host>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', width: 0, height: 0 },
});
