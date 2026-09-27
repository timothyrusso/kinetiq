import { createSelectors, createStore } from '@/features/core/state';
import type { WatchInboxProblem } from '@/features/watch-sync/domain/entities/WatchInboxProblem';

interface InboxNoticeState {
  /** The problem waiting to be told, or `null`. */
  readonly problem: WatchInboxProblem | null;
  readonly report: (problem: WatchInboxProblem) => void;
  readonly dismiss: () => void;
}

/**
 * The watch workout the phone could not save as it arrived, waiting to be told. The drain runs
 * outside React (the launch, the foreground, an inbox event) and reports here; the notice reads
 * it. An unreadable workout is the more urgent news, so a version notice never replaces it.
 */
const inboxNoticeStore = createStore<InboxNoticeState>(set => ({
  problem: null,
  report: problem => set(state => (state.problem === 'invalid' ? state : { problem })),
  dismiss: () => set({ problem: null }),
}));

export const useInboxNoticeStore = createSelectors(inboxNoticeStore);
