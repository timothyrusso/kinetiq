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
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import type { StrengthEntry } from '@/domain/types';
import type { Theme } from '@/theme/theme';
import type { UnitSystem } from '@/utils/format';
import { radius, spacing } from '@/theme/tokens';
import { IconButton } from '@/ui/controls/IconButton';
import { Row } from '@/ui/layout';
import { Txt } from '@/ui/Text';
import { useT } from '@/i18n/useT';
import { MetaLine, type MetaItem } from '@/ui/display';
import { SetRow } from '@/ui/workout/SetRow';

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
          // The current exercise is marked by the dot before its name, not by the card: an
          // accent frame round a whole block read as a selection or an error state.
          borderColor: theme.colors.border,
          borderWidth: StyleSheet.hairlineWidth,
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

const styles = StyleSheet.create({
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
} satisfies Record<string, ViewStyle>);
