import type { Language } from '@/i18n';
import type { UnitSystem } from '@/utils/format';

export type ThemeMode = 'system' | 'light' | 'dark';

export type Profile = { name: string; heightCm: number; birthYear: number };

export type ReminderSettings = {
  enabled: boolean;
  /** Minutes from local midnight. */
  minuteOfDay: number;
  /** ISO weekday numbers, 1 = Monday … 7 = Sunday. */
  days: number[];
};

const DEFAULT_REMINDER: ReminderSettings = {
  enabled: false,
  minuteOfDay: 18 * 60,
  days: [1, 3, 5],
};

/**
 * Everything the user can change. Kept flat and small on purpose: it is read by
 * render code, so a nested shape would mean a new subscription per section.
 */
/**
 * Accent colours offered on Android. `system` is Material You (the wallpaper palette, Android
 * 12+); the named ones are seed colours the Material 3 generator turns into a full light and dark
 * palette, so each keeps its contrast in both modes.
 */
export const ACCENT_CHOICES = ['kinetiq', 'system', 'ocean', 'sunset', 'berry', 'ruby'] as const;
export type AccentChoice = (typeof ACCENT_CHOICES)[number];

export type SettingsState = {
  unitSystem: UnitSystem;
  themeMode: ThemeMode;
  /** Android only: the accent colour. `kinetiq` is the brand lime; `system` follows the wallpaper. */
  accentColor: AccentChoice;
  /** 'system' follows the device's preferred languages; the others force one. */
  language: Language;
  hapticsEnabled: boolean;
  notificationsEnabled: boolean;
  /** Used by both rest timers and scheduled reminders. */
  notificationsGranted: boolean;
  defaultRestSeconds: number;
  autoStartRest: boolean;
  weeklyGoalWorkouts: number;
  profile: Profile;
  reminder: ReminderSettings;
};

export const DEFAULT_SETTINGS: SettingsState = {
  unitSystem: 'metric',
  themeMode: 'system',
  accentColor: 'kinetiq',
  // `system` so a device set to Italian is in Italian on first launch, without being asked.
  language: 'system',
  hapticsEnabled: true,
  notificationsEnabled: true,
  notificationsGranted: false,
  defaultRestSeconds: 90,
  autoStartRest: true,
  weeklyGoalWorkouts: 4,
  // Empty rather than 'Athlete': the screens that show a name already fall back to a
  // translated placeholder, and a default stored in English would print "Athlete" to an
  // Italian user as though they had typed it.
  profile: { name: '', heightCm: 178, birthYear: 1994 },
  reminder: DEFAULT_REMINDER,
};

function sameProfile(a: Profile | undefined, b: Profile): a is Profile {
  return (
    !!a && a.name === b.name && a.heightCm === b.heightCm && a.birthYear === b.birthYear
  );
}

function sameReminder(
  a: ReminderSettings | undefined,
  b: ReminderSettings,
): a is ReminderSettings {
  return (
    !!a &&
    a.enabled === b.enabled &&
    a.minuteOfDay === b.minuteOfDay &&
    a.days.length === b.days.length &&
    a.days.every((d, i) => d === b.days[i])
  );
}

/**
 * Coarse clamp so a corrupt stored value can't produce a 9-hour rest timer.
 *
 * `previous` exists purely to preserve object identity: `useSettings(s => s.profile)`
 * compares with `Object.is`, so rebuilding every sub-object on every unrelated
 * write would re-render profile readers for no reason.
 */
export function normaliseSettings(
  input: Partial<SettingsState> | null,
  previous?: SettingsState,
): SettingsState {
  const s = input ?? {};
  const clamp = (value: number | undefined, min: number, max: number, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value)
      ? Math.min(max, Math.max(min, Math.round(value)))
      : fallback;

  const candidateProfile: Profile = {
    name: s.profile?.name?.trim() || DEFAULT_SETTINGS.profile.name,
    heightCm: clamp(s.profile?.heightCm, 100, 230, DEFAULT_SETTINGS.profile.heightCm),
    birthYear: clamp(s.profile?.birthYear, 1930, 2020, DEFAULT_SETTINGS.profile.birthYear),
  };

  const candidateReminder: ReminderSettings = {
    enabled: s.reminder?.enabled ?? DEFAULT_REMINDER.enabled,
    minuteOfDay: clamp(s.reminder?.minuteOfDay, 0, 1439, DEFAULT_REMINDER.minuteOfDay),
    days:
      s.reminder?.days && s.reminder.days.length > 0
        ? [...new Set(s.reminder.days.filter((d) => d >= 1 && d <= 7))].sort((a, b) => a - b)
        : DEFAULT_REMINDER.days,
  };

  const next: SettingsState = {
    unitSystem: s.unitSystem === 'imperial' ? 'imperial' : 'metric',
    themeMode:
      s.themeMode === 'light' || s.themeMode === 'dark' ? s.themeMode : 'system',
    accentColor: (ACCENT_CHOICES as readonly string[]).includes(s.accentColor ?? '')
      ? (s.accentColor as AccentChoice)
      : DEFAULT_SETTINGS.accentColor,
    // Validated the same way as the others: a persisted value from an older build, or a hand
    // edited database, must not put an unknown language code into the catalog lookup.
    language: s.language === 'en' || s.language === 'it' ? s.language : 'system',
    hapticsEnabled: s.hapticsEnabled ?? DEFAULT_SETTINGS.hapticsEnabled,
    notificationsEnabled: s.notificationsEnabled ?? DEFAULT_SETTINGS.notificationsEnabled,
    notificationsGranted: s.notificationsGranted ?? DEFAULT_SETTINGS.notificationsGranted,
    defaultRestSeconds: clamp(s.defaultRestSeconds, 15, 600, DEFAULT_SETTINGS.defaultRestSeconds),
    autoStartRest: s.autoStartRest ?? DEFAULT_SETTINGS.autoStartRest,
    weeklyGoalWorkouts: clamp(
      s.weeklyGoalWorkouts,
      1,
      14,
      DEFAULT_SETTINGS.weeklyGoalWorkouts,
    ),
    profile: candidateProfile,
    reminder: candidateReminder,
  };

  const prevProfile = previous?.profile;
  const prevReminder = previous?.reminder;
  return {
    ...next,
    profile: sameProfile(prevProfile, next.profile) ? prevProfile : next.profile,
    reminder: sameReminder(prevReminder, next.reminder) ? prevReminder : next.reminder,
  };
}
