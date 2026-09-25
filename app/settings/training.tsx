/**
 * Training preferences: the settings that decide what the app *does* during a session,
 * as opposed to what it looks like or what units it prints.
 *
 * ## Why these are not on the Profile tab
 *
 * The tab carries the settings you consult: units, appearance, the weekly goal. Those are all
 * one control and all readable at a glance. These are a group you visit once and forget, and
 * adding five rows to the tab would push the history entry and the workout preferences: the
 * things actually used daily: below the fold.
 *
 * ## No Save button, anywhere in this group
 *
 * Each control commits the moment it changes, straight into the store, which debounces its
 * write to the database. That is safe because no control here accepts partial input: a toggle,
 * a chip and a stepper can only ever be in a valid position. (The profile
 * form on the hub screen does have a Save, and its header says why text fields are the
 * exception.) The bounds passed to each stepper are the same ones `normaliseSettings` clamps
 * to, so the UI can never offer a value that the store would quietly rewrite.
 *
 * ## Presets *and* a stepper for the same number
 *
 * Rest time gets both. The chips are the four answers that cover most people and can be hit
 * with a thumb while carrying a dumbbell; the stepper exists because "75 seconds" is a real
 * choice and a preset list is not allowed to be the only legal set of answers. Selecting a
 * chip moves the stepper, and the stepper leaving a preset value deselects the chips: one
 * source of truth, two ways to reach it.
 */
import { useCallback, useMemo } from 'react';

import { ScreenHeader } from '@/ui/Screen';
import { SettingsList, type SettingsSection } from '@/ui/controls/SettingsList';
import { useSettings, useSettingsUpdate } from '@/settings';
import { useT } from '@/i18n/useT';

/** The same bounds the store clamps to: see the module header. */
const REST_MIN = 15;
const REST_MAX = 600;
const GOAL_MIN = 1;
const GOAL_MAX = 14;

export default function SettingsTrainingScreen() {
  const { t } = useT();
  const update = useSettingsUpdate();

  const rest = useSettings((s) => s.defaultRestSeconds);
  const autoStartRest = useSettings((s) => s.autoStartRest);
  const hapticsEnabled = useSettings((s) => s.hapticsEnabled);
  const goal = useSettings((s) => s.weeklyGoalWorkouts);

  const setRest = useCallback(
    (seconds: number) => update({ defaultRestSeconds: seconds }),
    [update],
  );

  const sections = useMemo<SettingsSection[]>(
    () => [
      {
        key: 'rest',
        title: t('trainingPrefs.restTimer'),
        footer: t('misc.restDefaultBody'),
        rows: [
          {
            kind: 'stepper',
            key: 'rest',
            title: t('trainingPrefs.restAfterSet'),
            subtitle: t('trainingPrefs.appliesToNew'),
            value: rest,
            min: REST_MIN,
            max: REST_MAX,
            step: 5,
            format: (v) => `${v} s`,
            onChange: setRest,
          },
        ],
      },
      {
        key: 'session',
        title: t('trainingPrefs.duringSession'),
        footer: t('misc.autoStartFootnote'),
        rows: [
          {
            kind: 'switch',
            key: 'autoStart',
            title: t('trainingPrefs.autoStartRest'),
            subtitle: autoStartRest ? t('states.autoStartOn') : t('states.autoStartOff'),
            value: autoStartRest,
            onChange: (next) => update({ autoStartRest: next }),
          },
          {
            // Haptics live with the session behaviour they fire during, because every haptic
            // in this app is a set completed, a rest that ended, or a record beaten.
            kind: 'switch',
            key: 'haptics',
            title: t('trainingPrefs.haptics'),
            subtitle: t('settingsExtra.hapticsHint'),
            value: hapticsEnabled,
            onChange: (next) => update({ hapticsEnabled: next }),
          },
        ],
      },
      {
        key: 'goal',
        title: t('trainingPrefs.weeklyGoal'),
        footer: `${t('misc.goalBody')} ${t('trainingPrefs.alsoOnProfile')}`,
        rows: [
          {
            kind: 'stepper',
            key: 'goal',
            title: t('trainingPrefs.sessionsPerWeek'),
            value: goal,
            min: GOAL_MIN,
            max: GOAL_MAX,
            step: 1,
            format: (v) => `${v}×`,
            onChange: (next) => update({ weeklyGoalWorkouts: next }),
          },
        ],
      },
    ],
    [autoStartRest, goal, hapticsEnabled, rest, setRest, t, update],
  );

  return (
    <>
      <ScreenHeader title={t('trainingPrefs.title')} largeTitle />
      <SettingsList sections={sections} />
    </>
  );
}
