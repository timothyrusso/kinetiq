import { FlashList } from '@shopify/flash-list';
import { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import {
  EmptyState,
  ErrorState,
  SCROLL_INSETS,
  SectionHeader,
  SkeletonCard,
  SkeletonList,
  ThemedRefreshControl,
  useStyles,
} from '@/features/core/design-system';
import type { Theme } from '@/features/core/theme';
import type { TKey, TVars } from '@/features/core/translations';
import type { UnitSystem } from '@/features/core/utils';
import type { HistoryRow } from '@/features/home/domain/entities/HistoryRow';
import { createStyles } from '@/features/home/ui/components/HistoryList/HistoryList.style';
import { TrainingGrid } from '@/features/home/ui/components/TrainingGrid/TrainingGrid';
import { WorkoutCell } from '@/features/home/ui/components/WorkoutCell/WorkoutCell';
import type { Activity, TrainingHeatmap } from '@/features/workouts';

type Row = HistoryRow<Activity>;

const keyExtractor = (item: Row) => (item.type === 'workout' ? item.activity.id : item.key);
const getItemType = (item: Row) => item.type;

/**
 * The training grid, then every workout, grouped by week. The list owns the scroll: the native
 * large title collapses by coupling to the screen's first scroll view, and nesting a virtualised
 * list in a scroll view defeats the virtualisation. So the grid is the list's header, and the
 * week headings are rows of their own item type, so a heading is never recycled into a card.
 * The header and the empty state are memoised: the list re-lays out whenever its header element
 * changes, and a render that changed nothing the grid shows must leave it alone.
 */
export function HistoryList({
  rows,
  gridWeeks,
  theme,
  units,
  locale,
  t,
  bottomSpace,
  refreshing,
  onRefresh,
  onOpen,
  onLongPress,
  heatmap,
  heatmapPending,
  heatmapError,
  onRetryHeatmap,
  historyEmpty,
  historyLoading,
  historyError,
  onCreateRoutine,
}: {
  rows: readonly Row[];
  gridWeeks: number;
  theme: Theme;
  units: UnitSystem;
  locale: string;
  t: (key: TKey, vars?: TVars) => string;
  bottomSpace: number;
  refreshing: boolean;
  onRefresh: () => void;
  onOpen: (id: string) => void;
  onLongPress: (id: string) => void;
  heatmap: TrainingHeatmap | undefined;
  heatmapPending: boolean;
  heatmapError: unknown;
  onRetryHeatmap: () => void;
  historyEmpty: boolean;
  historyLoading: boolean;
  historyError: unknown;
  onCreateRoutine: () => void;
}) {
  const styles = useStyles(createStyles);

  const renderItem = useCallback(
    ({ item }: { item: Row }) =>
      item.type === 'week' ? (
        <SectionHeader title={item.label} counter={item.count} style={item.first ? styles.firstWeek : styles.week} />
      ) : (
        <WorkoutCell activity={item.activity} theme={theme} units={units} onPress={onOpen} onLongPress={onLongPress} />
      ),
    [onLongPress, onOpen, styles, theme, units],
  );

  const listHeader = useMemo(
    () =>
      historyEmpty ? null : (
        <View style={styles.load}>
          {heatmapPending ? (
            <SkeletonCard lines={3} />
          ) : heatmapError ? (
            <ErrorState onRetry={onRetryHeatmap} compact />
          ) : heatmap ? (
            <TrainingGrid heatmap={heatmap} weeks={gridWeeks} theme={theme} locale={locale} t={t} />
          ) : null}
        </View>
      ),
    [gridWeeks, heatmap, heatmapError, heatmapPending, historyEmpty, locale, onRetryHeatmap, styles, t, theme],
  );

  const listEmpty = useMemo(
    () =>
      historyLoading ? (
        <View style={styles.skeleton}>
          <SkeletonList rows={4} />
        </View>
      ) : historyError ? (
        <ErrorState onRetry={onRefresh} title={t('home.historyError')} />
      ) : (
        <EmptyState
          title={t('home.emptyTitle')}
          message={t('home.emptyMessage')}
          icon="dumbbell"
          actionLabel={t('home.createRoutine')}
          onAction={onCreateRoutine}
        />
      ),
    [historyError, historyLoading, onRefresh, onCreateRoutine, styles, t],
  );
  const contentContainerStyle = useMemo(() => ({ paddingBottom: bottomSpace }), [bottomSpace]);

  return (
    <FlashList
      {...SCROLL_INSETS}
      // NOTE: keyed by locale: a card phrases its metadata with `tr()`, and its memo would keep the
      // old language until the row recycled.
      key={locale}
      data={rows}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      getItemType={getItemType}
      extraData={units}
      contentContainerStyle={contentContainerStyle}
      refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={listEmpty}
      style={styles.list}
    />
  );
}
