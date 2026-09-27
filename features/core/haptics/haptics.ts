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
 * from the preferences store (mirrored from settings) on every call rather than copied into a flag at launch: the copy is what made
 * the switch do nothing until the next start.
 */
import { Platform } from 'react-native';
import { Presets } from 'react-native-pulsar';

import type { HapticVocabulary } from '@/features/core/haptics/domain/entities/HapticPattern';
import { useHapticsPreferencesStore } from '@/features/core/haptics/state/hapticsPreferencesStore';

function fire(play: () => void): void {
  if (!useHapticsPreferencesStore.getState().enabled || Platform.isTV) return;
  // NOTE: Haptics are pure decoration: a failure (no motor, simulator, backgrounded)
  // must never surface as an error or break the interaction it accompanies.
  try {
    play();
  } catch {
    // NOTE: Nothing to do.
  }
}

/** Every pattern of the vocabulary, honouring the user's switches at the moment it fires. */
export const haptics: HapticVocabulary = {
  light: () => fire(Presets.System.impactLight),
  medium: () => fire(Presets.System.impactMedium),
  heavy: () => fire(Presets.System.impactHeavy),
  selection: () => fire(Presets.System.selection),
  success: () => fire(Presets.System.notificationSuccess),
  warning: () => fire(Presets.System.notificationWarning),
  error: () => fire(Presets.System.notificationError),

  setCompleted: () => fire(Presets.latch),
  restTick: () => {
    if (useHapticsPreferencesStore.getState().restCountdown) fire(Presets.pip);
  },
  restOver: () => {
    if (useHapticsPreferencesStore.getState().restCountdown) fire(Presets.surge);
  },
  personalRecord: () => fire(Presets.triumph),
  workoutFinished: () => fire(Presets.finale),
  weeklyGoalReached: () => fire(Presets.fanfare),
};

/** For onPress handlers that want the setting without importing the store twice. */
export function useHaptics(): HapticVocabulary {
  useHapticsPreferencesStore.use.enabled();
  return haptics;
}
