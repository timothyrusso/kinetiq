import { ConfirmDialog, ScreenHeader } from '@/features/core/design-system';
import { useAppTheme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';
import { HistoryList } from '@/features/home/ui/components/HistoryList/HistoryList';
import { useHomePageLogic } from '@/features/home/ui/pages/HomePage/HomePage.logic';

/** The Home tab: the training grid, then every workout, newest first. */
export function HomePage() {
  const { state, derived, effects } = useHomePageLogic();
  const { t } = useT();
  const theme = useAppTheme();

  // NOTE: a fragment, not a view: the native large title collapses by coupling to the screen's
  // first scroll view, which the list has to be.
  return (
    <>
      <ScreenHeader title={derived.title} />
      <HistoryList
        rows={state.rows}
        gridWeeks={state.gridWeeks}
        theme={theme}
        units={state.units}
        locale={state.locale}
        t={t}
        bottomSpace={state.bottomSpace}
        refreshing={state.refreshing}
        onRefresh={effects.refresh}
        onOpen={effects.openActivity}
        onLongPress={effects.askDelete}
        heatmap={state.heatmap}
        heatmapPending={state.heatmapPending}
        heatmapError={state.heatmapError}
        onRetryHeatmap={effects.retrySummary}
        historyEmpty={state.historyEmpty}
        historyLoading={state.historyLoading}
        historyError={state.historyError}
        onCreateRoutine={effects.openNewRoutine}
      />
      {state.pendingDelete ? (
        <ConfirmDialog
          visible={!state.deleting}
          title={t('activity.deleteTitle')}
          message={derived.deleteMessage}
          confirmLabel={t('activity.deleteConfirm')}
          cancelLabel={t('common.cancel')}
          destructive
          onConfirm={effects.confirmDelete}
          onCancel={effects.cancelDelete}
        />
      ) : null}
    </>
  );
}
