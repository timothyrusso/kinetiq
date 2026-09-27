import { createSelectors, createStore } from '@/features/core/state';
import type { ExerciseSnapshot } from '@/features/exercises';
import type { RoutineItem } from '@/features/routines/domain/schemas/RoutineSchema';

/** `idle` until the builder opens, `saving` while the one save runs, `saved` once it landed. */
type RoutineDraftStatus = 'idle' | 'ready' | 'saving' | 'saved';

/**
 * The new-routine builder's draft. It lives outside the screen because the exercise picker, a
 * sheet over the builder, writes into it, and because a draft must survive the builder being
 * backgrounded mid-build. It is never persisted: backing out of a routine nobody saved creates
 * nothing, and the builder asks before it discards.
 */
export interface RoutineDraft {
  readonly status: RoutineDraftStatus;
  /** Set once the user typed a name or added a row. */
  readonly touched: boolean;
  /** As typed; a blank name is derived from the exercises at save time. */
  readonly name: string;
  readonly items: readonly RoutineItem[];
  /** The frozen copies of the exercises added, one per exercise, in the order they were added. */
  readonly snapshots: readonly ExerciseSnapshot[];
  /** The rest a newly added row gets; follows the user's setting. */
  readonly defaultRestSeconds: number;
}

interface RoutineDraftStore extends RoutineDraft {
  readonly patch: (patch: Partial<RoutineDraft>) => void;
  readonly reset: () => void;
}

export const EMPTY_DRAFT: RoutineDraft = {
  status: 'idle',
  touched: false,
  name: '',
  items: [],
  snapshots: [],
  defaultRestSeconds: 90,
};

/** The draft, with `use.<field>()` selectors. Written only by `useRoutineDraft`'s actions. */
export const useRoutineDraftStore = createSelectors(
  createStore<RoutineDraftStore>(set => ({
    ...EMPTY_DRAFT,
    patch: patch => set(patch),
    reset: () => set(EMPTY_DRAFT),
  })),
);
