import { ScrollView, View } from 'react-native';
import {
  EmptyState,
  ErrorState,
  SCROLL_INSETS,
  ScreenHeader,
  SectionHeader,
  SegmentedControl,
  SkeletonCard,
  useStyles,
} from '@/features/core/design-system';
import { HeaderToolbar, headerAction } from '@/features/core/navigation';
import { useAppTheme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';
import { LiveResumeCard } from '@/features/home/ui/components/ResumeCard/LiveResumeCard';
import { RoutineListItem } from '@/features/home/ui/components/RoutineListItem/RoutineListItem';
import { StartEmptyWorkout } from '@/features/home/ui/components/StartEmptyWorkout/StartEmptyWorkout';
import { useWorkoutTabPageLogic } from '@/features/home/ui/pages/WorkoutTabPage/WorkoutTabPage.logic';
import { createStyles } from '@/features/home/ui/pages/WorkoutTabPage/WorkoutTabPage.style';

/**
 * The Workout tab: the front door to training. A scroll view, not a list: routines are local and
 * a keen lifter has a dozen, and virtualising that means a recycle pool larger than the content.
 * Home owns history; this tab answers "which routines do I have, and when did I last do each?".
 */
export function WorkoutTabPage() {
  const { state, derived, effects } = useWorkoutTabPageLogic();
  const { t } = useT();
  const theme = useAppTheme();
  const styles = useStyles(createStyles);

  return (
    <>
      <ScreenHeader title={t('workout.title')} largeTitle />
      <HeaderToolbar placement="right">
        {headerAction({ action: 'add', onPress: effects.openNewRoutine, t, label: 'workout.newRoutine' })}
      </HeaderToolbar>

      <ScrollView
        {...SCROLL_INSETS}
        contentContainerStyle={[styles.content, { paddingBottom: state.bottomSpace }]}
        keyboardShouldPersistTaps="handled"
      >
        {state.resuming ? <LiveResumeCard onPress={effects.openSession} /> : null}

        {state.resuming ? null : <StartEmptyWorkout onStarted={effects.openSession} />}

        <View style={styles.section}>
          <SectionHeader
            title={t('workout.yourRoutines')}
            eyebrow={t('workoutTab.saved')}
            {...(state.count > 0 ? { counter: state.count } : {})}
            action={{ label: t('workoutTab.new'), onPress: effects.openNewRoutine }}
          />
          {state.showOrder ? (
            <View style={styles.order}>
              <SegmentedControl segments={derived.orderSegments} value={state.order} onChange={effects.setOrder} />
            </View>
          ) : null}

          {state.isLoading ? (
            <SkeletonCard lines={2} />
          ) : state.error ? (
            <ErrorState error={state.error} onRetry={effects.retry} title={t('workoutTab.routinesError')} />
          ) : state.isEmpty ? (
            <EmptyState
              title={t('workoutTab.emptyTitle')}
              message={t('workoutTab.emptyMessage')}
              icon="dumbbell"
              actionLabel={t('workoutTab.createRoutine')}
              onAction={effects.openNewRoutine}
              compact
            />
          ) : (
            <View>
              {state.sorted.map((routine, index) => (
                <RoutineListItem
                  key={routine.id}
                  routine={routine}
                  theme={theme}
                  t={t}
                  locale={state.locale}
                  first={index === 0}
                  onOpen={effects.openRoutine}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
}
