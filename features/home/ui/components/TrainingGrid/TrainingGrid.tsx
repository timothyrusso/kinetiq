import { memo } from 'react';
import { Card, HeatmapCalendar, SectionHeader, useStyles } from '@/features/core/design-system';
import type { Theme } from '@/features/core/theme';
import type { TKey, TVars } from '@/features/core/translations';
import { useTrainingGridLogic } from '@/features/home/ui/components/TrainingGrid/TrainingGrid.logic';
import { createStyles } from '@/features/home/ui/components/TrainingGrid/TrainingGrid.style';
import type { TrainingHeatmap } from '@/features/workouts';

/**
 * The weeks of training days, one square per day, shaded by minutes trained. Memoised, with `t`
 * and `locale` as props so a language change still reaches it.
 */
export const TrainingGrid = memo(function TrainingGrid({
  heatmap,
  weeks,
  theme,
  locale,
  t,
}: {
  heatmap: TrainingHeatmap;
  weeks: number;
  theme: Theme;
  locale: string;
  t: (key: TKey, vars?: TVars) => string;
}) {
  const { derived } = useTrainingGridLogic(heatmap, weeks, t);
  const styles = useStyles(createStyles);
  return (
    <Card>
      <SectionHeader title={t('heatmap.title')} eyebrow={t('heatmap.eyebrow', { count: weeks })} style={styles.title} />
      <HeatmapCalendar
        days={heatmap.days}
        theme={theme}
        locale={locale}
        accessibilityLabel={derived.a11y}
        lessLabel={t('heatmap.less')}
        moreLabel={t('heatmap.more')}
        footer={derived.footer}
      />
    </Card>
  );
});
