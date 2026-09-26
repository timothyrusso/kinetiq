/**
 * Tells the user when a workout from the Apple Watch could not be saved as it arrived. Nothing
 * is lost either way: an unreadable one is kept aside on the phone, a newer-version one waits
 * in the inbox until Kinetiq on the phone is updated.
 */
import { useT } from '@/i18n/useT';
import { ConfirmDialog } from '@/ui/controls/ConfirmDialog';
import { dismissWatchInboxProblem, useWatchInboxProblem } from './inboxNotice';

export function WatchInboxNotice() {
  const { t } = useT();
  const problem = useWatchInboxProblem();
  return (
    <ConfirmDialog
      visible={problem !== null}
      title={problem === 'version' ? t('watchInbox.versionTitle') : t('watchInbox.invalidTitle')}
      message={problem === 'version' ? t('watchInbox.versionMessage') : t('watchInbox.invalidMessage')}
      confirmLabel={t('watchInbox.ok')}
      onConfirm={dismissWatchInboxProblem}
      onCancel={dismissWatchInboxProblem}
    />
  );
}
