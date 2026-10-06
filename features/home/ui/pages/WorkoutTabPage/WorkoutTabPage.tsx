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
import { HeaderToolbar, headerMenu } from '@/features/core/navigation';
import { useAppTheme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';
import { LiveResumeCard } from '@/features/home/ui/components/ResumeCard/LiveResumeCard';
import { RoutineListItem } from '@/features/home/ui/components/RoutineListItem/RoutineListItem';
import { StartChoice } from '@/features/home/ui/components/StartChoice/StartChoice';
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
      <HeaderToolbar placement="right">{headerMenu({ action: 'add', t, items: derived.startMenu })}</HeaderToolbar>

      <ScrollView
        {...SCROLL_INSETS}
        contentContainerStyle={[styles.content, { paddingBottom: state.bottomSpace }]}
        keyboardShouldPersistTaps="handled"
      >
        {state.resuming ? <LiveResumeCard onPress={effects.openSession} /> : null}

        <StartChoice
          startDisabled={state.resuming}
          onStartEmpty={effects.startEmpty}
          onNewRoutine={effects.openNewRoutine}
        />

        <View style={styles.section}>
          <SectionHeader
            title={t('workout.yourRoutines')}
            eyebrow={t('workoutTab.saved')}
            {...(state.count > 0 ? { counter: state.count } : {})}
          />
          {state.showOrder ? (
            <View style={styles.order}>
              <SegmentedControl segments={derived.orderSegments} value={state.order} onChange={effects.setOrder} />
            </View>
          ) : null}

          {state.isLoading ? (
            <SkeletonCard lines={2} />
          ) : state.error ? (
            <ErrorState onRetry={effects.retry} title={t('workoutTab.routinesError')} />
          ) : state.isEmpty ? (
            <EmptyState
              title={t('workoutTab.emptyTitle')}
              message={t('workoutTab.emptyMessage')}
              icon="dumbbell"
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
