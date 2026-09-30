import { type ReactElement, type ReactNode, useCallback } from 'react';
import { FormSheetList } from '@/features/core/design-system';
import type { Theme } from '@/features/core/theme';
import type { TKey } from '@/features/core/translations';
import type { Exercise } from '@/features/exercises/domain/schemas/ExerciseSchema';
import { ExercisePickerRow } from '@/features/exercises/ui/components/ExercisePickerRow/ExercisePickerRow';

const keyExtractor = (exercise: Exercise) => exercise.id;

/**
 * The picker's sheet: its results as a `FlashList` under the search, so the list is the sheet's
 * only scroll container and scrolling back up always reaches the search. Every row shares one
 * `onSelect` that takes the exercise's id.
 */
export function ExercisePickerList({
  title,
  doneLabel,
  rows,
  theme,
  isIncluded,
  dimmed,
  onSelect,
  header,
  footer,
  empty,
}: {
  title: string;
  doneLabel: TKey;
  rows: readonly Exercise[];
  theme: Theme;
  isIncluded: (exerciseId: string) => boolean;
  /**
   * Rows from the previous filter while the new one is read: dimmed, because they are about to be
   * wrong, and inert, so a tap cannot add the wrong exercise.
   */
  dimmed: boolean;
  onSelect: (exerciseId: string) => void;
  header: ReactNode;
  footer: ReactNode;
  empty: ReactElement;
}) {
  const renderItem = useCallback(
    ({ item }: { item: Exercise }) => (
      <ExercisePickerRow
        exercise={item}
        theme={theme}
        included={isIncluded(item.id)}
        dimmed={dimmed}
        onSelect={onSelect}
      />
    ),
    [dimmed, isIncluded, onSelect, theme],
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
