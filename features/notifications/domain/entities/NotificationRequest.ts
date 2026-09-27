/** What a notification says. */
interface NotificationContent {
  readonly title: string;
  readonly body: string;
  /** The app icon badge count, when the notification should set one. */
  readonly badge?: number;
}

/** When a notification fires: after a delay, at a moment, or now (`null`). */
export type NotificationTrigger =
  | { readonly kind: 'afterSeconds'; readonly seconds: number }
  | { readonly kind: 'at'; readonly date: Date }
  | null;

/** A notification to schedule. */
export interface NotificationRequest {
  readonly content: NotificationContent;
  readonly trigger: NotificationTrigger;
}
