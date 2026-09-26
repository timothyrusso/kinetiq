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
} from './routineRepository';
export type { RoutineDraft } from './routineRepository';
export { onRoutinesChanged } from './routineEvents';
export { sessionRepository } from './sessionRepository';
export type { SessionPatch } from './sessionRepository';
export {
  readAllSettings,
  recordRepository,
  SETTING_KEYS,
  setSetting,
} from './settingsRepository';
export type { SettingKey } from './settingsRepository';
export {
  clearAllUserData,
  openDatabase,
  withTransaction,
} from './database';
export type { DatabaseOpenResult } from './database';
