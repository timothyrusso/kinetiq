/**
 * Haptics, behind a semantic API rather than raw expo-haptics calls.
 *
 * Two reasons for the indirection. The user can turn feedback off in settings,
 * and a call site that checks the flag itself will forget to somewhere. And the
 * vocabulary here, `setComplete`, `guard`: describes what happened in the
 * workout, so tuning the feel of the app means editing this file rather than
 * hunting through screens.
 *
 * The taste rule: haptics punctuate a state change the user caused (a set
 * checked, a PR landed, a destructive swipe committed) and never accompany
 * something that already makes a sound or animates. Most importantly, they do
 * not fire on scroll, on every keystroke, or on anything the system already
 * clicks: a phone that buzzes constantly is a phone that gets turned off.
 */
import {
  notificationAsync,
  NotificationFeedbackType,
  selectionAsync,
  impactAsync,
  ImpactFeedbackStyle,
} from 'expo-haptics';
import { Platform } from 'react-native';
import { useSettings } from '@/settings';

let enabled = true;

/** Called by bootstrap and by the settings toggle. */
export function setHapticsEnabled(next: boolean): void {
  enabled = next;
}

export function hapticsEnabled(): boolean {
  return enabled;
}

function fire(task: () => Promise<void>): void {
  if (!enabled || Platform.isTV) return;
  // Haptics are pure decoration: a failure (no motor, simulator, backgrounded)
  // must never surface as an error or break the interaction it accompanies.
  void task().catch(() => {});
}

export const haptics = {
  /** Lightest acknowledgment: a chip selected, a segment of a control chosen. */
  light: () => fire(() => impactAsync(ImpactFeedbackStyle.Light)),
  /** Default for pressing something that does something. */
  medium: () => fire(() => impactAsync(ImpactFeedbackStyle.Medium)),
  /** Committing something with weight: starting a workout, a long-press lift. */
  heavy: () => fire(() => impactAsync(ImpactFeedbackStyle.Heavy)),
  /** Navigating between equal options, e.g. wheel or segmented pickers. */
  selection: () => fire(selectionAsync),
  /** A set completed, a routine saved. */
  success: () => fire(() => notificationAsync(NotificationFeedbackType.Success)),
  /** A rest timer ending, a personal record landing. */
  warning: () => fire(() => notificationAsync(NotificationFeedbackType.Warning)),
  /** Refusing an action: an empty form, a discarded session. */
  error: () => fire(() => notificationAsync(NotificationFeedbackType.Error)),
};

export type Haptics = typeof haptics;

/** For onPress handlers that want the setting without importing the store twice. */
export function useHaptics(): Haptics {
  useSettings((s) => s.hapticsEnabled);
  return haptics;
}
