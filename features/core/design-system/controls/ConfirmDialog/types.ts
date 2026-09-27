/**
 * A yes/no question the platform asks: an alert on iOS, a Material dialog on Android.
 *
 * Controlled: the screen owns `visible` and hears exactly one answer per presentation,
 * `onConfirm` or `onCancel`. A system dismissal (a tap outside on Android) arrives as
 * `onCancel`, so there is no third way out to handle. The platform closes the dialog on any
 * button, so the screen sets `visible` false in either handler; an action that can fail
 * reports it by presenting the dialog again with the reason as its `message`.
 *
 * Without a `cancelLabel` it is a notice: one button, `onConfirm`, for news the user can only
 * acknowledge.
 */
export type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  /** Omitted for a one-button notice. */
  cancelLabel?: string;
  /** Red on iOS, and ordered and coloured the Material way on Android. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};
