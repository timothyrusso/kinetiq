import { type ReactElement, type ReactNode, useCallback } from 'react';
import { FormSheetList } from '@/features/core/design-system';
import type { Theme } from '@/features/core/theme';
import type { TKey } from '@/features/core/translations';
import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';
import { ExercisePickerRow } from '@/features/exercises/ui/components/ExercisePickerRow/ExercisePickerRow';
import type { PickDestination } from '@/features/exercises/ui/pages/PickExercisePage/PickExercisePage.logic';

const keyExtractor = (exercise: Exercise) => exercise.id;

/**
 * The picker's sheet: its results as a `FlashList` under the search, so the list is the sheet's
 * only scroll container and scrolling back up always reaches the search. Every row shares one
 * `onSelect` and one `onInfo`, each taking the exercise's id; `onSelect` adds or, on a removable
 * included row, removes.
 */
export function ExercisePickerList({
  title,
  doneLabel,
  rows,
  theme,
  isIncluded,
  lockedReason,
  removable,
  destination,
  dimmed,
  onSelect,
  onInfo,
  header,
  footer,
  empty,
}: {
  title: string;
  doneLabel: TKey;
  rows: readonly Exercise[];
  theme: Theme;
  isIncluded: (exerciseId: string) => boolean;
  /** Why an included row cannot be removed, or `null`; such a row is inert and says why. */
  lockedReason: (exerciseId: string) => string | null;
  /** Whether a tap on an included row removes it; otherwise included rows are inert. */
  removable: boolean;
  destination: PickDestination;
  /**
   * Rows from the previous filter while the new one is read: dimmed, because they are about to be
   * wrong, and inert, so a tap cannot add the wrong exercise.
   */
  dimmed: boolean;
  onSelect: (exerciseId: string) => void;
  /** Opens the exercise's page over the sheet. */
  onInfo: (exerciseId: string) => void;
  header: ReactNode;
  footer: ReactNode;
  empty: ReactElement;
}) {
  const renderItem = useCallback(
    ({ item }: { item: Exercise }) => {
      const included = isIncluded(item.id);
      return (
        <ExercisePickerRow
          exercise={item}
          theme={theme}
          included={included}
          removable={removable}
          locked={included ? lockedReason(item.id) : null}
          destination={destination}
          dimmed={dimmed}
          onSelect={onSelect}
          onInfo={onInfo}
        />
      );
    },
    [destination, dimmed, isIncluded, lockedReason, onInfo, onSelect, removable, theme],
  );

  return (
    <FormSheetList
      title={title}
      doneLabel={doneLabel}
      data={rows}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      header={header}
      footer={footer}
      empty={empty}
    />
  );
}
