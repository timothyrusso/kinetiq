import { ConfirmDialog } from '@/features/core/design-system';
import { useWatchInboxNoticeLogic } from '@/features/watch-sync/ui/components/WatchInboxNotice/WatchInboxNotice.logic';

/** Tells the user when a workout from the Apple Watch could not be saved as it arrived. */
export function WatchInboxNotice() {
  const { state, derived, effects } = useWatchInboxNoticeLogic();
  return (
    <ConfirmDialog
      visible={state.visible}
      title={derived.title}
      message={derived.message}
      confirmLabel={derived.confirmLabel}
      onConfirm={effects.dismiss}
      onCancel={effects.dismiss}
    />
  );
}
