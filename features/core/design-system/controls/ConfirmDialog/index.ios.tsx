import { Alert, Button, Host, Spacer, Text } from '@expo/ui/swift-ui';
import { accessibilityHidden, frame } from '@expo/ui/swift-ui/modifiers';
import { useRef } from 'react';
import { StyleSheet } from 'react-native';

import type { ConfirmDialogProps } from '@/features/core/design-system/controls/ConfirmDialog/types';

export type { ConfirmDialogProps } from '@/features/core/design-system/controls/ConfirmDialog/types';

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
  // NOTE: SwiftUI reports the alert closing after a button's action has run, so without this the
  // confirm would be followed by a cancel.
  const answered = useRef(false);
  const answer = (fn: () => void) => () => {
    answered.current = true;
    fn();
  };
  return (
    // NOTE: Zero-size: the alert is presented over the window, the host only anchors it.
    // The alert hangs off its trigger below: without one the native view is an EmptyView, which
    // SwiftUI never renders, so nothing is there to present from.
    <Host style={styles.anchor}>
      <Alert
        title={title}
        isPresented={visible}
        onIsPresentedChange={presented => {
          if (presented) {
            answered.current = false;
            return;
          }
          if (!answered.current) onCancel();
        }}
      >
        <Alert.Trigger>
          <Spacer modifiers={[frame({ width: 0, height: 0 }), accessibilityHidden(true)]} />
        </Alert.Trigger>
        <Alert.Actions>
          {cancelLabel !== undefined ? (
            // biome-ignore lint/a11y/useValidAriaRole: SwiftUI's button role, not an ARIA one
            <Button role="cancel" label={cancelLabel} onPress={answer(onCancel)} />
          ) : null}
          <Button role={destructive ? 'destructive' : 'default'} label={confirmLabel} onPress={answer(onConfirm)} />
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
