import type { ParsedItem, ParsedRoutine } from '@/features/transfer/domain/entities/ParsedImport';

/**
 * How an item found its exercise: on the device (`stored`), in the catalog by id or exact name
 * (`catalog`), the catalog's closest name (`closest`), or not at all. Generic over the snapshot,
 * which `exercises` owns: a domain type never names another feature's.
 */
export type ExerciseMatch<Snapshot> =
  | { readonly status: 'stored' | 'catalog' | 'closest'; readonly snapshot: Snapshot }
  | { readonly status: 'missing'; readonly offline: boolean };

export type ResolvedItem<Snapshot> = ParsedItem & { readonly match: ExerciseMatch<Snapshot> };

export type ResolvedRoutine<Snapshot> = Omit<ParsedRoutine, 'items'> & {
  readonly items: readonly ResolvedItem<Snapshot>[];
};
