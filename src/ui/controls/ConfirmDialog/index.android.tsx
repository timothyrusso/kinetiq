import { AlertDialog, Host, Text, TextButton } from '@expo/ui/jetpack-compose';
import { StyleSheet } from 'react-native';

import { useAppTheme } from '@/theme/theme';
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
  const theme = useAppTheme();
  if (!visible) return null;
  return (
    <Host style={styles.anchor}>
      <AlertDialog onDismissRequest={onCancel}>
        <AlertDialog.Title>
          <Text>{title}</Text>
        </AlertDialog.Title>
        {message ? (
          <AlertDialog.Text>
            <Text>{message}</Text>
          </AlertDialog.Text>
        ) : null}
        <AlertDialog.ConfirmButton>
          {/* Material puts the confirming action last and colours a destructive one with
              the error role rather than making it a filled button. */}
          <TextButton
            onClick={onConfirm}
            colors={destructive ? { contentColor: theme.colors.danger } : {}}
          >
            <Text>{confirmLabel}</Text>
          </TextButton>
        </AlertDialog.ConfirmButton>
        <AlertDialog.DismissButton>
          <TextButton onClick={onCancel}>
            <Text>{cancelLabel}</Text>
          </TextButton>
        </AlertDialog.DismissButton>
      </AlertDialog>
    </Host>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', width: 0, height: 0 },
});
