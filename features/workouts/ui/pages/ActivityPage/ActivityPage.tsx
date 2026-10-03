import { Stack } from 'expo-router';
import { ScrollView, View } from 'react-native';
import {
  ACTIVITY_ICON,
  Stack as Column,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  IconTile,
  MetaLine,
  Row,
  ScreenHeader,
  SkeletonCard,
  useStyles,
} from '@/features/core/design-system';
import { HeaderToolbar, headerAction } from '@/features/core/navigation';
import { useAppTheme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';
import { ActivityStrength } from '@/features/workouts/ui/components/ActivityStrength/ActivityStrength';
import { useActivityPageLogic } from '@/features/workouts/ui/pages/ActivityPage/ActivityPage.logic';
import { createStyles } from '@/features/workouts/ui/pages/ActivityPage/ActivityPage.style';

/** A fade rather than a push: a slide would flash the previous list's rows past the hero. */
const SCREEN_OPTIONS = { animation: 'fade_from_bottom' } as const;

/**
 * Workout detail: the summary, each exercise's sets, and the records the workout set. Absence is
 * rendered, never invented: a bodyweight workout has no volume, a workout nobody added exercises
 * to has no sets, and each gap says why that is normal. The hero is one accessibility element, so
 * it is read as a sentence; the kind is the tile's glyph, since the title already names it. The
 * delete is destructive, tinted as danger and behind the native confirm.
 */
export function ActivityPage() {
  const { state, derived, effects } = useActivityPageLogic();
  const { t } = useT();
  const theme = useAppTheme();
  const styles = useStyles(createStyles);
  const { activity } = state;

  return (
    <>
      <Stack.Screen options={SCREEN_OPTIONS} />
      <ScreenHeader title={derived.title} />
      {activity ? (
        <HeaderToolbar placement="right">
          {headerAction({
            action: 'delete',
            onPress: effects.askDelete,
            t,
            label: 'activity.delete',
            tint: theme.colors.danger,
          })}
        </HeaderToolbar>
      ) : null}
      <ScrollView contentContainerStyle={[styles.content, derived.contentInset]} keyboardShouldPersistTaps="handled">
        {state.isLoading ? (
          <Column gap="lg">
            <SkeletonCard lines={3} />
            <SkeletonCard lines={5} />
          </Column>
        ) : state.error !== null ? (
          <ErrorState onRetry={effects.retry} title={t('activity.loadError')} />
        ) : activity && derived.hero ? (
          <View>
            <View
              accessible
              accessibilityRole="summary"
              accessibilityLabel={derived.hero.accessibilityLabel}
              style={styles.hero}
            >
              <Row gap="md" align="center">
                <IconTile
                  name={ACTIVITY_ICON[activity.kind]}
                  color={theme.colors.accent}
                  background={theme.colors.accentSoft}
                />
                <MetaLine items={derived.hero.when} theme={theme} wrap style={styles.flex} />
              </Row>
            </View>

            {activity.strength ? (
              <ActivityStrength activity={activity} units={state.units} theme={theme} />
            ) : (
              <EmptyState
                style={styles.empty}
                title={t('activity.emptyTitle')}
                message={t('activity.emptyMessage')}
                icon="warning"
                compact
              />
            )}
          </View>
        ) : null}
      </ScrollView>

      {state.confirmingDelete && activity ? (
        <ConfirmDialog
          visible={!state.deleting}
          title={t('activity.deleteTitle')}
          message={derived.deleteMessage}
          confirmLabel={t('activity.deleteConfirm')}
          cancelLabel={t('common.cancel')}
          destructive
          onConfirm={effects.confirmDelete}
          onCancel={effects.cancelDelete}
        />
      ) : null}
    </>
  );
}
