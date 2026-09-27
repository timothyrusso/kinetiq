import { parseNumber } from '@/features/core/utils';

/** The editor's fields as typed: text, until Save commits them. */
export interface ProfileDraft {
  readonly name: string;
  readonly heightCm: string;
  readonly birthYear: string;
}

export const HEIGHT_MIN = 100;
export const HEIGHT_MAX = 230;
/** A birth year this far back is a typo, not a memory. Matches the store's own clamp. */
export const BIRTH_YEAR_MIN = 1930;

/** Why a field cannot be saved. */
export type ProfileDraftProblem =
  | 'heightRequired'
  | 'heightNotNumber'
  | 'heightRange'
  | 'birthYearRequired'
  | 'birthYearNotNumber'
  | 'birthYearRange'
  | 'nameTooShort';

export type ProfileDraftErrors = Partial<Record<keyof ProfileDraft, ProfileDraftProblem>>;

/** The first problem per field, or `null` when the draft can be saved in `thisYear`. */
export function validateProfileDraft(draft: ProfileDraft, thisYear: number): ProfileDraftErrors | null {
  const errors: { -readonly [K in keyof ProfileDraft]?: ProfileDraftProblem } = {};

  const height = parseNumber(draft.heightCm);
  if (draft.heightCm.trim() === '') errors.heightCm = 'heightRequired';
  else if (height === null) errors.heightCm = 'heightNotNumber';
  else if (height < HEIGHT_MIN || height > HEIGHT_MAX) errors.heightCm = 'heightRange';

  const year = parseNumber(draft.birthYear);
  if (draft.birthYear.trim() === '') errors.birthYear = 'birthYearRequired';
  else if (year === null) errors.birthYear = 'birthYearNotNumber';
  else if (year < BIRTH_YEAR_MIN || year > thisYear) errors.birthYear = 'birthYearRange';

  const name = draft.name.trim();
  if (name.length > 0 && name.length < 2) errors.name = 'nameTooShort';

  return Object.keys(errors).length > 0 ? errors : null;
}
