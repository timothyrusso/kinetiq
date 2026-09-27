import { createSelectors, createStore } from '@/features/core/state';
import type { StagedImport } from '@/features/transfer/domain/entities/ParsedImport';

interface StagedImportState {
  readonly staged: StagedImport | null;
  readonly stage: (staged: StagedImport) => void;
  readonly clear: () => void;
}

/**
 * The import that has been read but not yet confirmed. The data screen reads and parses it, the
 * preview shows and writes it; it can be tens of kilobytes, which does not belong in a route
 * param, so it waits here.
 */
const stagedImportStore = createStore<StagedImportState>(set => ({
  staged: null,
  stage: staged => set({ staged }),
  clear: () => set({ staged: null }),
}));

export const useStagedImportStore = createSelectors(stagedImportStore);
