import { memo, useMemo } from 'react';

import { Txt } from '@/ui/Text';
import { Stepper } from '@/ui/controls/Stepper';
import { FormFooter, FormSection } from '@/ui/FormSheet';
import { Button } from '@/ui/controls/Button';
import { MetaLine } from '@/ui/display/MetaLine';
import { TagRow } from '@/ui/display/TagRow';
import { exerciseTags } from '@/ui/display/exerciseTags';
import { useAppTheme } from '@/theme/theme';
import { repsFromRange, weightDisplayValue, weightFromDisplayValue, weightStep, weightUnit, type UnitSystem } from '@/utils/format';
import type { ExerciseSnapshot, RoutineItem } from '@/domain/types';
import type { ItemTarget } from '@/routines/draft';
import { useT } from '@/i18n/useT';
import type { Tag } from '@/ui/display/types';
import { ExerciseAbout } from '@/ui/routineItems/ExerciseAbout';
import { itemMeta } from '@/ui/routineItems/itemMeta';
import { NoteField } from '@/ui/routineItems/NoteField';

/**
 * Editing one exercise's targets.
 *
 * ## No OK button, because every press commits
 *
 * The steppers write through, so this sheet is a surface for adjusting rather than a form
 * to submit: closing it *is* committing. That is what makes it safe on the saved-routine
 * screen, where each press goes straight to SQLite: there is no half-entered state for a
 * backdrop tap or the back gesture to interrupt, and no "discard changes?" prompt to get
 * wrong. A text field for weight would need a Done key, a blur, and a rule for what "62."
 * means when the sheet closes mid-keystroke.
 *
 * ## Weight is entered in the user's unit and converted exactly once
 *
 * On the way out, in the `onChange` that writes. Converting on the way in as well: and
 * again on close: is how a units-aware form ends up with a field reading 135 while the
 * stepper is quietly stepping kilograms.
 */
export const ItemEditorForm = memo(function ItemEditorForm({
  item,
  snapshot,
  units,
  onChange,
  onRemove,
}: {
  item: RoutineItem;
  snapshot: ExerciseSnapshot | null;
  units: UnitSystem;
  onChange: (patch: Partial<ItemTarget>) => void;
  onRemove?: () => void;
}) {
  const { t } = useT();
  const theme = useAppTheme();
  const step = weightStep(units);
  const displayWeight = weightDisplayValue(item.weightKg, units, step);
  // The current targets as items under the title, so the summary a row shows and the values
  // the steppers below are changing read the same way, and update together.
  const meta = useMemo(() => itemMeta(item, units), [item, units]);
  const libraryTags = useMemo<Tag[]>(
    () =>
      snapshot === null
        ? []
        : [
            ...exerciseTags(snapshot),
            ...snapshot.equipment.map((gear) => ({ key: `e:${gear}`, label: gear })),
          ],
    [snapshot],
  );

  return (
    <>
      <MetaLine items={meta} theme={theme} wrap />
      <FormSection title={t('itemEditor.sets')}>
        <Stepper
          label={t('itemEditor.sets')}
          value={item.sets}
          min={1}
          max={20}
          step={1}
          onChange={(sets) => onChange({ sets })}
        />
      </FormSection>

      <FormSection title={t('itemEditor.reps')}>
        <Stepper
          label={t('itemEditor.reps')}
          value={repsFromRange(item.reps)}
          min={1}
          max={100}
          step={1}
          suffix={t('itemEditor.repsSuffix')}
          onChange={(reps) => onChange({ reps: String(reps) })}
        />
      </FormSection>

      <FormSection title={t('itemEditor.weightIn', { unit: weightUnit(units) })}>
        <Stepper
          label={t('itemEditor.weightPerSet', { unit: weightUnit(units) })}
          value={displayWeight}
          min={0}
          max={units === 'imperial' ? 1000 : 450}
          step={step}
          decimal
          onChange={(next) => onChange({ weightKg: weightFromDisplayValue(next, units) })}
        />
      </FormSection>

      <FormSection title={t('itemEditor.restBetweenSets')}>
        <Stepper
          label={t('itemEditor.restBetweenSets')}
          value={item.restSeconds}
          min={0}
          max={600}
          step={15}
          suffix="s"
          onChange={(restSeconds) => onChange({ restSeconds })}
        />
        {item.restSeconds === 0 ? (
          <Txt variant="micro" tone="faint">
            {t('itemEditor.zeroRestNote')}
          </Txt>
        ) : null}
      </FormSection>

      {/* No FormSection: the field draws its own label in the same style. */}
      <NoteField note={item.notes} onCommit={(notes) => onChange({ notes })} />

      <FormSection title={t('itemEditor.fromLibrary')}>
        {libraryTags.length > 0 ? <TagRow tags={libraryTags} theme={theme} /> : null}
        <ExerciseAbout exerciseId={item.exerciseId} />
      </FormSection>

      {onRemove === undefined ? null : (
        <FormFooter>
          <Button label={t('itemEditor.remove')} variant="danger" icon="trash" onPress={onRemove} />
        </FormFooter>
      )}
    </>
  );
});
