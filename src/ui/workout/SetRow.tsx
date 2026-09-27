import { memo } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import type { StrengthSet } from '@/domain/types';
import type { Theme } from '@/theme/theme';
import type { UnitSystem } from '@/utils/format';
import { radius, spacing, touchTarget } from '@/theme/tokens';
import { formatWeight, trimNumber, weightUnit } from '@/utils/format';
import { IconButton } from '@/ui/controls/IconButton';
import { Row } from '@/ui/layout';
import { MetricLabel, Txt } from '@/ui/Text';
import { useT } from '@/i18n/useT';

/**
 * One planned set: a target on the left, a checkbox on the right, and the checkbox is the
 * important half.
 *
 * `isTarget` outlines the next unticked set, which answers "which one am I on?" without
 * making anyone count: the single most common glance mid-set. It is an outline, not a
 * filled row, because a filled row would compete with the filled *done* state.
 */
export const SetRow = memo(function SetRow({
  entryIndex,
  setIndex,
  set,
  units,
  theme,
  isTarget,
  onOpen,
  onToggle,
}: {
  entryIndex: number;
  setIndex: number;
  set: StrengthSet;
  units: UnitSystem;
  theme: Theme;
  /** The next unticked set: the one the lifter is working toward right now. */
  isTarget: boolean;
  onOpen: (entryIndex: number, setIndex: number) => void;
  onToggle: (entryIndex: number, setIndex: number) => void;
}) {
  const { t } = useT();
  const weightText =
    set.weightKg === 0 ? t('setRow.bodyweight') : formatWeight(set.weightKg, units);
  const open = () => {
    onOpen(entryIndex, setIndex);
  };

  return (
    <Row gap="md" align="center" style={styles.setRow}>
      <View
        style={[
          styles.setNumber,
          {
            backgroundColor: set.completed ? theme.colors.accent : theme.colors.canvas,
            borderColor: set.completed ? 'transparent' : theme.colors.border,
          },
        ]}
      >
        {/* On the filled accent disc the number takes the accent's own ink: accent on accent
            was a blank disc once the set was ticked. */}
        <Txt
          variant="micro"
          weight="700"
          tone="muted"
          color={set.completed ? theme.colors.onAccent : undefined}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {setIndex + 1}
        </Txt>
      </View>

      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={t('setRow.setRepsAt', {
          n: setIndex + 1,
          reps: set.reps,
          weight: weightText,
        })}
        accessibilityHint={t('setRow.opensEditor')}
        style={({ pressed }) => [
          styles.setValue,
          {
            backgroundColor: pressed ? theme.colors.surfacePressed : theme.colors.canvas,
            borderColor: isTarget && !set.completed ? theme.colors.accent : theme.colors.border,
          },
        ]}
      >
        <MetricLabel label={t('setRow.reps')} />
        <Txt
          variant="subhead"
          weight="700"
          tone={set.completed ? 'muted' : 'default'}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {set.reps}
        </Txt>
      </Pressable>

      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={t('setRow.setWeight', { n: setIndex + 1, weight: weightText })}
        accessibilityHint={t('setRow.opensEditor')}
        style={({ pressed }) => [
          styles.setValue,
          {
            backgroundColor: pressed ? theme.colors.surfacePressed : theme.colors.canvas,
            borderColor: isTarget && !set.completed ? theme.colors.accent : theme.colors.border,
          },
        ]}
      >
        <MetricLabel label={t('setRow.weightIn', { unit: weightUnit(units) })} />
        <Txt
          variant="subhead"
          weight="700"
          tone={set.completed ? 'muted' : 'default'}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {set.weightKg === 0 ? t('setRow.bodyweightShort') : trimNumber(set.weightKg)}
        </Txt>
      </Pressable>

      <IconButton
        name={set.completed ? 'checkCircle' : 'check'}
        variant={set.completed ? 'accent' : 'plain'}
        size={24}
        // The session screen plays the haptic: ticking is a signature moment, un-ticking is not.
        silent
        accessibilityLabel={t(set.completed ? 'setRow.markNotDone' : 'setRow.completeSet', {
          n: setIndex + 1,
        })}
        onPress={() => {
          onToggle(entryIndex, setIndex);
        }}
      />
    </Row>
  );
});

const styles = StyleSheet.create({
  setRow: { paddingVertical: spacing.xs },
  setNumber: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setValue: {
    flex: 1,
    minWidth: 0,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: touchTarget,
    justifyContent: 'center',
  },
} satisfies Record<string, ViewStyle>);
