/**
 * Settings: the profile editor, and the way into the three sections too big to sit inline.
 *
 * ## What is deliberately *not* here
 *
 * Units and appearance. Both are one control, and both already live on the Profile tab,
 * whose header makes the case: changing units is something you do while looking at a number
 * that is currently in the wrong ones, so the control belongs next to the numbers it
 * changes. Repeating it here would put two switches in charge of one setting, and a hub that
 * duplicates a tab is a hub that eventually disagrees with it.
 *
 * The weekly goal is on Profile for the same reason: it is a target you look at, not a
 * preference you set and forget.
 *
 * ## Why the profile fields are on this screen and not on the tab
 *
 * The tab *shows* the name, height and age; nothing there edits them. Editing needs a form:
 * three fields, validation, a keyboard, and a Save that can fail. Putting that on the tab
 * would mean the tab owns both a display and a form for the same three values, and the form
 * half would need to be dismissed. Here the values load once into local draft state, the
 * user can put the form in any broken state they like, and nothing reaches the store until
 * Save: so a half-typed height can never render as someone's height.
 *
 * ## Draft state, and why Save exists at all
 *
 * Every other setting in the app commits on change, because every other setting is a toggle
 * or a segmented control: there is no such thing as a half-toggled switch. Text fields are
 * different. An empty name is not a name the user chose, and committing per keystroke means
 * the app briefly believes their name is `""`: which `normaliseSettings` would then quietly
 * rewrite to "Athlete" on the next reload. So text fields are a draft, and Save is the
 * commit point. Numbers use the same rule, for the same reason: `heightCm` of `1` is a valid
 * keystroke on the way to `181`.
 *
 * ## Save is a diff, not a patch
 *
 * `normaliseSettings` rebuilds `profile` on every write, and the store preserves object
 * identity only when the value is unchanged. Sending all three fields every time would
 * therefore notify every `useSettings(s => s.profile)` reader: the tab's avatar, height
 * line and age: when only the height moved. The store already handles that correctly
 * (identity is preserved when the values match), so this could send all three and be fine.
 * It sends a diff anyway, for one concrete reason: the empty-name case. An untouched name
 * field must not send `name: ''`, because normalise would turn that into "Athlete": which
 * is right for a genuine empty submission and wrong for a field the user never opened.
 */
import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';

import { ScreenHeader } from '@/ui/Screen';
import { SettingsList, type SettingsSection } from '@/ui/controls/SettingsList';
import { useAllSettings, useSettingsUpdate } from '@/settings';
import type { Profile, SettingsState } from '@/settings';
import { routes } from '@/navigation/nav';
import { haptics } from '@/services/haptics';
import { useT } from '@/i18n/useT';
import { tr } from '@/i18n/tr';
import { parseNumber } from '@/utils/format';

const HEIGHT_MIN = 100;
const HEIGHT_MAX = 230;
/** A birth year this far back is a typo, not a memory. Matches the store's own clamp. */
const BIRTH_YEAR_MIN = 1930;

export default function SettingsScreen() {
  const { t } = useT();
  const router = useRouter();
  const settings = useAllSettings();
  const update = useSettingsUpdate();
  const profile = settings.profile;
  const [draft, setDraft] = useState<Draft>(() => draftOf(profile));

  const errors = useMemo(() => validate(draft), [draft]);
  const dirty =
    draft.name !== profile.name ||
    draft.heightCm !== `${profile.heightCm}` ||
    draft.birthYear !== `${profile.birthYear}`;

  const set = useCallback(
    (field: keyof Draft) => (next: string) => setDraft((prev) => ({ ...prev, [field]: next })),
    [],
  );

  const save = useCallback(() => {
    if (errors) return;
    // Only the fields that actually moved: a blank, untouched name must not be submitted as
    // '', which the store would read as "reset to Athlete".
    const patch: Partial<Profile> = {};
    if (draft.name.trim() !== profile.name) patch.name = draft.name.trim();
    if (draft.heightCm !== `${profile.heightCm}`) patch.heightCm = parseNumber(draft.heightCm) ?? profile.heightCm;
    if (draft.birthYear !== `${profile.birthYear}`)
      patch.birthYear = parseNumber(draft.birthYear) ?? profile.birthYear;
    update({ profile: { ...profile, ...patch } });
    haptics.success();
  }, [draft, errors, profile, update]);

  const sections = useMemo<SettingsSection[]>(
    () => [
      {
        key: 'you',
        title: t('settings.you'),
        footer: dirty ? t('settingsScreen.unsaved') : t('settings.usedForEstimates'),
        rows: [
          {
            kind: 'field',
            key: 'name',
            title: t('settings.name'),
            value: draft.name,
            onChangeText: set('name'),
            placeholder: t('settingsScreen.namePlaceholder'),
            maxLength: 40,
            error: errors?.name ?? null,
          },
          {
            kind: 'field',
            key: 'height',
            title: t('settings.height'),
            value: draft.heightCm,
            onChangeText: set('heightCm'),
            numeric: true,
            unit: 'cm',
            maxLength: 3,
            error: errors?.heightCm ?? null,
          },
          {
            kind: 'field',
            key: 'birthYear',
            title: t('settings.birthYear'),
            value: draft.birthYear,
            onChangeText: set('birthYear'),
            numeric: true,
            maxLength: 4,
            error: errors?.birthYear ?? null,
          },
          { kind: 'button', key: 'save', title: t('common.save'), disabled: !dirty || errors !== null, onPress: save },
        ],
      },
      {
        key: 'app',
        title: t('settings.app'),
        footer: t('misc.settingsFootnote'),
        rows: [
          {
            kind: 'nav',
            key: 'training',
            title: t('settings.trainingPreferences'),
            subtitle: t('settings.trainingSubtitle'),
            onPress: () => router.push(routes.settingsTraining()),
          },
          {
            kind: 'nav',
            key: 'notifications',
            title: t('settings.notifications'),
            subtitle: notificationSummary(settings),
            onPress: () => router.push(routes.settingsNotifications()),
          },
          {
            kind: 'nav',
            key: 'permissions',
            title: t('settings.permissions'),
            subtitle: t('settings.permissionsSubtitle'),
            onPress: () => router.push(routes.permissions()),
          },
          {
            kind: 'nav',
            key: 'about',
            title: t('profileScreen.aboutTitle'),
            subtitle: t('profileScreen.aboutSubtitle'),
            onPress: () => router.push(routes.settingsAbout()),
          },
        ],
      },
    ],
    [dirty, draft, errors, router, save, set, settings, t],
  );

  return (
    <>
      <ScreenHeader title={t('settings.title')} largeTitle />
      <SettingsList sections={sections} />
    </>
  );
}

/* ------------------------------------------------------------- profile form -- */

type Draft = { name: string; heightCm: string; birthYear: string };

function draftOf(profile: Profile): Draft {
  return {
    name: profile.name,
    heightCm: `${profile.heightCm}`,
    birthYear: `${profile.birthYear}`,
  };
}

/**
 * Field-by-field validation, returning the first problem per field.
 *
 * Deliberately not "disable Save silently": a disabled button with no reason next to it
 * sends someone hunting through fields that are all fine. The empty-name case is the common
 * one, and it is also the case where an error message would be noise: an empty name simply
 * means "not changed", so Save is disabled and nothing is red.
 */
function validate(draft: Draft): Partial<Record<keyof Draft, string>> | null {
  const errors: Partial<Record<keyof Draft, string>> = {};

  const height = parseNumber(draft.heightCm);
  if (draft.heightCm.trim() === '') {
    errors.heightCm = tr('settingsScreen.heightRequired');
  } else if (height === null) {
    errors.heightCm = tr('settingsScreen.numbersOnly');
  } else if (height < HEIGHT_MIN || height > HEIGHT_MAX) {
    errors.heightCm = tr('settingsScreen.heightRange', { min: HEIGHT_MIN, max: HEIGHT_MAX });
  }

  const year = parseNumber(draft.birthYear);
  const thisYear = new Date().getFullYear();
  if (draft.birthYear.trim() === '') {
    errors.birthYear = tr('settingsScreen.birthYearRequired');
  } else if (year === null) {
    errors.birthYear = tr('settingsScreen.birthYearDigits');
  } else if (year < BIRTH_YEAR_MIN || year > thisYear) {
    errors.birthYear = tr('settingsScreen.birthYearRange', {
      min: BIRTH_YEAR_MIN,
      max: thisYear,
    });
  }

  if (draft.name.trim().length > 0 && draft.name.trim().length < 2) {
    errors.name = tr('settingsScreen.nameTooShort');
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

/* ----------------------------------------------------------------- helpers -- */

/**
 * One line that tells you what you will actually get, in the order the reasons matter.
 *
 * The system question comes before the schedule, because it is the one that makes everything
 * below it a lie: a reminder configured for Monday, Wednesday and Friday that the OS will
 * never deliver is worth saying out loud rather than describing.
 */
function notificationSummary(settings: SettingsState): string {
  if (!settings.notificationsEnabled) return tr('settingsScreen.notificationsOff');
  if (!settings.notificationsGranted) return tr('settingsScreen.notificationsBlocked');
  if (!settings.reminder.enabled) return tr('settingsScreen.restTimerOnly');
  return tr('settingsScreen.restTimerPlusDays', {
    count: settings.reminder.days.length,
    word: tr('settingsScreen.dayWord', { count: settings.reminder.days.length }),
  });
}
