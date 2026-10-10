import { memo } from 'react';
import {
  Button,
  DurationSetStepperRow,
  ExerciseAbout,
  type ExerciseAboutContent,
  FormFooter,
  FormSection,
  MetaLine,
  NoteField,
  RepsSetStepperRow,
  SegmentedControl,
  SetStepperRow,
  Stepper,
  TagRow,
  Txt,
} from '@/features/core/design-system';
import { useAppTheme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';
import type { UnitSystem } from '@/features/core/utils';
import type { ExerciseSnapshot } from '@/features/exercises';
import type { ItemChange } from '@/features/routines/domain/entities/ItemTarget';
import type { RoutineItem, TrackingType } from '@/features/routines/domain/schemas/RoutineSchema';
import { useItemEditorFormLogic } from '@/features/routines/ui/components/ItemEditorForm/ItemEditorForm.logic';

/**
 * Editing one exercise's targets: what each set records, then every set as a stepper row of that
 * type. Every press commits, so the sheet is a surface for adjusting rather than a form to submit:
 * closing it is committing, there is no half-entered state for a swipe to interrupt, and no
 * "discard changes?" to get wrong.
 */
export const ItemEditorForm = memo(function ItemEditorForm({
  item,
  snapshot,
  units,
  about,
  onOpenExercise,
  onChange,
  onChangeType,
  onRemove,
}: {
  item: RoutineItem;
  snapshot: ExerciseSnapshot | null;
  units: UnitSystem;
  /** The library's About block, read by the page. */
  about: ExerciseAboutContent;
  /** Opens the exercise page from the About block. */
  onOpenExercise: () => void;
  onChange: (change: ItemChange) => void;
  onChangeType: (type: TrackingType) => void;
  onRemove?: () => void;
}) {
  const { derived, effects } = useItemEditorFormLogic(item, snapshot, units, onChange, onChangeType);
  const { t } = useT();
  const theme = useAppTheme();

  return (
    <>
      <MetaLine items={derived.meta} theme={theme} wrap />
      <FormSection title={t('tracking.title')}>
        <SegmentedControl segments={derived.typeSegments} value={derived.trackingType} onChange={effects.changeType} />
      </FormSection>

      <FormSection title={t('itemEditor.sets')}>
        {derived.rows.map((row, at) => {
          const shared = {
            index: row.index,
            rpe: row.rpe,
            rpeBounds: derived.rpe,
            rpeKind: 'target',
            completed: false,
            canRemove: derived.canRemoveSet,
            topDivider: at > 0,
            highlighted: false,
            theme,
            onRpe: effects.setRpe,
            onRemove: effects.removeSet,
          } as const;
          return row.type === 'weightReps' ? (
            <SetStepperRow
              key={row.key}
              {...shared}
              reps={row.reps}
              weight={row.weight}
              unit={derived.unit}
              repsBounds={derived.reps}
              weightMax={derived.weightMax}
              weightStep={derived.weightStep}
              onReps={effects.setReps}
              onWeight={effects.setWeight}
            />
          ) : row.type === 'repsOnly' ? (
            <RepsSetStepperRow
              key={row.key}
              {...shared}
              reps={row.reps}
              repsBounds={derived.reps}
              onReps={effects.setReps}
            />
          ) : (
            <DurationSetStepperRow
              key={row.key}
              {...shared}
              durationSeconds={row.durationSeconds}
              durationBounds={derived.duration}
              onDuration={effects.setDuration}
            />
          );
        })}
        <Txt variant="micro" tone="faint">
          {t('itemEditor.targetRpeNote')}
        </Txt>
        <Button
          label={t('itemEditor.addSet')}
          variant="secondary"
          icon="plus"
          disabled={!derived.canAddSet}
          onPress={effects.addSet}
        />
      </FormSection>

      <FormSection title={t('itemEditor.restBetweenSets')}>
        <Stepper
          label={t('itemEditor.restBetweenSets')}
          value={item.restSeconds}
          min={derived.rest.min}
          max={derived.rest.max}
          step={15}
          suffix="s"
          onChange={effects.setRest}
        />
        {derived.zeroRest ? (
          <Txt variant="micro" tone="faint">
            {t('itemEditor.zeroRestNote')}
          </Txt>
        ) : null}
      </FormSection>

      <NoteField note={item.notes} maxLength={derived.noteMax} onCommit={effects.setNotes} />

      <FormSection title={t('itemEditor.fromLibrary')}>
        {derived.libraryTags.length > 0 ? <TagRow tags={derived.libraryTags} theme={theme} /> : null}
        <ExerciseAbout about={about} onOpen={onOpenExercise} />
      </FormSection>

      {onRemove === undefined ? null : (
        <FormFooter>
          <Button label={t('itemEditor.remove')} variant="danger" icon="trash" onPress={onRemove} />
        </FormFooter>
      )}
    </>
  );
});
