import { useInboxNoticeStore } from '@/features/watch-sync/state/inboxNoticeStore';

const dismiss = () => useInboxNoticeStore.getState().dismiss();

/** The watch workout problem waiting to be told, and the way to dismiss it. */
export function useWatchInboxNotice() {
  return { problem: useInboxNoticeStore.use.problem(), dismiss };
}
