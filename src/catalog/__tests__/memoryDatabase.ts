/**
 * An in-memory SQLite database behind the slice of the expo-sqlite API the catalog repository
 * uses, so its SQL runs against a real engine in jest.
 *
 * `node:sqlite` ships with Node 22.13 and later, so this needs no dependency. It is synchronous;
 * the async methods simply resolve with its answer. The exclusive transaction runs on the same
 * connection, which is enough to test that a failure rolls everything back.
 */
import { DatabaseSync } from 'node:sqlite';

import { CATALOG_SCHEMA } from '../schema';

type Params = readonly (string | number | null)[];

export type MemoryDatabase = {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: Params): Promise<void>;
  getAllAsync<T>(sql: string, params?: Params): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: Params): Promise<T | null>;
  withExclusiveTransactionAsync(task: (txn: MemoryDatabase) => Promise<void>): Promise<void>;
  /** Test-only: a synchronous count, for asserting what a failed write left behind. */
  count(table: string): number;
};

export function createMemoryDatabase(): MemoryDatabase {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(CATALOG_SCHEMA);

  const handle: MemoryDatabase = {
    async execAsync(sql) {
      db.exec(sql);
    },
    async runAsync(sql, params = []) {
      db.prepare(sql).run(...params);
    },
    async getAllAsync<T>(sql: string, params: Params = []) {
      return db.prepare(sql).all(...params) as T[];
    },
    async getFirstAsync<T>(sql: string, params: Params = []) {
      return (db.prepare(sql).get(...params) as T | undefined) ?? null;
    },
    async withExclusiveTransactionAsync(task) {
      db.exec('BEGIN EXCLUSIVE');
      try {
        await task(handle);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    count(table) {
      return (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
    },
  };
  return handle;
}
