/** What the launch found. Diagnostics only: nothing branches on it once the app is showing. */
export interface BootstrapOutcome {
  /** The theme the launch chrome was painted with, which the native splash was showing. */
  readonly launchTheme: 'light' | 'dark';
  /** A workout was open when the process died and has come back paused. */
  readonly resumedWorkout: boolean;
  readonly fromVersion: number;
  readonly toVersion: number;
}
