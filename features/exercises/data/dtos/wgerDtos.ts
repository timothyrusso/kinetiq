import { Schema } from 'effect';

/**
 * Wire shapes for the wger REST API (https://wger.de/en/software/api), as the catalog download
 * reads them. Only the fields the mapper uses are declared; every other field is ignored. Each is
 * as lenient as the mapper is: a field wger has sent missing or null is optional here, so a
 * response the app could always read still decodes.
 *
 * Worth knowing before editing:
 * - `exerciseinfo` rows carry `images[]` and `videos[]` in full, so there is no media request.
 * - `translations[]` carries every language when no `language__code` is sent, in no order of
 *   preference: a translation is picked by its language id, never by position.
 */

const optionalNullable = <A, I>(schema: Schema.Schema<A, I>) => Schema.optional(Schema.NullOr(schema));

const WgerRef = Schema.Struct({ id: Schema.Number });

/** A category or a piece of equipment, from its own endpoint. */
export const WgerNamedEntity = Schema.Struct({ id: Schema.Number, name: Schema.String });

export type WgerNamedEntity = typeof WgerNamedEntity.Type;

export const WgerMuscle = Schema.Struct({
  id: Schema.Number,
  // NOTE: latin anatomical name, e.g. "Biceps femoris".
  name: Schema.String,
  // NOTE: english common name, e.g. "Hamstrings". Absent on some rows.
  name_en: optionalNullable(Schema.String),
  is_front: optionalNullable(Schema.Boolean),
});

export type WgerMuscle = typeof WgerMuscle.Type;

export const WgerLanguage = Schema.Struct({ id: Schema.Number, short_name: optionalNullable(Schema.String) });

export type WgerLanguage = typeof WgerLanguage.Type;

export const WgerImage = Schema.Struct({
  image: optionalNullable(Schema.String),
  thumbnails: optionalNullable(
    Schema.Struct({ small: optionalNullable(Schema.String), medium: optionalNullable(Schema.String) }),
  ),
  is_main: optionalNullable(Schema.Boolean),
});

export type WgerImage = typeof WgerImage.Type;

export const WgerVideo = Schema.Struct({
  video: optionalNullable(Schema.String),
  is_main: optionalNullable(Schema.Boolean),
  // NOTE: e.g. "hevc" or "h264": HEVC does not decode on many Android devices.
  codec: optionalNullable(Schema.String),
});

export type WgerVideo = typeof WgerVideo.Type;

export const WgerTranslation = Schema.Struct({
  name: optionalNullable(Schema.String),
  // NOTE: an HTML fragment, e.g. `<p>Keep your back straight</p>`.
  description: optionalNullable(Schema.String),
  // NOTE: the author's plain text (markdown-ish) source of `description`, when there is one.
  description_source: optionalNullable(Schema.String),
  // NOTE: numeric language id; resolved against `language/`.
  language: Schema.Number,
  // NOTE: author notes are objects, not strings.
  notes: optionalNullable(Schema.Array(Schema.Struct({ comment: optionalNullable(Schema.String) }))),
});

export type WgerTranslation = typeof WgerTranslation.Type;

export const WgerExerciseInfo = Schema.Struct({
  id: Schema.Number,
  uuid: optionalNullable(Schema.String),
  category: optionalNullable(WgerRef),
  muscles: optionalNullable(Schema.Array(WgerRef)),
  muscles_secondary: optionalNullable(Schema.Array(WgerRef)),
  equipment: optionalNullable(Schema.Array(WgerRef)),
  images: optionalNullable(Schema.Array(WgerImage)),
  videos: optionalNullable(Schema.Array(WgerVideo)),
  translations: optionalNullable(Schema.Array(WgerTranslation)),
  // NOTE: the uuid of the variation family, or null when the exercise has none.
  variation_group: optionalNullable(Schema.String),
});

export type WgerExerciseInfo = typeof WgerExerciseInfo.Type;

/** A paginated list: `count` is the whole result's size, `results` this page. */
export const WgerList = <A, I>(item: Schema.Schema<A, I>) =>
  Schema.Struct({ count: optionalNullable(Schema.Number), results: optionalNullable(Schema.Array(item)) });
