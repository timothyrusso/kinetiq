/**
 * Settings store: an external store consumed with `useSyncExternalStore`.
 *
 * Why not React context: settings are read by the theme, the formatters, the
 * workout session, the notification service and the query layer. A provider
 * would force a re-render of the whole tree on every keystroke in a text field
 * and would not be reachable from non-component code at all. A store is readable
 * synchronously anywhere and only notifies the components that select the slice
 * they actually draw.
 *
 * Writes are optimistic and persisted behind a debounce, so a rapid sequence of
 * unit toggles costs one write rather than N transactions.
 */
import { SETTING_KEYS, setSetting } from '@/persistence';
import { DEFAULT_SETTINGS, normaliseSettings, type SettingsState } from './types';

export type SettingsPatch = Partial<SettingsState>;

let state: SettingsState = DEFAULT_SETTINGS;
let hydrated = false;
const listeners = new Set<() => void>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const PERSIST_DEBOUNCE_MS = 250;

function emit(): void {
  for (const listener of listeners) listener();
}

function schedulePersist(next: SettingsState): void {
  if (flushTimer !== null) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void persist(next);
  }, PERSIST_DEBOUNCE_MS);
}

async function persist(next: SettingsState): Promise<void> {
  // `notificationsGranted` is deliberately absent: it is a fact about the device,
  // not a user preference, and the permissions service owns its storage.
  try {
    await Promise.all([
      setSetting(SETTING_KEYS.unitSystem, next.unitSystem),
      setSetting(SETTING_KEYS.themeMode, next.themeMode),
      setSetting(SETTING_KEYS.language, next.language),
      setSetting(SETTING_KEYS.haptics, next.hapticsEnabled),
      setSetting(SETTING_KEYS.notifications, next.notificationsEnabled),
      setSetting(SETTING_KEYS.defaultRestSeconds, next.defaultRestSeconds),
      setSetting(SETTING_KEYS.autoStartRest, next.autoStartRest),
      setSetting(SETTING_KEYS.weeklyGoalWorkouts, next.weeklyGoalWorkouts),
      setSetting(SETTING_KEYS.profile, next.profile),
      setSetting(SETTING_KEYS.reminder, next.reminder),
    ]);
  } catch (error) {
    // A failed write leaves the in-memory values intact for this run; saying so
    // is all we can do: reverting the UI to values the user never chose would be
    // worse than a preference that reverts on next launch.
    console.warn('[settings] could not persist', error);
  }
}

/**
 * Replaces the store wholesale at boot. Also the seam for a future device-sync
 * import: everything downstream only sees `getState()`.
 */
export function hydrateSettings(next: Partial<SettingsState>): void {
  state = normaliseSettings(next);
  hydrated = true;
  emit();
}

export function isSettingsHydrated(): boolean {
  return hydrated;
}

export function getSettings(): SettingsState {
  return state;
}

export function updateSettings(patch: SettingsPatch): void {
  const next = normaliseSettings({ ...state, ...patch }, state);
  state = next;
  emit();
  schedulePersist(next);
}

/**
 * Subscribes to one derived slice. `getServerSnapshot` is the same function: there
 * is no server render here, and Hermes restarts stateless anyway.
 */
export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Forces any pending debounced write to disk; call before backgrounding/quit paths. */
export async function flushSettings(): Promise<void> {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await persist(state);
}
