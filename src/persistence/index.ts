/**
 * The legacy handle on the app database. The repositories moved into features; what is left is
 * the shared connection the launch and the watch paths open. Goes away with them (#54).
 */
export { openDatabase } from './database';
export type { DatabaseOpenResult } from './database';
