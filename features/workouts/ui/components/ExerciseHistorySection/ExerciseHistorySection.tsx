import { View } from 'react-native';
import {
  Card,
  Stack as Column,
  ICON_SIZE,
  Icon,
  LineChart,
  MetaLine,
  Row,
  SectionHeader,
  SkeletonCard,
  Txt,
  useStyles,
} from '@/features/core/design-system';
import { useAppTheme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';
import { ExerciseHistoryRow } from '@/features/exercises/ui/components/ExerciseHistoryRow/ExerciseHistoryRow';
import { useExerciseHistorySectionLogic } from '@/features/exercises/ui/components/ExerciseHistorySection/ExerciseHistorySection.logic';
import { createStyles } from '@/features/exercises/ui/components/ExerciseHistorySection/ExerciseHistorySection.style';

/**
 * The exercise detail's history: when it was last done, the heaviest weight per session, the
 * latest sessions (each opens its activity) and the personal bests. Rendered as siblings of the
 * detail's other sections, so the page's gap spaces them.
 */
export function ExerciseHistorySection({ exerciseId }: { exerciseId: string | null }) {
  const { state, derived, effects } = useExerciseHistorySectionLogic(exerciseId);
  const { t } = useT();
  const theme = useAppTheme();
  const styles = useStyles(createStyles);

  return (
    <>
      <Column gap="lg" style={styles.section}>
        <SectionHeader title={t('exerciseDetail.yourHistory')} />
        {state.isLoading ? (
          <SkeletonCard lines={2} />
        ) : !state.logged ? (
          <Card tone="sunken">
            <Row gap="md" align="center">
              <Icon name="target" size={ICON_SIZE.inline} color={theme.colors.textFaint} />
              <Txt variant="body" tone="muted" style={styles.flex}>
                {t('exerciseDetail.neverLogged')}
              </Txt>
            </Row>
          </Card>
        ) : (
          <>
            {derived.lastPerformed === null ? null : <MetaLine items={derived.lastPerformed} theme={theme} />}
            {derived.showChart ? (
              <Card>
                <SectionHeader
                  title={t('exerciseDetail.heaviestWeight')}
                  eyebrow={t('exerciseDetail.perSession')}
                  style={styles.chartTitle}
                />
                <LineChart
                  points={derived.chartPoints}
                  theme={theme}
                  format={effects.formatChartWeight}
                  accessibilityLabel={derived.chartA11y}
                />
              </Card>
            ) : null}
          </>
        )}
      </Column>

      {!state.isLoading && state.logged ? (
        <View>
          {state.sessions.map((session, index) => (
            <ExerciseHistoryRow
              key={session.activityId}
              session={session}
              units={state.units}
              theme={theme}
              topDivider={index > 0}
              onOpen={effects.openSession}
            />
          ))}
        </View>
      ) : null}

      {derived.recordRows.length > 0 ? (
        <Column gap="md" style={styles.section}>
          <SectionHeader title={t('exerciseDetail.records')} eyebrow={t('exerciseDetail.personalBests')} />
          <Card tone="accent">
            <Column gap="lg">
              {derived.recordRows.map(record => (
                <Row key={record.kind} gap="md" align="center">
                  <Icon name="trophy" size={ICON_SIZE.inline} color={theme.colors.accent} />
                  <Txt variant="label" tone="muted" style={styles.flex}>
                    {record.label}
                  </Txt>
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
