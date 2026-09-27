import { useT } from '@/features/core/translations';
import { useWatchInboxNotice } from '@/features/watch-sync/facades/useWatchInboxNotice';

/**
 * The notice's copy for the problem waiting. Nothing is lost either way: an unreadable workout is
 * kept aside on the phone, a newer-version one waits in the inbox until the phone app is updated.
 */
export function useWatchInboxNoticeLogic() {
  const { t } = useT();
  const { problem, dismiss } = useWatchInboxNotice();
  const version = problem === 'version';
  return {
    state: { visible: problem !== null },
    derived: {
      title: version ? t('watchInbox.versionTitle') : t('watchInbox.invalidTitle'),
      message: version ? t('watchInbox.versionMessage') : t('watchInbox.invalidMessage'),
      confirmLabel: t('watchInbox.ok'),
    },
    effects: { dismiss },
  };
}
