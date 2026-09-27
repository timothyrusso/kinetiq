import type { ParsedItem } from '@/features/transfer/domain/entities/ParsedImport';
import type { ResolvedRoutine } from '@/features/transfer/domain/entities/ResolvedImport';

/** A name as the match compares it: lower case, letters and digits, single spaces. */
export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** The key two items share when they would find the same exercise: one lookup, not four requests. */
export function matchKey(item: ParsedItem): string {
  return `${item.exerciseId ?? ''}|${normaliseName(item.exerciseName)}`;
}

/** Routines with at least one matched item: the ones an import will actually create. */
export function importable<Snapshot>(routines: readonly ResolvedRoutine<Snapshot>[]): ResolvedRoutine<Snapshot>[] {
  return routines.filter(routine => routine.items.some(item => item.match.status !== 'missing'));
}
