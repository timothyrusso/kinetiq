import { createSelectors, createStore } from '@/features/core/state';

/** Where the launch is: not started, running, past its deadline, done, or failed. */
type BootPhase = 'idle' | 'starting' | 'slow' | 'ready' | 'failed';

interface BootState {
  readonly phase: BootPhase;
  readonly failure: unknown;
  readonly starting: () => void;
  readonly slow: () => void;
  readonly ready: () => void;
  readonly failed: (failure: unknown) => void;
}

/**
 * The launch's progress, outside React on purpose: it has to survive a Fast Refresh remount
 * without running the migrations again, and a development build's double effect must not start a
 * second launch.
 */
const bootStore = createStore<BootState>(set => ({
  phase: 'idle',
  failure: null,
  starting: () => set({ phase: 'starting', failure: null }),
  slow: () => set(state => (state.phase === 'starting' ? { phase: 'slow' } : state)),
  ready: () => set({ phase: 'ready', failure: null }),
  failed: failure => set({ phase: 'failed', failure }),
}));

export const useBootStore = createSelectors(bootStore);
