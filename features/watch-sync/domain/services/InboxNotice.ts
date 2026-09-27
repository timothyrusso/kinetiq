import { Context, type Effect } from 'effect';
import type { WatchInboxProblem } from '@/features/watch-sync/domain/entities/WatchInboxProblem';

/** Tells the user about a watch workout that could not be saved as it arrived. */
export class InboxNotice extends Context.Tag('watch-sync/InboxNotice')<
  InboxNotice,
  { readonly report: (problem: WatchInboxProblem) => Effect.Effect<void> }
>() {}
