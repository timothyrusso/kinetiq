/** The transfer's query keys: one staged import's exercise matches, keyed by the stage's own id. */
export const transferQueryKeys = {
  resolve: (importId: string) => ['transfer', 'resolve', importId] as const,
};
