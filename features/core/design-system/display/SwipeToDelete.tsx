/**
 * Swipe a row left to reveal Delete, the list pattern both platforms' own apps use (Mail,
 * Reminders, Gmail). A swipe only reveals the action; the tap on it deletes, so a scroll that
 * drifts sideways cannot remove anything.
 *
 * `ReanimatedSwipeable` runs the drag on the UI thread. The row keeps its own visible remove
 * control: a gesture is invisible to VoiceOver and TalkBack and to anyone who never tries it,
 * so it is a shortcut, not the only way.
 *
 * Not for virtualised rows that recycle: an open panel would travel with the recycled view.
 * The routine lists are plain views.
 */
import { memo, type ReactNode, useCallback, useRef } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { ICON_SIZE, Icon } from '@/features/core/design-system/icons/icons';
import { Txt } from '@/features/core/design-system/text/Text';
import type { Theme } from '@/features/core/theme';
import { spacing } from '@/features/core/theme';
import { useT } from '@/features/core/translations';

const ACTION_WIDTH = 88;

export const SwipeToDelete = memo(function SwipeToDelete({
  theme,
  onDelete,
  children,
}: {
  theme: Theme;
  onDelete: () => void;
  children: ReactNode;
}) {
  const { t } = useT();
  const swipeable = useRef<SwipeableMethods>(null);

  const remove = useCallback(() => {
    // NOTE: No haptic here: every caller's delete handler already gives one.
    swipeable.current?.close();
    onDelete();
  }, [onDelete]);

  const renderRightActions = useCallback(
    () => (
      <Pressable
        onPress={remove}
        accessibilityRole="button"
        accessibilityLabel={t('common.delete')}
        style={[styles.action, { backgroundColor: theme.colors.danger }]}
      >
        <Icon name="trash" size={ICON_SIZE.inline} color={theme.colors.onDanger} />
        <Txt variant="micro" weight="600" color={theme.colors.onDanger}>
          {t('common.delete')}
        </Txt>
      </Pressable>
    ),
    [remove, t, theme.colors.danger, theme.colors.onDanger],
  );

  return (
    <ReanimatedSwipeable
      ref={swipeable}
      friction={1.5}
      rightThreshold={ACTION_WIDTH / 2}
      overshootRight={false}
      renderRightActions={renderRightActions}
      // NOTE: The row slides over the action, so it needs a surface of its own or the red would show
      // through it before the swipe starts.
      childrenContainerStyle={{ backgroundColor: theme.colors.background }}
    >
      {children}
    </ReanimatedSwipeable>
  );
});

const styles = StyleSheet.create({
  action: {
    width: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
});
