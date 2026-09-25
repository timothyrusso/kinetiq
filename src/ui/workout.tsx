/**
 * Session presentation: the set rows, the exercise block and the rest dock.
 *
 * Lives in `ui/` beside `rows.tsx` rather than in the route file, for the same reason the
 * routine and exercise rows do: these are shaped by the domain (a set is reps × weight × a
 * completed flag, not a generic list item) but hold no state of their own. Keeping them
 * here is what lets `app/workout/session.tsx` stay a screen: it owns navigation and the
 * session engine's calls; these own pixels.
 *
 * ## Why there is no keyboard in the list
 *
 * Weight and reps change with `Stepper`, never a text field. A keyboard over a set list is
 * the worst possible thing in this app: it covers the two rows you are about to tick, and
 * it appears while someone is holding a barbell. The steppers step in the units people
 * actually own (`weightStep`), so 60 → 62.5 is one press in kilograms and 135 → 137.5 is
 * one press in pounds.
 */
import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { StrengthEntry, StrengthSet } from '@/domain/types';
import type { Theme } from '@/theme/theme';
import type { UnitSystem } from '@/utils/format';
import { radius, screenGutter, spacing, touchTarget, z } from '@/theme/tokens';
import {
  formatTimer,
  formatWeight,
  trimNumber,
  weightDisplayValue,
  weightFromDisplayValue,
  weightStep,
  weightUnit,
} from '@/utils/format';
import { Button } from '@/ui/controls/Button';
import { withAlpha } from '@/utils/color';
import { IconButton } from '@/ui/controls/IconButton';
import { Row } from '@/ui/layout';
import { Stepper } from '@/ui/controls/Stepper';
import { MetricLabel, Txt } from './Text';
import { FormFooter, FormSection } from './FormSheet';
import { ConfirmDialog } from './controls/ConfirmDialog';
import { useT } from '@/i18n/useT';
import { useAppTheme } from '@/theme/theme';
import { usePulse } from './animation';
import { CellText } from './CellText';
import { Icon } from './icons';
import { MetaLine, type MetaItem } from './display';

/**
 * One planned set: a target on the left, a checkbox on the right, and the checkbox is the
 * important half.
 *
 * `isTarget` outlines the next unticked set, which answers "which one am I on?" without
 * making anyone count: the single most common glance mid-set. It is an outline, not a
 * filled row, because a filled row would compete with the filled *done* state.
 */
const SetRow = memo(function SetRow({
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
        weighty
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

/**
 * The exercise being trained, with its sets.
 *
 * The header carries the two things a lifter checks between sets: what they did last time,
 * and how many sets are banked. Everything else: muscle group, equipment, instructions, * is on the exercise's own screen; repeating it here would push the set rows below the
 * fold, and the set rows are where the tapping happens.
 *
 * A cue from the routine shows as plain text and is *not* editable here. The session engine
 * stores entry notes but exposes no per-entry writer, and inventing one so a pencil icon
 * could open a keyboard over a set list would be the wrong trade twice over. Cues are
 * edited on the routine.
 */
export const ExerciseBlock = memo(function ExerciseBlock({
  entry,
  entryIndex,
  targetSetIndex,
  units,
  theme,
  previousLabel,
  previousWhen,
  isCurrent,
  onOpenSet,
  onToggleSet,
  onAddSet,
  onSkip,
  onRequestRemove,
  onFocus,
}: {
  entry: StrengthEntry;
  entryIndex: number;
  targetSetIndex: number | null;
  units: UnitSystem;
  theme: Theme;
  /**
   * Rendered verbatim. The caller decides whether to say "Last time 82.5 kg × 5", "No
   * previous sessions yet", or nothing, because only the caller knows whether the history
   * query has answered: and "no previous data" before it has is a lie.
   */
  previousLabel: string | null;
  /** When that was ("3w ago"), or `null` when there is no previous session to date. */
  previousWhen: string | null;
  isCurrent: boolean;
  onOpenSet: (entryIndex: number, setIndex: number) => void;
  onToggleSet: (entryIndex: number, setIndex: number) => void;
  onAddSet: (entryIndex: number) => void;
  onSkip: (entryIndex: number) => void;
  onRequestRemove: (entryIndex: number) => void;
  onFocus: (entryIndex: number) => void;
}) {
  const { t } = useT();
  const done = entry.sets.filter((set) => set.completed).length;
  const allDone = done === entry.sets.length && entry.sets.length > 0;
  // Built from the two strings here, not handed in as an array: the screen re-renders every
  // second for its clock, and a fresh array per tick would defeat this block's `memo`.
  const previous = useMemo<MetaItem[]>(() => {
    if (previousLabel === null) return [];
    if (previousWhen === null) return [{ icon: 'info', label: previousLabel }];
    return [
      { icon: 'dumbbell', label: previousLabel },
      { icon: 'calendar', label: previousWhen },
    ];
  }, [previousLabel, previousWhen]);

  return (
    <View
      style={[
        styles.block,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.surfaceSkin.radius,
          borderColor: isCurrent ? theme.colors.accent : theme.colors.border,
          // A focused block lifts with a border weight rather than a shadow: shadows are
          // invisible on the dark canvas, and this has to read in both appearances.
          borderWidth: isCurrent ? 1.5 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      {/* Tapping anywhere in the head makes this the current exercise. Ticking a set does
          too, but someone reviewing a finished block should be able to select it without
          un-ticking anything. */}
      <Pressable
        onPress={() => {
          onFocus(entryIndex);
        }}
        accessibilityRole="button"
        accessibilityLabel={t('setRow.blockA11y', {
          name: entry.exerciseName,
          done,
          total: entry.sets.length,
        })}
        accessibilityHint={t(isCurrent ? 'setRow.isCurrent' : 'setRow.makeCurrent')}
        style={({ pressed }) => [styles.blockHead, pressed ? { opacity: 0.85 } : null]}
      >
        <Row gap="md" align="center">
          <View style={{ flex: 1, minWidth: 0 }}>
            <Row gap="sm" align="center">
              {isCurrent ? (
                <View style={[styles.dot, { backgroundColor: theme.colors.accent }]} />
              ) : null}
              <Txt variant="subhead" weight="700" numberOfLines={2}>
                {entry.exerciseName}
              </Txt>
            </Row>
            <MetaLine items={previous} theme={theme} style={styles.previous} />
          </View>
          <Txt
            variant="numeralSm"
            weight="700"
            tone={allDone ? 'success' : 'default'}
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {done}
            <Txt variant="caption" tone="faint">
              /{entry.sets.length}
            </Txt>
          </Txt>
        </Row>
      </Pressable>

      {entry.notes === null || entry.notes.length === 0 ? null : (
        <View style={styles.cue}>
          <Txt variant="caption" tone="muted">
            {entry.notes}
          </Txt>
        </View>
      )}

      <View style={styles.sets}>
        {entry.sets.map((set, setIndex) => (
          // Keyed on position, deliberately. Sets are positional by definition, "set 3"
          // means the third one: so a key that followed content would remount the row and
          // replay its entrance every time a rep changed.
          <SetRow
            key={setIndex}
            entryIndex={entryIndex}
            setIndex={setIndex}
            set={set}
            units={units}
            theme={theme}
            isTarget={targetSetIndex === setIndex}
            onOpen={onOpenSet}
            onToggle={onToggleSet}
          />
        ))}
      </View>

      <Row gap="sm" align="center" style={styles.blockFoot}>
        <IconButton
          name="plus"
          variant="surface"
          size={18}
          accessibilityLabel={t('setRow.addSet')}
          onPress={() => {
            onAddSet(entryIndex);
          }}
        />
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => {
            onSkip(entryIndex);
          }}
          accessibilityRole="button"
          accessibilityLabel={t('setRow.skipNamed', { name: entry.exerciseName })}
          hitSlop={8}
          style={({ pressed }) => [styles.textAction, pressed ? { opacity: 0.55 } : null]}
        >
          <Txt variant="label" weight="600" tone="muted">
            {t('setRow.skip')}
          </Txt>
        </Pressable>
        <Pressable
          onPress={() => {
            onRequestRemove(entryIndex);
          }}
          accessibilityRole="button"
          accessibilityLabel={t('setRow.removeNamed', { name: entry.exerciseName })}
          hitSlop={8}
          style={({ pressed }) => [styles.textAction, pressed ? { opacity: 0.55 } : null]}
        >
          <Txt variant="label" weight="600" tone="danger">
            {t('setRow.remove')}
          </Txt>
        </Pressable>
      </Row>
    </View>
  );
});

/**
 * Editing one set: three steppers, no text fields, and no OK button.
 *
 * `Stepper` writes through on every press, so the sheet is a surface for adjusting, not a
 * form to submit: closing it *is* committing, which is why the only footer control says
 * Done and never Cancel. A text field here would need a Done key, a blur, and a rule for
 * what "62." means when the sheet closes mid-keystroke; three steppers need none of that.
 *
 * RPE uses a stepper rather than a slider because a slider's hit region loses to a callus
 * at arm's length. RPE 0 means "not recorded", which is the default for most sets.
 */
export function SetEditorForm({
  entry,
  set,
  units,
  onChange,
  onRemove,
}: {
  entry: StrengthEntry;
  set: StrengthSet;
  units: UnitSystem;
  onChange: (patch: { reps?: number; weightKg?: number; rpe?: number | null }) => void;
  onRemove: () => void;
}) {
  const { t } = useT();
  const theme = useAppTheme();
  const step = weightStep(units);
  const displayWeight = weightDisplayValue(set.weightKg, units, step);
  const context = useMemo<MetaItem[]>(
    () => [
      { icon: 'dumbbell', label: entry.exerciseName },
      { icon: 'layers', label: t('workoutFlow.repCount', { count: set.reps }) },
    ],
    [entry.exerciseName, set.reps, t],
  );

  return (
    <>
      <MetaLine items={context} theme={theme} wrap />
      <FormSection title={t('setRow.reps')}>
        <Stepper
          label={t('setRow.reps')}
          value={set.reps}
          min={0}
          max={100}
          step={1}
          onChange={(reps) => {
            onChange({ reps });
          }}
        />
      </FormSection>

      <FormSection title={t('setRow.weightIn', { unit: weightUnit(units) })}>
        <Stepper
          label={t('setRow.weightInUnit', { unit: weightUnit(units) })}
          value={displayWeight}
          min={0}
          max={units === 'imperial' ? 1000 : 450}
          step={step}
          decimal
          onChange={(next) => {
            // Converted on the way out only. Landing on 0 is a deliberate
            // "bodyweight": the engine stores 0 and the row renders it as BW.
            onChange({ weightKg: weightFromDisplayValue(next, units) });
          }}
        />
        {set.weightKg === 0 ? (
          <Txt variant="micro" tone="faint" style={{ marginTop: spacing.sm }}>
            {t('setRow.bodyweightNote')}
          </Txt>
        ) : null}
      </FormSection>

      <FormSection title={t('setRow.rpe')}>
        <Stepper
          label={t('setRow.rpe')}
          value={set.rpe ?? 0}
          min={0}
          max={10}
          step={1}
          onChange={(rpe) => {
            onChange({ rpe: rpe === 0 ? null : rpe });
          }}
        />
        {/* The qualification about zero goes under the control, in the same place the
            weight section explains bodyweight. As part of the section title it became a
            twelve-word eyebrow, which stops being a heading at that length. */}
        <Txt variant="micro" tone="faint" style={{ marginTop: spacing.sm }}>
          {t('setRow.rpeNote')}
        </Txt>
      </FormSection>

      <FormFooter>
        <Button
          label={t('setRow.removeThisSet')}
          variant="danger"
          icon="trash"
          onPress={onRemove}
        />
      </FormFooter>
    </>
  );
}

/**
 * The rest-timer dock.
 *
 * Pinned to the bottom of the window rather than left in the scroll: a timer that scrolls
 * off-screen is a timer that gets forgotten, and the entire point of a countdown is that
 * you stop watching it. Drag-to-dismiss is deliberately absent: this floats over set rows,
 * and a sheet-style pan here would swallow taps on whatever sat underneath.
 *
 * The bar is a determinate linear track, not a ring. A ring needs an SVG arc for an honest
 * sweep, and a `borderWidth` fake sweeps wrong in the last quarter of every timer.
 */
export const RestDock = memo(function RestDock({
  remainingSeconds,
  totalSeconds,
  theme,
  onSkip,
  onAdjust,
  onHeight,
}: {
  remainingSeconds: number;
  totalSeconds: number;
  theme: Theme;
  onSkip: () => void;
  onAdjust: (seconds: number) => void;
  /** The dock's own height, so the scroll view behind it can leave room for it. */
  onHeight?: (height: number) => void;
}) {
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const progress = totalSeconds > 0 ? Math.min(1, Math.max(0, remainingSeconds / totalSeconds)) : 0;

  return (
    <View
      style={[styles.dock, { bottom: insets.bottom + spacing.md }]}
      pointerEvents="box-none"
      onLayout={
        onHeight
          ? (e: LayoutChangeEvent) => {
              onHeight(Math.round(e.nativeEvent.layout.height));
            }
          : undefined
      }
    >
      <Row
        gap="md"
        align="center"
        style={[
          styles.dockCard,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.borderStrong,
            borderRadius: theme.surfaceSkin.radius,
          },
          theme.shadows.raised,
        ]}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Row gap="sm" align="center">
            <Txt variant="micro" uppercase tracking={0.8} weight="700" tone="muted">
              {t('misc.rest')}
            </Txt>
            <Txt
              variant="monoLg"
              weight="700"
              tone="accent"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {formatTimer(remainingSeconds)}
            </Txt>
          </Row>
          <View style={[styles.track, { backgroundColor: theme.colors.placeholder }]}>
            <View
              style={{
                height: '100%',
                width: `${Math.round(progress * 100)}%`,
                backgroundColor: theme.colors.accent,
                borderRadius: radius.pill,
              }}
            />
          </View>
        </View>

        <View style={styles.adjust}>
          <IconButton
            name="minus"
            variant="surface"
            size={18}
            accessibilityLabel={t('setRow.restLess')}
            onPress={() => {
              onAdjust(Math.max(0, remainingSeconds - 15));
            }}
          />
          <IconButton
            name="plus"
            variant="surface"
            size={18}
            accessibilityLabel={t('setRow.restMore')}
            onPress={() => {
              onAdjust(Math.min(600, remainingSeconds + 15));
            }}
          />
        </View>

        <IconButton
          name="close"
          variant="plain"
          size={20}
          accessibilityLabel={t('setRow.skipRest')}
          onPress={onSkip}
        />
      </Row>
    </View>
  );
});

/**
 * Removing an exercise from a workout in progress.
 *
 * Confirmed, unlike skipping. Skipping leaves the exercise in the list with its sets
 * un-ticked: recoverable, so no prompt. Removing deletes the entry and the sets already
 * banked against it, so it goes through the same confirm path as discarding the workout.
 */
export function RemoveExerciseDialog({
  exerciseName,
  completedSets,
  onConfirm,
  onRequestClose,
}: {
  exerciseName: string;
  completedSets: number;
  onConfirm: () => void;
  onRequestClose: () => void;
}) {
  const { t } = useT();
  return (
    <ConfirmDialog
      visible
      title={t('setRow.removeExerciseTitle')}
      message={
        completedSets > 0
          ? t('setRow.removeWithSets', { name: exerciseName, count: completedSets })
          : t('setRow.removePlain', { name: exerciseName })
      }
      confirmLabel={t('setRow.remove')}
      cancelLabel={t('common.cancel')}
      destructive
      onConfirm={onConfirm}
      onCancel={onRequestClose}
    />
  );
}

/** Sets done over sets planned: the progress the bar under the player's header reports. */
export function SessionProgressBar({ ratio, theme }: { ratio: number; theme: Theme }) {
  return (
    <View style={[styles.progressTrack, { backgroundColor: withAlpha(theme.colors.text, 0.1) }]}>
      <View
        style={{
          height: '100%',
          width: `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%`,
          backgroundColor: theme.colors.accent,
          borderRadius: radius.pill,
        }}
      />
    </View>
  );
}

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
  block: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  previous: { marginTop: spacing.xs },
  blockHead: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  cue: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  sets: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  blockFoot: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  dot: { width: 7, height: 7, borderRadius: radius.pill },
  textAction: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  dock: { position: 'absolute', left: screenGutter, right: screenGutter, zIndex: z.sticky },
  dockCard: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  track: { height: 4, borderRadius: radius.pill, marginTop: spacing.sm, overflow: 'hidden' },
  adjust: { flexDirection: 'row', gap: spacing.xs },
  progressTrack: {
    height: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
} satisfies Record<string, ViewStyle>);

/**
 * Live-session pill, floating above the bar so it is reachable from every tab without
 * covering what the user is reading. The dot breathes: a static dot says "a session
 * exists", a breathing one says it is happening now: which is the distinction that
 * matters when you come back to the app twenty minutes later.
 */
export const ActiveWorkoutPill = memo(function ActiveWorkoutPill({
  label,
  detail,
  onPress,
  theme,
}: {
  label: string;
  /** Elapsed time or set count: whatever the session wants to advertise. */
  detail?: string;
  onPress: () => void;
  theme: Theme;
}) {
  const { t } = useT();
  const pulse = usePulse(1600, 0.35);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      accessibilityHint={t('misc.opensWorkoutInProgress')}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm + 2,
          borderRadius: radius.pill,
          backgroundColor: theme.colors.surfaceRaised,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.border,
          opacity: pressed ? 0.88 : 1,
          ...theme.shadows.raised,
        },
      ]}
    >
      <Animated.View
        style={[
          {
            width: 8,
            height: 8,
            borderRadius: radius.pill,
            backgroundColor: theme.colors.tertiary,
          },
          pulse,
        ]}
      />
      <CellText text={label} variant="label" weight="600" color={theme.colors.text} />
      {detail ? (
        <CellText text={detail} variant="monoSm" color={theme.colors.textMuted} />
      ) : null}
      <Icon name="chevronRight" size={15} color={theme.colors.textFaint} />
    </Pressable>
  );
});
