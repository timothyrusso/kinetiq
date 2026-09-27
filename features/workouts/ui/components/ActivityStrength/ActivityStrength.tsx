import {
  Card,
  Stack as Column,
  ICON_SIZE,
  Icon,
  MetricGrid,
  Row,
  SectionHeader,
  Txt,
  useStyles,
} from '@/features/core/design-system';
import type { Theme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';
import type { UnitSystem } from '@/features/core/utils';
import type { Activity } from '@/features/workouts/domain/schemas/ActivitySchema';
import { ActivityExerciseCard } from '@/features/workouts/ui/components/ActivityExerciseCard/ActivityExerciseCard';
import { ActivityMetric } from '@/features/workouts/ui/components/ActivityMetric/ActivityMetric';
import { useActivityStrengthLogic } from '@/features/workouts/ui/components/ActivityStrength/ActivityStrength.logic';
import { createStyles } from '@/features/workouts/ui/components/ActivityStrength/ActivityStrength.style';

/** A recorded workout's summary, its exercises with their sets, and the records it set. */
export function ActivityStrength({ activity, units, theme }: { activity: Activity; units: UnitSystem; theme: Theme }) {
  const { derived, effects } = useActivityStrengthLogic(activity, units);
  const { t } = useT();
  const styles = useStyles(createStyles);
  const { metrics } = derived;

  return (
    <>
      <Column gap="lg" style={styles.section}>
        <SectionHeader title={t('activity.session')} />
        <MetricGrid columns={2}>
          <ActivityMetric label={t('activity.duration')} value={metrics.duration} />
          <ActivityMetric
            label={t('activity.volume')}
            value={metrics.volume}
            {...(metrics.volumeNote === undefined ? {} : { note: metrics.volumeNote })}
          />
          <ActivityMetric label={t('activity.sets')} value={metrics.sets} note={metrics.setsNote} />
          <ActivityMetric
            label={t('activity.exercises')}
            value={metrics.exercises}
            {...(metrics.exercisesNote === undefined ? {} : { note: metrics.exercisesNote })}
          />
          <ActivityMetric
            label={t('activity.calories')}
            value={metrics.calories}
            {...(metrics.caloriesNote === undefined ? {} : { note: metrics.caloriesNote })}
          />
        </MetricGrid>
      </Column>

      <Column gap="md" style={styles.section}>
        <SectionHeader title={t('activity.exercises')} counter={derived.cards.length} />
        {derived.cards.map(card => (
          <ActivityExerciseCard
            key={card.key}
            entry={card.entry}
            units={units}
            theme={theme}
            onOpen={effects.openExercise}
          />
        ))}
      </Column>

      {derived.recordRows.length > 0 ? (
        <Column gap="md" style={styles.section}>
          <SectionHeader
            title={t('activity.records')}
            eyebrow={t('activity.setThisSession')}
            counter={derived.recordRows.length}
          />
          <Card tone="accent">
            <Column gap="lg">
              {derived.recordRows.map(record => (
                <Row key={record.key} gap="md" align="center">
                  <Icon name="trophy" size={ICON_SIZE.inline} color={theme.colors.accent} />
                  <Column gap="xxs" style={styles.shrink}>
                    <Txt variant="subhead" weight="700" numberOfLines={1}>
                      {record.name}
                    </Txt>
                    <Txt variant="caption" tone="muted">
                      {record.detail}
                    </Txt>
                  </Column>
                  <Txt variant="headline" weight="700">
                    {record.value}
                  </Txt>
                </Row>
              ))}
            </Column>
          </Card>
        </Column>
      ) : null}
    </>
  );
}
