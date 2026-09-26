/**
 * The port every exercise backend must satisfy.
 *
 * Screens and query hooks depend on this interface only. Swapping wger for a
 * self-hosted catalog, a paid provider or a bundled fixture means writing one
 * new class and changing one line in `src/api/index.ts`: no screen, hook or
 * repository changes, and no response shapes leaking anywhere else.
 */
import type { Exercise, ExerciseFilter, ExercisePage, ExerciseTaxonomy } from '@/domain/types';

export interface ExerciseProvider {
  /** Human-readable name for diagnostics and the "powered by" credit. */
  readonly name: string;

  /**
   * One page of exercises matching `filter`. Implementations must be safe to
   * call concurrently with different filters, and must honour the abort signal.
   */
  page(filter: ExerciseFilter, cursor: string | null, signal?: AbortSignal): Promise<ExercisePage>;

  /** Full detail for one exercise, including media. */
  byId(externalId: number, signal?: AbortSignal): Promise<Exercise | null>;

  /**
   * Filter vocabulary (categories, equipment, muscles). Small, slow-changing
   * and shared by every screen, so callers cache it aggressively.
   */
  taxonomy(signal?: AbortSignal): Promise<ExerciseTaxonomy>;

  /**
   * Other exercises in the same variation family, e.g. the grip variants of a
   * bench press. Returns [] for exercises without variations, and must not
   * include the exercise itself.
   */
  variations(externalId: number, signal?: AbortSignal): Promise<Exercise[]>;
}

/** Cursor used for the first page. Providers encode it however they like. */
export const FIRST_PAGE: string | null = null;

export function emptyTaxonomy(): ExerciseTaxonomy {
  return { categories: [], equipment: [], muscles: [] };
}
