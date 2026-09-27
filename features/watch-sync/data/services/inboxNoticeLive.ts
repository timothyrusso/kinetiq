import { Effect, Layer } from 'effect';
import { InboxNotice } from '@/features/watch-sync/domain/services/InboxNotice';
import { useInboxNoticeStore } from '@/features/watch-sync/state/inboxNoticeStore';

/** Tells the problem through the notice store, which the dialog on screen reads. */
export const InboxNoticeLive = Layer.succeed(InboxNotice, {
  report: problem => Effect.sync(() => useInboxNoticeStore.getState().report(problem)),
});
