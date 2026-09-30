import { Stack } from 'expo-router';
import { ScrollView, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  ConfirmDialog,
  EmptyState,
  Icon,
  IconButton,
  MetaLine,
  OverlaySurface,
  Row,
  ScreenHeader,
  SectionHeader,
  SkeletonCard,
  Txt,
  useStyles,
} from '@/features/core/design-system';
import { useAppTheme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';
import { ExerciseBlock } from '@/features/workouts/ui/components/ExerciseBlock/ExerciseBlock';
import { RemoveExerciseDialog } from '@/features/workouts/ui/components/RemoveExerciseDialog/RemoveExerciseDialog';
import { RestDock } from '@/features/workouts/ui/components/RestDock/RestDock';
import { SessionProgressBar } from '@/features/workouts/ui/components/SessionProgressBar/SessionProgressBar';
import { SessionTotals } from '@/features/workouts/ui/components/SessionTotals/SessionTotals';
import { useSessionPageLogic } from '@/features/workouts/ui/pages/SessionPage/SessionPage.logic';
import { createStyles } from '@/features/workouts/ui/pages/SessionPage/SessionPage.style';

/** Immersive: the bar is the only chrome, and its exits are explicit buttons. */
const IMMERSIVE = { gestureEnabled: false, headerShown: false } as const;
/** An ordinary pushed screen again once the workout is over, so the swipe back works. */
const ORDINARY = { gestureEnabled: true } as const;

/**
 * The live workout. Headerless while it restores, because what it restores is almost always the
 * live workout, which is headerless: a bar that appears and vanishes reads as a glitch. With no
 * session (a cold deep link, or a workout ended elsewhere) it is an ordinary empty screen, still
 * headerless while it is being popped after a finish or a discard here, since a header on a
 * screen mid-removal crashes Android's stack.
 *
 * The away notice states stored facts: the clock stopped while the app was away and the rest
 * resumed from its deadline. The footer's blur is a sibling of its buttons, never their parent:
 * a blur that contains them re-blurs on every press-state change.
 */
export function SessionPage() {
  const { state, derived, effects } = useSessionPageLogic();
  const { t } = useT();
  const theme = useAppTheme();
  const styles = useStyles(createStyles);
  const { session } = state;

  if (!state.hydrated) {
    return (
      <View style={styles.root}>
        <ScreenHeader title={t('tabs.workout')} shown={false} />
        <View style={derived.restoringInset}>
          <SkeletonCard lines={3} />
        </View>
      </View>
    );
  }

  if (session === null) {
    const leaving = state.discarding || state.finishing;
    return (
      <View style={styles.root}>
        <ScreenHeader title={t('tabs.workout')} shown={!leaving} />
        {leaving ? null : <Stack.Screen options={ORDINARY} />}
        <EmptyState
          title={t('session.noneTitle')}
          message={t('session.noneMessage')}
          icon="workout"
          actionLabel={t('session.pickRoutine')}
          onAction={effects.pickRoutine}
          style={styles.empty}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={IMMERSIVE} />

      <View style={[styles.bar, derived.barInset]}>
        <OverlaySurface theme={theme} edge="bottom" />
        <Row gap="sm" align="center">
          <IconButton
            name="close"
            variant="surface"
            size={20}
            accessibilityLabel={t('session.leave')}
            accessibilityHint={t('session.leaveHint')}
            onPress={effects.leave}
          />
          <View style={styles.barTitles}>
            <Txt variant="label" weight="700" numberOfLines={1}>
              {session.routineName}
            </Txt>
            <MetaLine items={derived.barMeta} theme={theme} />
          </View>
          <Chip
            size="sm"
            label={t(derived.running ? 'session.running' : 'session.paused')}
            icon={derived.running ? 'pause' : 'play'}
            onPress={effects.togglePause}
          />
          <IconButton
            name="stop"
            variant="danger"
            size={20}
            weighty
            accessibilityLabel={t('session.finishA11y')}
            onPress={effects.askFinish}
          />
        </Row>
        <View style={styles.barGap} />
        <SessionProgressBar ratio={derived.progress.ratio} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, derived.contentInset]} keyboardShouldPersistTaps="handled">
        {state.persistFailed ? (
          <View style={styles.section}>
            <Card tone="outline" style={styles.dangerCard}>
              <Row gap="md" align="center">
                <Icon name="warning" size={20} color={theme.colors.danger} />
                <View style={styles.flex}>
                  <Txt variant="strong" weight="700">
                    {t('misc.notSaving')}
                  </Txt>
                  <Txt variant="caption" tone="muted">
                    {t('misc.persistFailedBody')}
                  </Txt>
                </View>
              </Row>
            </Card>
          </View>
        ) : null}

        {state.actionError !== null ? (
          <View style={styles.section}>
            <Card tone="outline" style={styles.warningCard}>
              <Txt variant="strong" weight="700">
                {t('misc.couldNotSaveThat')}
              </Txt>
              <Txt variant="caption" tone="muted" style={styles.errorDetail}>
                {state.actionError}
              </Txt>
            </Card>
          </View>
        ) : null}

        {derived.showAwayNotice ? (
          <View style={styles.section}>
            <Card tone="sunken">
              <Row gap="md" align="center">
                <Icon name="clock" size={18} color={theme.colors.textMuted} />
                <Txt variant="caption" tone="muted" style={styles.flex}>
                  {derived.awayNotice}
                </Txt>
              </Row>
            </Card>
          </View>
        ) : null}

        <View style={styles.section}>
          <Card>
            <SessionTotals
              elapsed={session.elapsedSeconds}
              sets={derived.progress.completed}
              planned={derived.progress.planned}
              volumeKg={derived.progress.volumeKg}
              units={state.units}
            />
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader
            title={t('session.exercises')}
            eyebrow={derived.exercisesEyebrow}
            action={{ label: t('common.add'), onPress: effects.addExercise }}
          />
          {derived.blocks.length === 0 ? (
            <EmptyState
              title={t('session.emptyTitle')}
              message={t('session.emptyMessage')}
              icon="dumbbell"
              actionLabel={t('session.addAnExercise')}
              onAction={effects.addExercise}
              compact
            />
          ) : (
            <View style={styles.blocks}>
              {derived.blocks.map(block => (
                <ExerciseBlock
                  key={block.key}
                  entry={block.entry}
                  entryIndex={block.entryIndex}
                  targetSetIndex={block.targetSetIndex}
                  units={state.units}
                  theme={theme}
                  isCurrent={block.isCurrent}
                  previousLabel={block.previousLabel}
                  previousWhen={block.previousWhen}
                  onOpenSet={effects.openSet}
                  onToggleSet={effects.toggleSet}
                  onAddSet={effects.addSet}
                  onSkip={effects.skip}
                  onRequestRemove={effects.requestRemove}
                  onFocus={effects.focus}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, derived.footerInset]} onLayout={effects.footerLayout}>
        <OverlaySurface theme={theme} />
        <Row gap="md" align="center">
          <Button label={t('session.discard')} variant="ghost" size="md" onPress={effects.askDiscard} />
          <Button
            label={t('session.finish')}
            variant="primary"
            size="md"
            fullWidth
            loading={state.finishing}
            weighty
            onPress={effects.askFinish}
          />
        </Row>
      </View>

      {derived.restShown ? (
        <RestDock
          remainingSeconds={state.restRemaining}
          totalSeconds={state.restTotal}
          bottom={derived.dockBottom}
          onHeight={effects.dockHeight}
          onSkip={effects.skipRest}
          onAdjust={effects.adjustRest}
        />
      ) : null}

      {state.confirmDiscard ? (
        <ConfirmDialog
          visible={!state.discarding}
          title={t('session.discardTitle')}
          message={derived.discardMessage}
          confirmLabel={t('session.discardConfirm')}
          cancelLabel={t('common.cancel')}
          destructive
          onConfirm={effects.discard}
          onCancel={effects.cancelDiscard}
        />
      ) : null}

      {state.removing !== null ? (
        <RemoveExerciseDialog
          exerciseName={derived.removingName}
          completedSets={derived.removingSets}
          onConfirm={effects.confirmRemove}
          onRequestClose={effects.cancelRemove}
        />
      ) : null}
    </View>
  );
}
