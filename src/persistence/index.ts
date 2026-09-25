/**
 * Repository barrel. Screens and hooks import from here and never from a
 * specific repository file, which keeps the persistence module's internals free
 * to move around.
 */
export { activityRepository } from './activityRepository';
export {
  routineRepository,
  snapshotById,
  snapshotByName,
  snapshotOf,
  upsertSnapshot,
} from './routineRepository';
export type { RoutineDraft } from './routineRepository';
export { sessionRepository } from './sessionRepository';
export type { SessionPatch } from './sessionRepository';
export {
  readAllSettings,
  readState,
  recordRepository,
  SEED_DONE_KEY,
  SETTING_KEYS,
  setSetting,
  writeState,
} from './settingsRepository';
export type { SettingKey } from './settingsRepository';
export {
  clearAllUserData,
  openDatabase,
} from './database';
export type { DatabaseOpenResult } from './database';
