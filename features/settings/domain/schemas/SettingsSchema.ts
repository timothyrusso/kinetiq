import { Either, Schema } from 'effect';
import { ACCENT_CHOICES } from '@/features/core/theme';
import { clamp } from '@/features/core/utils';

/** Any object as a record, and anything else as an empty one, so every field falls back alone. */
const AnyRecord = Schema.transform(Schema.Unknown, Schema.Record({ key: Schema.String, value: Schema.Unknown }), {
  strict: true,
  decode: input =>
    typeof input === 'object' && input !== null && !Array.isArray(input) ? (input as Record<string, unknown>) : {},
  encode: record => record,
});

/** `schema` when the input satisfies it, `fallback` when it does not. */
const orFallback = <A, I>(schema: Schema.Schema<A, I>, fallback: A) =>
  Schema.transform(Schema.Unknown, Schema.typeSchema(schema), {
    strict: true,
    decode: input => Either.getOrElse(Schema.decodeUnknownEither(schema)(input), () => fallback),
    encode: value => value,
  });

/** A stored field: absent, or not what the schema accepts, reads as `fallback`. */
const field = <A, I>(schema: Schema.Schema<A, I>, fallback: A) =>
  Schema.optionalWith(orFallback(schema, fallback), { default: () => fallback });

/**
 * A finite number rounded and clamped into `[min, max]`, or `fallback`: a corrupt stored value
 * cannot produce a 9-hour rest timer.
 */
const clampedInt = (min: number, max: number, fallback: number) =>
  Schema.optionalWith(
    Schema.transform(Schema.Unknown, Schema.Number, {
      strict: true,
      decode: input =>
        typeof input === 'number' && Number.isFinite(input) ? clamp(Math.round(input), min, max) : fallback,
      encode: value => value,
    }),
    { default: () => fallback },
  );

/** A string trimmed, with an empty or missing one read as `fallback`. */
const trimmedText = (fallback: string) =>
  Schema.optionalWith(
    Schema.transform(Schema.Unknown, Schema.String, {
      strict: true,
      decode: input => (typeof input === 'string' ? input.trim() : '') || fallback,
      encode: value => value,
    }),
    { default: () => fallback },
  );

/** ISO weekdays, 1 = Monday to 7 = Sunday, deduplicated and sorted; an empty or missing list reads as `fallback`. */
const isoDays = (fallback: readonly number[]) =>
  Schema.optionalWith(
    Schema.transform(Schema.Unknown, Schema.mutable(Schema.Array(Schema.Number)), {
      strict: true,
      decode: input =>
        Array.isArray(input) && input.length > 0
          ? [...new Set(input.filter((day): day is number => typeof day === 'number' && day >= 1 && day <= 7))].sort(
              (a, b) => a - b,
            )
          : [...fallback],
      encode: days => days,
    }),
    { default: () => [...fallback] },
  );

const DEFAULT_PROFILE = { name: '', heightCm: 178, birthYear: 1994 } as const;
const DEFAULT_REMINDER = { enabled: false, minuteOfDay: 18 * 60, days: [1, 3, 5] } as const;

/**
 * The user's profile. The name defaults to empty rather than 'Athlete': the screens that show a
 * name already fall back to a translated placeholder, and a default stored in English would print
 * "Athlete" to an Italian user as though they had typed it.
 */
const ProfileSchema = Schema.compose(
  AnyRecord,
  Schema.Struct({
    name: trimmedText(DEFAULT_PROFILE.name),
    heightCm: clampedInt(100, 230, DEFAULT_PROFILE.heightCm),
    birthYear: clampedInt(1930, 2020, DEFAULT_PROFILE.birthYear),
  }),
  { strict: false },
);

/** The weekly training reminder: `minuteOfDay` from local midnight, `days` as ISO weekdays. */
const ReminderSettingsSchema = Schema.compose(
  AnyRecord,
  Schema.Struct({
    enabled: field(Schema.Boolean, DEFAULT_REMINDER.enabled),
    minuteOfDay: clampedInt(0, 1439, DEFAULT_REMINDER.minuteOfDay),
    days: isoDays(DEFAULT_REMINDER.days),
  }),
  { strict: false },
);

/**
 * Everything the user can change, decoded from whatever was stored. Every field falls back to its
 * default on its own, so one malformed value degrades one preference instead of resetting them
 * all. Kept flat and small on purpose: it is read by render code, so a nested shape would mean a
 * new subscription per section.
 */
export const SettingsSchema = Schema.compose(
  AnyRecord,
  Schema.Struct({
    unitSystem: field(Schema.Literal('metric', 'imperial'), 'metric'),
    themeMode: field(Schema.Literal('system', 'light', 'dark'), 'system'),
    // NOTE: Android only. `kinetiq` is the brand lime; `system` follows the wallpaper.
    accentColor: field(Schema.Literal(...ACCENT_CHOICES), 'kinetiq'),
    // NOTE: `system` follows the device's languages, so a device set to Italian starts in Italian.
    language: field(Schema.Literal('system', 'en', 'it'), 'system'),
    hapticsEnabled: field(Schema.Boolean, true),
    restCountdownHaptics: field(Schema.Boolean, true),
    // NOTE: on by default: a phone that locks between sets hides the rest timer when it is needed.
    keepScreenAwake: field(Schema.Boolean, true),
    notificationsEnabled: field(Schema.Boolean, true),
    // NOTE: the operating system's answer, not a preference: read from the device, never stored.
    notificationsGranted: field(Schema.Boolean, false),
    defaultRestSeconds: clampedInt(15, 600, 90),
    autoStartRest: field(Schema.Boolean, true),
    weeklyGoalWorkouts: clampedInt(1, 14, 4),
    profile: Schema.optionalWith(ProfileSchema, { default: () => ({ ...DEFAULT_PROFILE }) }),
    reminder: Schema.optionalWith(ReminderSettingsSchema, {
      default: () => ({ ...DEFAULT_REMINDER, days: [...DEFAULT_REMINDER.days] }),
    }),
  }),
  { strict: false },
);

export type Settings = typeof SettingsSchema.Type;
export type Profile = typeof ProfileSchema.Type;
export type ReminderSettings = typeof ReminderSettingsSchema.Type;
export type ThemeMode = Settings['themeMode'];

/** Every setting at its default: what a fresh install, or an empty stored object, decodes to. */
export const DEFAULT_SETTINGS: Settings = Schema.decodeUnknownSync(SettingsSchema)({});
