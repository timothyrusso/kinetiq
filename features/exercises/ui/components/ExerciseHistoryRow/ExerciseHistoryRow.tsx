import { memo } from 'react';
import { View } from 'react-native';
import { Badge, ICON_SIZE, Icon, ListRow, Txt, useStyles } from '@/features/core/design-system';
import type { Theme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';
import type { UnitSystem } from '@/features/core/utils';
import { useExerciseHistoryRowLogic } from '@/features/exercises/ui/components/ExerciseHistoryRow/ExerciseHistoryRow.logic';
import { createStyles } from '@/features/exercises/ui/components/ExerciseHistoryRow/ExerciseHistoryRow.style';
import type { ExercisePerformance } from '@/queries/useExerciseHistory';

/**
 * One past session with this exercise: the top set as the title, the date and the sets done as
 * items, and the estimated max (or how long ago) at the end. Opens the session's activity.
 */
export const ExerciseHistoryRow = memo(function ExerciseHistoryRow({
  session,
  units,
  theme,
  topDivider,
  onOpen,
}: {
  session: ExercisePerformance;
  units: UnitSystem;
  theme: Theme;
  topDivider: boolean;
  onOpen: (activityId: string) => void;
}) {
  const { derived, effects } = useExerciseHistoryRowLogic(session, units, onOpen);
  const { t } = useT();
  const styles = useStyles(createStyles);

  return (
    <View style={topDivider ? styles.divider : undefined}>
      <ListRow
        theme={theme}
        title={derived.load}
        meta={derived.meta}
        showChevron
        onPress={effects.open}
        accessibilityHint={t('exerciseDetail.openSession')}
        trailing={
          derived.estimate === null ? (
            <Txt variant="caption" tone="faint">
              {derived.ago}
            </Txt>
          ) : (
            <Badge
              label={derived.estimate}
              tone="success"
              icon={<Icon name="trophy" size={ICON_SIZE.micro} color={theme.colors.success} />}
            />
          )
        }
      />
    </View>
  );
});
