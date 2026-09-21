/**
 * Settings — the profile editor, and the way into the three sections too big to sit inline.
 *
 * ## What is deliberately *not* here
 *
 * Units and appearance. Both are one control, and both already live on the Profile tab,
 * whose header makes the case: changing units is something you do while looking at a number
 * that is currently in the wrong ones, so the control belongs next to the numbers it
 * changes. Repeating it here would put two switches in charge of one setting, and a hub that
 * duplicates a tab is a hub that eventually disagrees with it.
 *
 * The weekly goal is on Profile for the same reason — it is a target you look at, not a
 * preference you set and forget.
 *
 * ## Why the profile fields are on this screen and not on the tab
 *
 * The tab *shows* the name, height and age; nothing there edits them. Editing needs a form:
 * three fields, validation, a keyboard, and a Save that can fail. Putting that on the tab
 * would mean the tab owns both a display and a form for the same three values, and the form
 * half would need to be dismissed. Here the values load once into local draft state, the
 * user can put the form in any broken state they like, and nothing reaches the store until
 * Save — so a half-typed height can never render as someone's height.
 *
 * ## Draft state, and why Save exists at all
 *
 * Every other setting in the app commits on change, because every other setting is a toggle
 * or a segmented control: there is no such thing as a half-toggled switch. Text fields are
 * different. An empty name is not a name the user chose, and committing per keystroke means
 * the app briefly believes their name is `""` — which `normaliseSettings` would then quietly
 * rewrite to "Athlete" on the next reload. So text fields are a draft, and Save is the
 * commit point. Numbers use the same rule, for the same reason: `heightCm` of `1` is a valid
 * keystroke on the way to `181`.
 *
 * ## Save is a diff, not a patch
 *
 * `normaliseSettings` rebuilds `profile` on every write, and the store preserves object
 * identity only when the value is unchanged. Sending all three fields every time would
 * therefore notify every `useSettings(s => s.profile)` reader — the tab's avatar, height
 * line and age — when only the height moved. The store already handles that correctly
 * (identity is preserved when the values match), so this could send all three and be fine.
 * It sends a diff anyway, for one concrete reason: the empty-name case. An untouched name
 * field must not send `name: ''`, because normalise would turn that into "Athlete" — which
 * is right for a genuine empty submission and wrong for a field the user never opened.
 */
import { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useScreenContentBottom } from '@/ui/insets';

import { DetailScreen } from '@/ui/Screen';
import { NavRow } from '@/ui/rows';
import { Card, Divider, SectionHeader, Stack } from '@/ui/layout';
import { Button } from '@/ui/Button';
import { TextField } from '@/ui/TextField';
import { Txt } from '@/ui/Text';
import { useAllSettings, useSettingsUpdate } from '@/settings';
import type { Profile, SettingsState } from '@/settings';
import { routes } from '@/navigation/nav';
import { useAppTheme } from '@/theme/theme';
import { spacing } from '@/theme/tokens';
import { haptics } from '@/services/haptics';
import {
  countNoun,
  parseNumber,
} from '@/utils/format';

const HEIGHT_MIN = 100;
const HEIGHT_MAX = 230;
/** A birth year this far back is a typo, not a memory. Matches the store's own clamp. */
const BIRTH_YEAR_MIN = 1930;

export default function SettingsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const bottomSpace = useScreenContentBottom();

  const settings = useAllSettings();
  const update = useSettingsUpdate();

  return (
    <DetailScreen title="Settings">
      {(topInset) => (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: topInset + spacing.md, paddingBottom: bottomSpace },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Stack gap="xxl" style={styles.body}>
            <View>
              <SectionHeader title="You" eyebrow="Used for estimates" />
              <ProfileForm
                profile={settings.profile}
                onSave={(patch) => {
                  update({ profile: { ...settings.profile, ...patch } });
                  haptics.success();
                }}
              />
            </View>

            <View>
              <SectionHeader title="App" />
              <Card padding="xxs">
                <NavRow
                  title="Training preferences"
                  subtitle="Default rest, auto-start, speed vs. pace"
                  theme={theme}
                  icon="target"
                  topDivider={false}
                  onPress={() => router.push(routes.settingsTraining())}
                />
                <NavRow
                  title="Notifications"
                  subtitle={notificationSummary(settings)}
                  theme={theme}
                  icon="bell"
                  onPress={() => router.push(routes.settingsNotifications())}
                />
                <NavRow
                  title="Permissions"
                  subtitle="Location, notifications, motion"
                  theme={theme}
                  icon="lock"
                  onPress={() => router.push(routes.permissions())}
                />
                <NavRow
                  title="About Kinetiq"
                  subtitle="Version, data, the exercise catalog"
                  theme={theme}
                  icon="info"
                  onPress={() => router.push(routes.settingsAbout())}
                />
              </Card>
            </View>

            <Txt variant="micro" tone="faint" align="center">
              Units, appearance and your weekly goal are on the Profile tab, next to the
              numbers they change.
            </Txt>

            <View>
              <Divider inset={spacing.sm} />
            </View>
          </Stack>
        </ScrollView>
      )}
    </DetailScreen>
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
 * The three fields, as one unit with one Save.
 *
 * `key` is not needed to reset it: the store's profile is only ever changed by this form, so
 * after a successful save the draft already matches what the user typed. Leaving the screen
 * mid-edit and coming back re-mounts it from the store, which is the correct behaviour — a
 * discard you never confirmed is still a discard, so the draft is not kept anywhere.
 */
function ProfileForm({
  profile,
  onSave,
}: {
  profile: Profile;
  onSave: (patch: Partial<Profile>) => void;
}) {
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
    // Only the fields that actually moved. See the module header: a blank, untouched name
    // must not be submitted as `''`, which the store would read as "reset to Athlete".
    const patch: Partial<Profile> = {};
    if (draft.name.trim() !== profile.name) patch.name = draft.name.trim();
    if (draft.heightCm !== `${profile.heightCm}`) patch.heightCm = parseNumber(draft.heightCm) ?? profile.heightCm;
    if (draft.birthYear !== `${profile.birthYear}`)
      patch.birthYear = parseNumber(draft.birthYear) ?? profile.birthYear;
    onSave(patch);
  }, [draft, errors, onSave, profile]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack gap="lg">
        <TextField
          label="Name"
          value={draft.name}
          onChangeText={set('name')}
          placeholder="Athlete"
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          error={errors?.name ?? null}
          hint="Shown on your Profile tab and in your history."
          maxLength={40}
        />
        <TextField
          label="Height"
          value={draft.heightCm}
          onChangeText={set('heightCm')}
          keyboardType="number-pad"
          unit="cm"
          returnKeyType="done"
          error={errors?.heightCm ?? null}
          hint={`Between ${HEIGHT_MIN} and ${HEIGHT_MAX} cm. Used for stride and calorie estimates.`}
          maxLength={3}
        />
        <TextField
          label="Birth year"
          value={draft.birthYear}
          onChangeText={set('birthYear')}
          keyboardType="number-pad"
          returnKeyType="done"
          error={errors?.birthYear ?? null}
          hint="Used for calorie estimates only. Stored as a year, not a date."
          maxLength={4}
        />

        <Button
          label="Save"
          onPress={save}
          disabled={!dirty || errors !== null}
          accessibilityHint={
            dirty ? 'Stores these details on this device' : 'Nothing has changed yet'
          }
        />
        {dirty ? (
          <Txt variant="micro" tone="faint" align="center">
            Unsaved. Leaving this screen without saving discards these changes.
          </Txt>
        ) : null}
      </Stack>
    </KeyboardAvoidingView>
  );
}

/**
 * Field-by-field validation, returning the first problem per field.
 *
 * Deliberately not "disable Save silently": a disabled button with no reason next to it
 * sends someone hunting through fields that are all fine. The empty-name case is the common
 * one, and it is also the case where an error message would be noise — an empty name simply
 * means "not changed", so Save is disabled and nothing is red.
 */
function validate(draft: Draft): Partial<Record<keyof Draft, string>> | null {
  const errors: Partial<Record<keyof Draft, string>> = {};

  const height = parseNumber(draft.heightCm);
  if (draft.heightCm.trim() === '') {
    errors.heightCm = 'Height is needed for calorie estimates.';
  } else if (height === null) {
    errors.heightCm = 'Numbers only.';
  } else if (height < HEIGHT_MIN || height > HEIGHT_MAX) {
    errors.heightCm = `Must be between ${HEIGHT_MIN} and ${HEIGHT_MAX} cm.`;
  }

  const year = parseNumber(draft.birthYear);
  const thisYear = new Date().getFullYear();
  if (draft.birthYear.trim() === '') {
    errors.birthYear = 'Birth year is needed for calorie estimates.';
  } else if (year === null) {
    errors.birthYear = 'Four digits, like 1994.';
  } else if (year < BIRTH_YEAR_MIN || year > thisYear) {
    errors.birthYear = `Must be between ${BIRTH_YEAR_MIN} and ${thisYear}.`;
  }

  if (draft.name.trim().length > 0 && draft.name.trim().length < 2) {
    errors.name = 'A name needs at least two characters.';
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
  if (!settings.notificationsEnabled) return 'All notifications off';
  if (!settings.notificationsGranted) return 'Blocked in iOS settings';
  if (!settings.reminder.enabled) return 'Rest timer only';
  return `Rest timer · ${countNoun(settings.reminder.days.length, 'day')} a week`;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  body: { paddingHorizontal: spacing.xl },
});
