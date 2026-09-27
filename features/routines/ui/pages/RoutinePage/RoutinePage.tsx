import { ScrollView, View } from 'react-native';
import {
  Button,
  Card,
  Stack as Column,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  ICON_SIZE,
  Icon,
  MetaLine,
  Row,
  ScreenHeader,
  SectionHeader,
  SkeletonList,
  StatTile,
  Txt,
  useStyles,
} from '@/features/core/design-system';
import { HeaderToolbar, headerAction, headerMenu } from '@/features/core/navigation';
import { useAppTheme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';
import { compactNumber, weightUnit, weightValue } from '@/features/core/utils';
import type { WorkoutLauncher } from '@/features/routines/domain/entities/WorkoutLauncher';
import { RoutineItemRow } from '@/features/routines/ui/components/RoutineItemRow/RoutineItemRow';
import { useRoutinePageLogic } from '@/features/routines/ui/pages/RoutinePage/RoutinePage.logic';
import { createStyles } from '@/features/routines/ui/pages/RoutinePage/RoutinePage.style';

/**
 * A saved routine: what is in it, when it last ran, and the way into a workout from it. Reached
 * from the Workout tab and the pickers, and in place of the builder that just created it.
 */
export function RoutinePage({ launcher }: { launcher: WorkoutLauncher }) {
  const { state, derived, effects } = useRoutinePageLogic(launcher);
  const { t } = useT();
  const theme = useAppTheme();
  const styles = useStyles(createStyles);
  const { routine, units } = state;

  if (state.isLoading) {
    return (
      <>
        <ScreenHeader title={t('routine.title')} />
        <View style={styles.loading}>
          <SkeletonList rows={6} />
        </View>
      </>
    );
  }

  if (state.error !== null) {
    return (
      <>
        <ScreenHeader title={t('routine.title')} />
        <View style={styles.centered}>
          <ErrorState error={state.error} onRetry={effects.retry} title={t('routine.readError')} />
        </View>
      </>
    );
  }

  if (routine === null || state.missing) {
    return (
      <>
        <ScreenHeader title={t('routine.title')} />
        <View style={styles.centered}>
          <EmptyState
            icon="listAdd"
            title={t('routine.goneTitle')}
            message={t('routine.goneMessage')}
            actionLabel={t('routine.backToWorkouts')}
            onAction={effects.backToWorkouts}
          />
        </View>
      </>
    );
  }

  const count = derived.items.length;

  return (
    <>
      <ScreenHeader title={routine.name} />
      <HeaderToolbar placement="right">
        {headerMenu({ action: 'more', t, label: 'routine.options', items: derived.options })}
        {headerAction({ action: 'play', onPress: effects.startFromHeader, t, label: 'routine.start' })}
      </HeaderToolbar>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, derived.contentStyle]}>
        <Column gap="lg" style={styles.gutter}>
          <MetaLine items={derived.summary} theme={theme} wrap />

          <View style={styles.stats}>
            {derived.volumeKg === 0 ? null : (
              <StatTile
                label={t('routine.plannedVolume')}
                value={compactNumber(weightValue(derived.volumeKg, units))}
                unit={weightUnit(units)}
              />
            )}
            <StatTile label={t('routine.estTime')} value={`~${derived.minutes}`} unit="min" />
            <StatTile label={t('routine.trained')} value={`${routine.timesCompleted}×`} />
          </View>

          {state.failed !== null ? (
            <Card tone="sunken" padding="md">
              <Row gap="sm" align="start">
                <Icon name="warning" size={ICON_SIZE.inline} color={theme.colors.warning} />
                <Txt variant="body" style={styles.flex}>
                  {state.failed}
                </Txt>
              </Row>
            </Card>
          ) : null}
        </Column>

        {count === 0 ? (
          <EmptyState
            icon="listAdd"
            title={t('routine.emptyTitle')}
            message={t('routine.emptyMessage')}
            actionLabel={t('exercises.addExercise')}
            onAction={effects.addExercise}
          />
        ) : (
          <Column gap="md">
            <SectionHeader
              style={styles.gutter}
              title={t('routine.exercises')}
              eyebrow={`${count} ${t('routine.rowWord', { count })}`}
              action={{ label: t('common.add'), onPress: effects.addExercise }}
            />
            <View>
              {derived.items.map((item, index) => (
                <RoutineItemRow
                  key={item.id}
                  item={item}
                  snapshot={state.snapshots.get(item.exerciseId) ?? null}
                  units={units}
                  theme={theme}
                  index={index}
                  count={count}
                  onOpen={effects.openItem}
                  onMove={effects.move}
                  onRemove={effects.remove}
                />
              ))}
            </View>
          </Column>
        )}

        <View style={styles.gutter}>
          <Button
            label={t(state.liveSession ? 'routine.openWorkout' : 'routine.start')}
            icon={state.liveSession ? 'arrowUpRight' : 'play'}
            size="lg"
            weighty
            fullWidth
            loading={state.starting}
            onPress={effects.primary}
            accessibilityHint={t(state.liveSession ? 'routine.openHint' : 'routine.startHint')}
          />
        </View>
      </ScrollView>

      {state.confirmDelete ? (
        <ConfirmDialog
          visible
          title={t('routine.deleteTitle', { name: routine.name })}
          message={derived.deleteMessage}
          confirmLabel={t('routine.deleteRoutine')}
          cancelLabel={t('common.cancel')}
          destructive
          onCancel={effects.cancelDelete}
          onConfirm={effects.doDelete}
        />
      ) : null}
    </>
  );
}
