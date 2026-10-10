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
 * it. A workout set aside is the more urgent news: an unreadable one first, then one from an
 * older watch app; a newer-version notice never replaces either.
 */
/** How urgent each problem is: a notice is never replaced by a less urgent one. */
const URGENCY: Record<WatchInboxProblem, number> = { invalid: 2, outdated: 1, version: 0 };

const outranks = (current: WatchInboxProblem | null, next: WatchInboxProblem) =>
  current !== null && URGENCY[current] > URGENCY[next];

const inboxNoticeStore = createStore<InboxNoticeState>(set => ({
  problem: null,
  report: problem => set(state => (outranks(state.problem, problem) ? state : { problem })),
  dismiss: () => set({ problem: null }),
}));

export const useInboxNoticeStore = createSelectors(inboxNoticeStore);
