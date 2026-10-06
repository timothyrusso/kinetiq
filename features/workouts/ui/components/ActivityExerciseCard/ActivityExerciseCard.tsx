import { memo } from 'react';
import { Pressable, View } from 'react-native';
import {
  Badge,
  Card,
  Stack as Column,
  Divider,
  ICON_SIZE,
  Icon,
  MetaLine,
  Row,
  TagRow,
  Txt,
  useStyles,
} from '@/features/core/design-system';
import { spacing, type Theme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';
import type { UnitSystem } from '@/features/core/utils';
import type { StrengthEntry } from '@/features/workouts/domain/schemas/StrengthEntrySchema';
import { useActivityExerciseCardLogic } from '@/features/workouts/ui/components/ActivityExerciseCard/ActivityExerciseCard.logic';
import { createStyles } from '@/features/workouts/ui/components/ActivityExerciseCard/ActivityExerciseCard.style';

/**
 * One exercise's sets in a recorded workout, in the columns its tracking type recorded. The head
 * is the way into the exercise's own page (its history, its chart, its records): a logged workout
 * is where "how is my squat going" starts, since the library is reached only to pick an exercise.
 */
export const ActivityExerciseCard = memo(function ActivityExerciseCard({
  entry,
  units,
  theme,
  onOpen,
}: {
  entry: StrengthEntry;
  units: UnitSystem;
  theme: Theme;
  onOpen: (exerciseId: string) => void;
}) {
  const { derived, effects } = useActivityExerciseCardLogic(entry, units, onOpen);
  const { t } = useT();
  const styles = useStyles(createStyles);

  return (
    <Card padding="md">
      <Column gap="md">
        <Row gap="md" align="center">
          <Pressable
            onPress={effects.open}
            accessibilityRole="button"
            accessibilityHint={t('activity.openExerciseHint')}
            style={derived.headStyle}
          >
            <Column gap="xs">
              <Row gap="xs" align="center">
                <Txt variant="subhead" weight="700" numberOfLines={2} style={styles.shrink}>
                  {entry.exerciseName}
                </Txt>
                <Icon name="chevronRight" size={ICON_SIZE.inline} color={theme.colors.textFaint} />
              </Row>
              <MetaLine items={derived.meta} theme={theme} wrap />
              <TagRow tags={derived.tags} theme={theme} />
            </Column>
          </Pressable>
          <Badge label={derived.badge.label} tone={derived.badge.tone} />
        </Row>

        {derived.hasSets ? (
          <>
            <Divider />
            <Row gap="md" align="center" style={styles.headRow}>
              <Txt variant="micro" tone="faint" style={styles.narrow}>
                {t('activity.colSet')}
              </Txt>
              {derived.columns.weight === null ? null : (
                <Txt variant="micro" tone="faint" style={styles.cell}>
                  {t(derived.columns.weight)}
                </Txt>
              )}
              <Txt variant="micro" tone="faint" style={styles.cell}>
                {t(derived.columns.value)}
              </Txt>
              {derived.hasRpe ? (
                <Txt variant="micro" tone="faint" align="right" style={styles.narrow}>
                  {t('activity.colRpe')}
                </Txt>
              ) : null}
              {derived.columns.estimate ? (
                <Txt variant="micro" tone="faint" align="right" style={styles.wide}>
                  {t('activity.colE1rm')}
                </Txt>
              ) : null}
            </Row>
            {derived.sets.map((set, index) => (
              <View key={set.key}>
                {index > 0 ? <Divider inset={spacing.sm} /> : null}
                <View
                  accessible
                  accessibilityRole="summary"
                  accessibilityLabel={set.accessibilityLabel}
                  style={[styles.dataRow, set.completed ? null : styles.dimmed]}
                >
                  <Txt variant="caption" weight="700" tone="muted" style={styles.narrow}>
                    {set.number}
                  </Txt>
                  {set.weight === null ? null : (
                    <Txt variant="body" weight="700" style={styles.cell}>
                      {set.weight}
                    </Txt>
                  )}
                  <Txt variant="body" weight={set.weight === null ? '700' : undefined} style={styles.cell}>
                    {set.value}
                  </Txt>
                  {derived.hasRpe ? (
                    <Txt variant="body" align="right" style={styles.narrow}>
                      {set.rpe}
                    </Txt>
                  ) : null}
                  {set.oneRepMax === null ? null : (
                    <Txt variant="caption" tone="muted" align="right" style={styles.wide}>
                      {set.oneRepMax}
                    </Txt>
                  )}
                </View>
              </View>
            ))}
          </>
        ) : null}

        {entry.notes ? (
          <>
            <Divider />
            <Txt variant="caption" tone="muted">
              {entry.notes}
            </Txt>
          </>
        ) : null}
      </Column>
    </Card>
  );
});
