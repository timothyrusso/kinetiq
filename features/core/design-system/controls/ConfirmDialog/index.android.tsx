import { AlertDialog, Host, Text, TextButton } from '@expo/ui/jetpack-compose';
import { StyleSheet } from 'react-native';
import type { ConfirmDialogProps } from '@/features/core/design-system/controls/ConfirmDialog/types';
import { useAppTheme } from '@/features/core/theme';

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
          <TextButton
            // NOTE: Material puts the confirming action last and colours a destructive one with
            // the error role rather than making it a filled button.
            onClick={onConfirm}
            colors={destructive ? { contentColor: theme.colors.danger } : {}}
          >
            <Text>{confirmLabel}</Text>
          </TextButton>
        </AlertDialog.ConfirmButton>
        {cancelLabel !== undefined ? (
          <AlertDialog.DismissButton>
            <TextButton onClick={onCancel}>
              <Text>{cancelLabel}</Text>
            </TextButton>
          </AlertDialog.DismissButton>
        ) : null}
      </AlertDialog>
    </Host>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', width: 0, height: 0 },
});
