import { useRef } from 'react';
import { Alert, Button, Host, Text } from '@expo/ui/swift-ui';
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
        <Alert.Actions>
          <Button role="cancel" label={cancelLabel} onPress={answer(onCancel)} />
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
