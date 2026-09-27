/**
 * Query keys the legacy callers still use. Every input to a query function appears in its key,
 * and prefixes are meaningful, so a whole family invalidates in one call. The features own their
 * own keys (`workoutQueryKeys`, `routineQueryKeys`, `exerciseQueryKeys`).
 */
export const queryKeys = {
  /** The routines' own keys are `routineQueryKeys` in `features/routines`, all under this prefix. */
  routines: {
    all: ['routines'] as const,
  },

  transfer: {
    /** One staged import's exercise matches; the id changes with every paste or file. */
    resolve: (importId: string) => ['transfer', 'resolve', importId] as const,
  },
} as const;
