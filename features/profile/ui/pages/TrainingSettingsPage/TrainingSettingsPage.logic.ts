import { useCallback, useMemo } from 'react';
import type { SettingsSection } from '@/features/core/design-system';
import { useT } from '@/features/core/translations';
import { useSettings, useSettingsUpdate } from '@/features/settings';

/** The same bounds the store clamps to, so the UI never offers a value the store would rewrite. */
const REST_MIN = 15;
const REST_MAX = 600;
const GOAL_MIN = 1;
const GOAL_MAX = 14;

/**
 * Training preferences: the settings that decide what the app does during a session. No Save
 * button anywhere: each control commits the moment it changes, and the store debounces its write,
 * which is safe because no control here accepts partial input. Rest time gets both presets and a
 * stepper: "75 seconds" is a real choice, and a preset list is not allowed to be the only legal
 * set of answers.
 */
export function useTrainingSettingsPageLogic() {
  const { t } = useT();
  const update = useSettingsUpdate();

  const rest = useSettings(settings => settings.defaultRestSeconds);
  const autoStartRest = useSettings(settings => settings.autoStartRest);
  const hapticsEnabled = useSettings(settings => settings.hapticsEnabled);
  const restCountdown = useSettings(settings => settings.restCountdownHaptics);
  const keepScreenAwake = useSettings(settings => settings.keepScreenAwake);
  const goal = useSettings(settings => settings.weeklyGoalWorkouts);

  const setRest = useCallback((seconds: number) => update({ defaultRestSeconds: seconds }), [update]);

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
            format: v => `${v} s`,
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
            onChange: next => update({ autoStartRest: next }),
          },
          {
            // NOTE: haptics live with the session behaviour they fire during: every haptic in this
            // app is a set completed, a rest that ended, or a record beaten.
            kind: 'switch',
            key: 'haptics',
            title: t('trainingPrefs.haptics'),
            subtitle: t('settingsExtra.hapticsHint'),
            value: hapticsEnabled,
            onChange: next => update({ hapticsEnabled: next }),
          },
          {
            // NOTE: its own switch, the one haptic someone could like everything else about and
            // still find too much. Off with the master switch, and shown so.
            kind: 'switch',
            key: 'restCountdown',
            title: t('trainingPrefs.restCountdown'),
            subtitle: t('trainingPrefs.restCountdownHint'),
            value: hapticsEnabled && restCountdown,
            disabled: !hapticsEnabled,
            onChange: next => update({ restCountdownHaptics: next }),
          },
          {
            kind: 'switch',
            key: 'keepAwake',
            title: t('trainingPrefs.keepScreenAwake'),
            subtitle: t('trainingPrefs.keepScreenAwakeHint'),
            value: keepScreenAwake,
            onChange: next => update({ keepScreenAwake: next }),
          },
        ],
      },
      {
        key: 'goal',
        title: t('trainingPrefs.weeklyGoal'),
        footer: t('misc.goalBody'),
        rows: [
          {
            kind: 'stepper',
            key: 'goal',
            title: t('trainingPrefs.sessionsPerWeek'),
            value: goal,
            min: GOAL_MIN,
            max: GOAL_MAX,
            step: 1,
            format: v => `${v}×`,
            onChange: next => update({ weeklyGoalWorkouts: next }),
          },
        ],
      },
    ],
    [autoStartRest, goal, hapticsEnabled, keepScreenAwake, rest, restCountdown, setRest, t, update],
  );

  return { derived: { title: t('trainingPrefs.title'), sections } };
}
