import { Schema } from 'effect';
import {
  type Profile,
  type ReminderSettings,
  type Settings,
  SettingsSchema,
} from '@/features/settings/domain/schemas/SettingsSchema';

const decodeSettings = Schema.decodeUnknownSync(SettingsSchema);

const sameProfile = (a: Profile, b: Profile) =>
  a.name === b.name && a.heightCm === b.heightCm && a.birthYear === b.birthYear;

const sameReminder = (a: ReminderSettings, b: ReminderSettings) =>
  a.enabled === b.enabled &&
  a.minuteOfDay === b.minuteOfDay &&
  a.days.length === b.days.length &&
  a.days.every((day, index) => day === b.days[index]);

/**
 * `input` decoded with {@link SettingsSchema}: every field valid, clamped, or at its default.
 *
 * `previous` exists to preserve object identity: `useSettings(s => s.profile)` compares with
 * `Object.is`, so rebuilding every sub-object on every unrelated write would re-render the
 * profile readers for no reason.
 */
export function normaliseSettings(input: unknown, previous?: Settings): Settings {
  const next = decodeSettings(input ?? {});
  if (previous === undefined) return next;
  return {
    ...next,
    profile: sameProfile(previous.profile, next.profile) ? previous.profile : next.profile,
    reminder: sameReminder(previous.reminder, next.reminder) ? previous.reminder : next.reminder,
  };
}
