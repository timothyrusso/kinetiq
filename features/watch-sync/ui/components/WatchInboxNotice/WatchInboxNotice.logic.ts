import { useT } from '@/features/core/translations';
import { useWatchInboxNotice } from '@/features/watch-sync/facades/useWatchInboxNotice';

/** The catalog keys of each problem's title and message. */
const COPY = {
  invalid: { title: 'watchInbox.invalidTitle', message: 'watchInbox.invalidMessage' },
  outdated: { title: 'watchInbox.outdatedTitle', message: 'watchInbox.outdatedMessage' },
  version: { title: 'watchInbox.versionTitle', message: 'watchInbox.versionMessage' },
} as const;

/**
 * The notice's copy for the problem waiting. Nothing is lost either way: an unreadable workout,
 * or one from an older watch app, is kept aside on the phone; a newer-version one waits in the
 * inbox until the phone app is updated.
 */
export function useWatchInboxNoticeLogic() {
  const { t } = useT();
  const { problem, dismiss } = useWatchInboxNotice();
  const copy = COPY[problem ?? 'invalid'];
  return {
    state: { visible: problem !== null },
    derived: {
      title: t(copy.title),
      message: t(copy.message),
      confirmLabel: t('watchInbox.ok'),
    },
    effects: { dismiss },
  };
}
