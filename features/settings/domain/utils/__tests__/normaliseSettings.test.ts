import { DEFAULT_SETTINGS } from '@/features/settings/domain/schemas/SettingsSchema';
import { normaliseSettings } from '@/features/settings/domain/utils/normaliseSettings';

describe('normaliseSettings', () => {
  it('reads nothing, or something that is not an object, as the defaults', () => {
    expect(normaliseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normaliseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normaliseSettings('settings')).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toEqual({
      unitSystem: 'metric',
      themeMode: 'system',
      accentColor: 'kinetiq',
      language: 'system',
      hapticsEnabled: true,
      restCountdownHaptics: true,
      keepScreenAwake: true,
      notificationsEnabled: true,
      notificationsGranted: false,
      notificationsAsked: false,
      defaultRestSeconds: 90,
      autoStartRest: true,
      weeklyGoalWorkouts: 4,
      profile: { name: '', heightCm: 178, birthYear: 1994 },
      reminder: { enabled: false, minuteOfDay: 1080, days: [1, 3, 5] },
    });
  });

  it('keeps valid values and replaces unknown ones with the default, field by field', () => {
    const next = normaliseSettings({
      unitSystem: 'imperial',
      themeMode: 'sepia',
      language: 'fr',
      accentColor: 'ocean',
    });
    expect(next).toMatchObject({
      unitSystem: 'imperial',
      themeMode: 'system',
      language: 'system',
      accentColor: 'ocean',
    });
    expect(normaliseSettings({ accentColor: 'neon' }).accentColor).toBe('kinetiq');
  });

  it('rounds and clamps numbers, and falls back when they are not finite', () => {
    expect(normaliseSettings({ defaultRestSeconds: 5 }).defaultRestSeconds).toBe(15);
    expect(normaliseSettings({ defaultRestSeconds: 9999 }).defaultRestSeconds).toBe(600);
    expect(normaliseSettings({ defaultRestSeconds: 92.6 }).defaultRestSeconds).toBe(93);
    expect(normaliseSettings({ weeklyGoalWorkouts: Number.NaN }).weeklyGoalWorkouts).toBe(4);
    expect(normaliseSettings({ weeklyGoalWorkouts: 99 }).weeklyGoalWorkouts).toBe(14);
    expect(normaliseSettings({ profile: { heightCm: 20, birthYear: 3000 } }).profile).toEqual({
      name: '',
      heightCm: 100,
      birthYear: 2020,
    });
    expect(normaliseSettings({ reminder: { minuteOfDay: 2000 } }).reminder.minuteOfDay).toBe(1439);
  });

  it('trims the name, and dedupes, filters and sorts the reminder days', () => {
    expect(normaliseSettings({ profile: { name: '  Ada ' } }).profile.name).toBe('Ada');
    expect(normaliseSettings({ reminder: { days: [5, 1, 5, 9, 0, 3] } }).reminder.days).toEqual([1, 3, 5]);
    expect(normaliseSettings({ reminder: { days: [] } }).reminder.days).toEqual([1, 3, 5]);
    expect(normaliseSettings({ reminder: { days: [9] } }).reminder.days).toEqual([]);
  });

  it('keeps the identity of an unchanged profile and reminder', () => {
    const previous = normaliseSettings({});
    const next = normaliseSettings({ ...previous, unitSystem: 'imperial' }, previous);
    expect(next.profile).toBe(previous.profile);
    expect(next.reminder).toBe(previous.reminder);
    const renamed = normaliseSettings({ ...previous, profile: { ...previous.profile, name: 'Ada' } }, previous);
    expect(renamed.profile).not.toBe(previous.profile);
    expect(renamed.reminder).toBe(previous.reminder);
  });
});
