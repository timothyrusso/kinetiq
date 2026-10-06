import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { IconButton, MetaLine, Row, Txt, useStyles } from '@/features/core/design-system';
import type { Theme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';
import type { UnitSystem } from '@/features/core/utils';
import {
  type ExerciseBlockInput,
  useExerciseBlockLogic,
} from '@/features/workouts/ui/components/ExerciseBlock/ExerciseBlock.logic';
import { createStyles } from '@/features/workouts/ui/components/ExerciseBlock/ExerciseBlock.style';
import { SetRow } from '@/features/workouts/ui/components/SetRow/SetRow';

/**
 * The exercise being trained, with its sets. The head carries the two things a lifter checks
 * between sets: what they did last time and how many sets are banked; everything else is on the
 * exercise's own screen, and repeating it would push the set rows below the fold. The current
 * exercise is marked by the dot before its name, not by the card: an accent frame read as a
 * selection or an error. Tapping the head, or a set's values, opens the exercise's sheet
 * and makes it current without unticking anything.
 *
 * A cue from the routine shows as plain text and is not editable here: a keyboard over a set list
 * is the worst thing this app could show someone holding a barbell. The sets, the rest and the
 * cue change in the exercise's sheet. Sets are keyed by position: "set 3" is the third one, and a key
 * that followed content would remount the row and replay its entrance on every rep change.
 */
export const ExerciseBlock = memo(function ExerciseBlock(
  props: ExerciseBlockInput & {
    targetSetIndex: number | null;
    units: UnitSystem;
    theme: Theme;
    isCurrent: boolean;
    onOpenSet: (entryIndex: number, setIndex: number) => void;
    onToggleSet: (entryIndex: number, setIndex: number) => void;
  },
) {
  const { entry, entryIndex, targetSetIndex, units, theme, isCurrent, onOpenSet, onToggleSet } = props;
  const { derived, effects } = useExerciseBlockLogic(props);
  const { t } = useT();
  const styles = useStyles(createStyles);

  return (
    <View style={styles.block}>
      <Pressable
        onPress={effects.open}
        accessibilityRole="button"
        accessibilityLabel={t('setRow.blockA11y', {
          name: entry.exerciseName,
          done: derived.done,
          total: entry.sets.length,
        })}
        accessibilityHint={t(isCurrent ? 'setRow.opensCurrentExercise' : 'setRow.opensExercise')}
        style={derived.headStyle}
      >
        <Row gap="md" align="center">
          <View style={styles.titles}>
            <Row gap="sm" align="center">
              {isCurrent ? <View style={styles.dot} /> : null}
              <Txt variant="subhead" weight="700" numberOfLines={2} style={styles.name}>
                {entry.exerciseName}
              </Txt>
            </Row>
            <MetaLine items={derived.previous} theme={theme} style={styles.previous} />
          </View>
          <Txt variant="numeralSm" weight="700" tone={derived.allDone ? 'success' : 'default'} style={styles.count}>
            {derived.done}
            <Txt variant="caption" tone="faint">
              /{entry.sets.length}
            </Txt>
          </Txt>
        </Row>
      </Pressable>

      {derived.hasCue ? (
        <View style={styles.cue}>
          <Txt variant="caption" tone="muted">
            {entry.notes}
          </Txt>
        </View>
      ) : null}

      <View style={styles.sets}>
        {entry.sets.map((set, setIndex) => (
          <SetRow
            // biome-ignore lint/suspicious/noArrayIndexKey: sets are positional, see the component's doc
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

      <Row gap="sm" align="center" style={styles.foot}>
        <IconButton
          name="plus"
          variant="surface"
          size={18}
          accessibilityLabel={t('setRow.addSet')}
          onPress={effects.addSet}
        />
        <View style={styles.spacer} />
        <Pressable
          onPress={effects.skip}
          accessibilityRole="button"
          accessibilityLabel={t('setRow.skipNamed', { name: entry.exerciseName })}
          hitSlop={8}
          style={derived.textActionStyle}
        >
          <Txt variant="label" weight="600" tone="muted">
            {t('setRow.skip')}
          </Txt>
        </Pressable>
        <Pressable
          onPress={effects.remove}
          accessibilityRole="button"
          accessibilityLabel={t('setRow.removeNamed', { name: entry.exerciseName })}
          hitSlop={8}
          style={derived.textActionStyle}
        >
          <Txt variant="label" weight="600" tone="danger">
            {t('setRow.remove')}
          </Txt>
        </Pressable>
      </Row>
    </View>
  );
});
