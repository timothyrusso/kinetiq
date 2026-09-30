/** The operating system's answer about notifications: set in another app, revocable at any time. */
export interface NotificationPermission {
  readonly granted: boolean;
  /**
   * The system would still show its prompt: never answered, and not settled in the system
   * settings. Once it has answered, a request only reads the answer back.
   */
  readonly canAsk: boolean;
}
