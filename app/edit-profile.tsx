/**
 * The profile editor, as a form sheet opened by tapping the name on the Profile tab.
 *
 * ## Draft state, and why Save exists at all
 *
 * Every other setting in the app commits on change, because every other setting is a toggle,
 * a stepper or a segmented control: there is no such thing as a half-toggled switch. Text
 * fields are different. An empty name is not a name the user chose, and committing per
 * keystroke means the app briefly believes their name is `""`. So the fields are a draft,
 * and Save is the commit point. Numbers use the same rule, for the same reason: `heightCm` of
 * `1` is a valid keystroke on the way to `181`.
 *
 * ## Save is a diff, not a patch
 *
 * Only the fields that moved are written. An untouched name field must not send `name: ''`,
 * which the store would read as a reset.
 *
 * ## Errors say why
 *
 * Save is refused inline, field by field, rather than by a disabled button that does not say
 * what is wrong. The sheet closes only once the values are in the store.
 */
import { useCallback, useMemo, useState } from 'react';

import { useT } from '@/i18n/useT';
import { tr } from '@/i18n/tr';
import { useSettings, useSettingsUpdate } from '@/settings';
import type { Profile } from '@/settings';
import { haptics } from '@/services/haptics';
import { FormSheet, closeSheet } from '@/ui/FormSheet';
import { Txt } from '@/ui/Text';
import { TextInput } from '@/ui/controls/TextInput';
import { parseNumber } from '@/utils/format';

const HEIGHT_MIN = 100;
const HEIGHT_MAX = 230;
/** A birth year this far back is a typo, not a memory. Matches the store's own clamp. */
const BIRTH_YEAR_MIN = 1930;

type Draft = { name: string; heightCm: string; birthYear: string };

export default function EditProfileSheet() {
  const { t } = useT();
  const profile = useSettings((s) => s.profile);
  const update = useSettingsUpdate();
  const [draft, setDraft] = useState<Draft>(() => draftOf(profile));
  // Errors appear after the first Save attempt, not while the user is still typing.
  const [attempted, setAttempted] = useState(false);

  const errors = useMemo(() => validate(draft), [draft]);
  const shown = attempted ? errors : null;

  const set = useCallback(
    (field: keyof Draft) => (next: string) => setDraft((prev) => ({ ...prev, [field]: next })),
    [],
  );

  const save = useCallback(() => {
    if (errors) {
      setAttempted(true);
      haptics.warning();
      return;
    }
    const patch: Partial<Profile> = {};
    if (draft.name.trim() !== profile.name) patch.name = draft.name.trim();
    if (draft.heightCm !== `${profile.heightCm}`) patch.heightCm = parseNumber(draft.heightCm) ?? profile.heightCm;
    if (draft.birthYear !== `${profile.birthYear}`) {
      patch.birthYear = parseNumber(draft.birthYear) ?? profile.birthYear;
    }
    if (Object.keys(patch).length > 0) update({ profile: { ...profile, ...patch } });
    haptics.success();
    closeSheet();
  }, [draft, errors, profile, update]);

  return (
    <FormSheet title={t('settings.you')} doneLabel="common.save" onDone={save}>
      <Txt variant="caption" tone="muted">
        {t('settings.usedForEstimates')}
      </Txt>
      <TextInput
        label={t('settings.name')}
        value={draft.name}
        onChangeText={set('name')}
        placeholder={t('settingsScreen.namePlaceholder')}
        maxLength={40}
        autoCapitalize="words"
        error={shown?.name ?? null}
      />
      <TextInput
        label={t('settings.height')}
        value={draft.heightCm}
        onChangeText={set('heightCm')}
        keyboardType="number-pad"
        unit="cm"
        maxLength={3}
        error={shown?.heightCm ?? null}
      />
      <TextInput
        label={t('settings.birthYear')}
        value={draft.birthYear}
        onChangeText={set('birthYear')}
        keyboardType="number-pad"
        maxLength={4}
        returnKeyType="done"
        onSubmitEditing={save}
        error={shown?.birthYear ?? null}
      />
    </FormSheet>
  );
}

function draftOf(profile: Profile): Draft {
  return { name: profile.name, heightCm: `${profile.heightCm}`, birthYear: `${profile.birthYear}` };
}

/** The first problem per field, or `null` when the draft can be saved. */
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
    errors.birthYear = tr('settingsScreen.birthYearRange', { min: BIRTH_YEAR_MIN, max: thisYear });
  }

  if (draft.name.trim().length > 0 && draft.name.trim().length < 2) {
    errors.name = tr('settingsScreen.nameTooShort');
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
