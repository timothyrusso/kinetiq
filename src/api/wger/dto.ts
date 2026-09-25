/**
 * Wire shapes for the wger Workout Manager API (https://wger.de/en/software/api).
 *
 * These mirror what the server actually returns, verified against live
 * responses: they are not guesses, and nothing outside `src/api` may import
 * them. Everything the rest of the app sees is mapped into `@/domain/types`.
 *
 * Verified behaviours worth knowing before editing:
 *  - `exerciseinfo` list rows hydrate `images[]` and `videos[]` *fully* (URLs,
 *    thumbnails, codecs), so a detail screen needs no second request and a list
 *    never issues an N+1 per row.
 *  - `exerciseimage` / `video` do **not** filter by `exercise_base`: the param
 *    is accepted and silently ignored (count stays at the full 374 / 78). Media
 *    can therefore only be obtained nested, which is exactly what we do, so
 *    there is deliberately no media index here.
 *  - `translations[]` carries *every* language unless `language__code` narrows
 *    it, and wger does not order them by preference. Display strings must be
 *    resolved per language with fallbacks; assuming `translations[0]` is
 *    English is wrong for most rows.
 *  - Text search is `name__search` (pg_trgm): fuzzy, relevance-ranked, and
 *    combined with `language__code` it also restricts `count`. Plain `search`,
 *    `term`, `q` and bare `name` are accepted and ignored.
 */

/** `{id, name}` pairs appear for category and equipment. */
export type WgerNamedEntity = { id: number; name: string };

export type WgerMuscle = {
  id: number;
  /** Latin anatomical name, e.g. "Biceps femoris". */
  name: string;
  /** English common name, e.g. "Hamstrings". Absent on some rows. */
  name_en?: string | null;
  is_front?: boolean;
  image_url_main?: string | null;
  image_url_secondary?: string | null;
};

export type WgerImage = {
  id: number;
  /** Base exercise id: the row belongs to the *base*, not the variation. */
  exercise: number;
  exercise_uuid?: string | null;
  image: string;
  thumbnails?: { small?: string | null; medium?: string | null } | null;
  is_main?: boolean;
  style?: string;
  is_ai_generated?: boolean;
};

type WgerVideo = {
  id: number;
  exercise: number;
  video: string;
  is_main?: boolean;
  size?: number;
  duration?: string | null;
  width?: number;
  height?: number;
  /** e.g. "hevc" / "h264": matters because HEVC will not decode on many Android devices. */
  codec?: string | null;
};

/** Author notes are objects, not strings, `{id, translation, comment}`. */
type WgerNote = { id: number; translation?: number; comment?: string | null };

export type WgerTranslation = {
  id: number;
  name: string;
  /** HTML fragment, e.g. `<p>Keep your back straight</p>\n`. */
  description?: string | null;
  /**
   * Plain-text (markdown-ish: `*emphasis*`, `* bullet`) source of
   * `description`, when the author provided one.
   */
  description_source?: string | null;
  /** Numeric language id; resolve against `/language/` to get the code. */
  language: number;
  aliases?: string[] | null;
  notes?: WgerNote[] | null;
};

export type WgerExerciseInfo = {
  id: number;
  uuid: string;
  category?: WgerNamedEntity | null;
  muscles?: WgerMuscle[] | null;
  muscles_secondary?: WgerMuscle[] | null;
  equipment?: WgerNamedEntity[] | null;
  images?: WgerImage[] | null;
  videos?: WgerVideo[] | null;
  translations?: WgerTranslation[] | null;
  /** UUID of the variation family, or null when the exercise has no variations. */
  variation_group?: string | null;
  last_update?: string;
  last_update_global?: string;
};

export type WgerListResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type WgerLanguage = {
  id: number;
  short_name: string;
  full_name: string;
  full_name_en?: string;
};

/** Bare `{results}`: taxonomy endpoints paginate, but all fit in one page. */
export type WgerTaxonomyResponse = WgerListResponse<WgerNamedEntity>;

export type WgerMuscleResponse = WgerListResponse<WgerMuscle>;
export type WgerLanguageResponse = WgerListResponse<WgerLanguage>;
