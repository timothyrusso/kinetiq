/**
 * Haptics, behind a semantic API rather than raw library calls.
 *
 * Two reasons for the indirection. The user can turn feedback off in settings,
 * and a call site that checks the flag itself will forget to somewhere. And the
 * vocabulary here describes what happened in the workout, so tuning the feel of
 * the app means editing this file rather than hunting through screens.
 *
 * The taste rule: haptics punctuate a state change the user caused (a set
 * checked, a PR landed, a destructive swipe committed) and never accompany
 * something that already makes a sound or animates. Most importantly, they do
 * not fire on scroll, on every keystroke, or on anything the system already
 * clicks: a phone that buzzes constantly is a phone that gets turned off.
 *
 * ## Two registers
 *
 * The everyday vocabulary (`light` to `error`) is the platform's own feedback, played through
 * Pulsar's system presets: it should feel like every other app, because it IS the system's.
 *
 * The signature moments are Pulsar's designed presets, and there are deliberately few of them:
 * a set completed, the last seconds of a rest and its end, a personal record, a finished
 * workout, the weekly goal. They are what makes the app feel like this app, and they stay
 * special only while they are rare. Retuning one is a one-word change below.
 *
 * ## The setting is read at fire time
 *
 * Pulsar's designed patterns play even when the phone's own system haptics are off (iOS cannot
 * tell an app that setting), so the app's switch is the only off switch there is. It is read
 * from the store on every call rather than copied into a flag at launch: the copy is what made
 * the switch do nothing until the next start.
 */
import { Platform } from 'react-native';
import { Presets } from 'react-native-pulsar';

import { useSettings } from '@/settings';
import { getSettings } from '@/settings/store';

function fire(play: () => void): void {
  if (!getSettings().hapticsEnabled || Platform.isTV) return;
  // Haptics are pure decoration: a failure (no motor, simulator, backgrounded)
  // must never surface as an error or break the interaction it accompanies.
  try {
    play();
  } catch {
    // Nothing to do.
  }
}

export const haptics = {
  /** Lightest acknowledgment: a chip selected, a segment of a control chosen. */
  light: () => fire(Presets.System.impactLight),
  /** Default for pressing something that does something. */
  medium: () => fire(Presets.System.impactMedium),
  /** Committing something with weight: starting a workout, a long-press lift. */
  heavy: () => fire(Presets.System.impactHeavy),
  /** Navigating between equal options, e.g. wheel or segmented pickers. */
  selection: () => fire(Presets.System.selection),
  /** Something saved, imported or granted. */
  success: () => fire(Presets.System.notificationSuccess),
  /** Something needs attention: a failed save, a confirm about to destroy data. */
  warning: () => fire(Presets.System.notificationWarning),
  /** Refusing an action: an empty form, a discarded session. */
  error: () => fire(Presets.System.notificationError),

  /* ------------------------------------------------------- signature moments -- */

  /** A set ticked: a solid click-and-lock, the feel of a plate seating on the bar. */
  setCompleted: () => fire(Presets.latch),
  /** One of the last seconds of a rest. Small on purpose: three of these in a row. */
  restTick: () => {
    if (getSettings().restCountdownHaptics) fire(Presets.pip);
  },
  /** The rest is over: a rising push, distinct from the ticks before it. */
  restOver: () => {
    if (getSettings().restCountdownHaptics) fire(Presets.surge);
  },
  /** A personal record, when its sheet appears. */
  personalRecord: () => fire(Presets.triumph),
  /** A workout finished and saved. */
  workoutFinished: () => fire(Presets.finale),
  /** The workout that met this week's goal: replaces `workoutFinished` for that one. */
  weeklyGoalReached: () => fire(Presets.fanfare),
};

type Haptics = typeof haptics;

/** For onPress handlers that want the setting without importing the store twice. */
export function useHaptics(): Haptics {
  useSettings((s) => s.hapticsEnabled);
  return haptics;
}
