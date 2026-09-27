import { useCallback, useMemo, useState } from 'react';
import { closeSheet } from '@/features/core/design-system';
import { haptics } from '@/features/core/haptics';
import { type TKey, useT } from '@/features/core/translations';
import { parseNumber } from '@/features/core/utils';
import {
  BIRTH_YEAR_MIN,
  HEIGHT_MAX,
  HEIGHT_MIN,
  type ProfileDraft,
  type ProfileDraftProblem,
  validateProfileDraft,
} from '@/features/profile/domain/utils/profileDraft';
import { type Profile, useSettings, useSettingsUpdate } from '@/features/settings';

const PROBLEM_KEYS: Record<ProfileDraftProblem, TKey> = {
  heightRequired: 'settingsScreen.heightRequired',
  heightNotNumber: 'settingsScreen.numbersOnly',
  heightRange: 'settingsScreen.heightRange',
  birthYearRequired: 'settingsScreen.birthYearRequired',
  birthYearNotNumber: 'settingsScreen.birthYearDigits',
  birthYearRange: 'settingsScreen.birthYearRange',
  nameTooShort: 'settingsScreen.nameTooShort',
};

const draftOf = (profile: Profile): ProfileDraft => ({
  name: profile.name,
  heightCm: `${profile.heightCm}`,
  birthYear: `${profile.birthYear}`,
});

/**
 * The profile editor. Every other setting commits on change, because every other setting is a
 * toggle, a stepper or a segmented control. Text fields are different: an empty name is not a
 * name the user chose, and `heightCm` of `1` is a valid keystroke on the way to `181`. So the
 * fields are a draft and Save is the commit point, and Save writes only the fields that moved:
 * an untouched name must not send `name: ''`, which the store would read as a reset. Save is
 * refused inline, field by field, after the first attempt; the sheet closes once the values are
 * in the store.
 */
export function useEditProfilePageLogic() {
  const { t } = useT();
  const profile = useSettings(settings => settings.profile);
  const update = useSettingsUpdate();
  const [draft, setDraft] = useState<ProfileDraft>(() => draftOf(profile));
  const [attempted, setAttempted] = useState(false);

  const thisYear = new Date().getFullYear();
  const problems = useMemo(() => validateProfileDraft(draft, thisYear), [draft, thisYear]);
  const errors = useMemo(() => {
    if (!attempted || problems === null) return { name: null, heightCm: null, birthYear: null };
    const message = (problem: ProfileDraftProblem | undefined) =>
      problem === undefined
        ? null
        : t(PROBLEM_KEYS[problem], {
            min: problem === 'heightRange' ? HEIGHT_MIN : BIRTH_YEAR_MIN,
            max: problem === 'heightRange' ? HEIGHT_MAX : thisYear,
          });
    return {
      name: message(problems.name),
      heightCm: message(problems.heightCm),
      birthYear: message(problems.birthYear),
    };
  }, [attempted, problems, t, thisYear]);

  const setName = useCallback((name: string) => setDraft(prev => ({ ...prev, name })), []);
  const setHeight = useCallback((heightCm: string) => setDraft(prev => ({ ...prev, heightCm })), []);
  const setBirthYear = useCallback((birthYear: string) => setDraft(prev => ({ ...prev, birthYear })), []);

  const save = useCallback(() => {
    if (problems) {
      setAttempted(true);
      haptics.warning();
      return;
    }
    const patch: { -readonly [K in keyof Profile]?: Profile[K] } = {};
    if (draft.name.trim() !== profile.name) patch.name = draft.name.trim();
    if (draft.heightCm !== `${profile.heightCm}`) patch.heightCm = parseNumber(draft.heightCm) ?? profile.heightCm;
    if (draft.birthYear !== `${profile.birthYear}`) patch.birthYear = parseNumber(draft.birthYear) ?? profile.birthYear;
    if (Object.keys(patch).length > 0) update({ profile: { ...profile, ...patch } });
    haptics.success();
    closeSheet();
  }, [draft, problems, profile, update]);

  return { state: { draft }, derived: { errors }, effects: { setName, setHeight, setBirthYear, save } };
}
