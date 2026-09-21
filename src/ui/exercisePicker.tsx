/**
 * The remote-library exercise picker, as a sheet.
 *
 * Shared by the two places that put an exercise into a list of exercises: the routine
 * builder (writing into the draft store) and a saved routine's detail screen (writing
 * through a mutation). They differ only in what happens on tap, which is why this takes
 * `onPick` and nothing else about either destination.
 *
 * A sheet rather than a pushed screen for both: a pushed library has to hand the choice back
 * across a navigation boundary, and pushing a *routine picker* in front of someone who is
 * already inside one routine is answering a question nobody asked.
 *
 * ## Its own search state, deliberately
 *
 * The library tab keeps its filter in a shared store (`queries/exerciseFilters`) so it
 * survives tab switches. Reusing that store here would mean that building a routine quietly
 * rewired the library tab behind the modal: finish a routine, tap Exercises, find it filtered
 * to "dumbbell". So this sheet owns its query and taxon ids locally and passes them into the
 * search hook as an ordinary value.
 *
 * ## Why an old response cannot overwrite a new one
 *
 * The query key is built from the *debounced* filter, so typing "roman", "romanian",
 * "romanian deadlift" costs one request rather than three, and TanStack Query owns
 * cancellation per key. The part that actually carries the correctness is that no result is
 * ever copied out of the cache into local state: there is no shadow array for a late response
 * to overwrite, so an old response can only repaint the list its own key asked for.
 */
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/ui/Button';
import { Chip } from '@/ui/controls';
import { TextField } from '@/ui/TextField';
import { Row } from '@/ui/layout';
import { Txt } from '@/ui/Text';
import { Icon } from '@/ui/icons';
import { EmptyState, ErrorState, SkeletonList } from '@/ui/states';
import { ExerciseThumb, ListRow } from '@/ui/rows';
import { Sheet, SheetFooter } from '@/ui/Sheet';
import { useExerciseSearch, useExerciseTaxonomy } from '@/queries/useExercises';
import { useAppTheme } from '@/theme/theme';
import { spacing } from '@/theme/tokens';
import { useDebouncedValue, useIsSettling } from '@/utils/useDebouncedValue';
import type { Exercise, ExerciseFilter } from '@/domain/types';

/**
 * Rows the sheet renders before asking for more.
 *
 * Rows here are plain `ListRow`s inside the sheet's own `ScrollView` rather than a
 * virtualised list, because a `FlashList` inside a scrolling sheet means two scroll
 * containers fighting over one gesture: a real class of bug on Android especially. 24 rows
 * is well inside what a ScrollView renders in one pass, and an explicit Load more control
 * gives the next page a visible state, which `onEndReached` cannot when the list is this
 * short: there is nothing left to reach.
 */
const PAGE_ROWS = 24;

/** How many taxonomy chips to offer. */
const MUSCLE_CHIPS = 6;
const EQUIPMENT_CHIPS = 5;

export function ExercisePickerSheet({
  onPick,
  onClose,
  isIncluded,
}: {
  /** Called once per chosen exercise, with the provider's row. */
  onPick: (exercise: Exercise) => void;
  onClose: () => void;
  /**
   * Whether this exercise is already in the destination list. Included rows stay visible,
   * checked and disabled, rather than disappearing: a result set that silently loses rows
   * while you type reads as a broken search, and "why did that one vanish" is a worse
   * question than a grey row is an answer.
   */
  isIncluded: (exerciseId: string) => boolean;
}) {
  const [query, setQuery] = useState('');
  const [muscleId, setMuscleId] = useState<number | null>(null);
  const [equipmentId, setEquipmentId] = useState<number | null>(null);
  const [shown, setShown] = useState(PAGE_ROWS);
  const debounced = useDebouncedValue(query);
  const settling = useIsSettling(query, debounced);

  const filter: ExerciseFilter = useMemo(
    () => ({ query: debounced, categoryId: null, muscleId, equipmentId }),
    [debounced, muscleId, equipmentId],
  );

  const search = useExerciseSearch(filter);
  const taxonomy = useExerciseTaxonomy();
  const searching = query.trim().length > 0;
  const filtered = muscleId !== null || equipmentId !== null;

  // A new filter resets the visible window, or a "Load more" from a previous search would
  // carry its size over onto an unrelated result set.
  useEffect(() => {
    setShown(PAGE_ROWS);
  }, [debounced, muscleId, equipmentId]);

  const rows = search.items.slice(0, shown);
  const includedCount = search.items.filter((exercise) => isIncluded(exercise.id)).length;

  return (
    <Sheet
      onRequestClose={onClose}
      title="Add exercises"
      subtitle="Searched live from the exercise library"
    >
      <TextField
        label="Search"
        value={query}
        onChangeText={setQuery}
        placeholder="Squat, curl, lat pulldown"
        autoFocus
        // Text rather than a spinner: a hint is announced, and it explains the one state
        // where typing has been received and nothing has moved yet.
        hint={settling ? 'Searching…' : `${search.total ?? '-'} exercises in the library`}
        accessibilityHint="Filters the exercise library as you type"
      />

      <Row gap="sm" wrap>
        {(taxonomy.data?.muscles ?? []).slice(0, MUSCLE_CHIPS).map((muscle) => (
          <Chip
            key={muscle.id}
            label={muscle.name}
            size="sm"
            selected={muscleId === muscle.id}
            onPress={() => setMuscleId(muscleId === muscle.id ? null : muscle.id)}
          />
        ))}
        {(taxonomy.data?.equipment ?? []).slice(0, EQUIPMENT_CHIPS).map((piece) => (
          <Chip
            key={piece.id}
            label={piece.name}
            size="sm"
            selected={equipmentId === piece.id}
            onPress={() => setEquipmentId(equipmentId === piece.id ? null : piece.id)}
          />
        ))}
      </Row>

      {filtered ? (
        <Button
          label="Clear filter"
          variant="quiet"
          size="sm"
          icon="close"
          onPress={() => {
            setMuscleId(null);
            setEquipmentId(null);
          }}
        />
      ) : null}

      {search.error !== null ? (
        <ErrorState
          error={search.error}
          onRetry={() => void search.refresh()}
          compact
          title="The library is unreachable"
        />
      ) : search.isLoading ? (
        <SkeletonList rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          compact
          icon="search"
          title={searching || filtered ? 'Nothing matches that' : 'Start typing'}
          message={
            searching || filtered
              ? 'The library is a real remote catalogue, so an unusual name may simply not be in it. Try a plainer word, or clear the filter.'
              : 'Type part of an exercise name and results appear as you go.'
          }
        />
      ) : (
        <View style={{ marginTop: -spacing.sm }}>
          {rows.map((exercise) => (
            <PickerRow
              key={exercise.id}
              exercise={exercise}
              included={isIncluded(exercise.id)}
              // Rows from the previous filter while the new one is in flight: dimmed, because
              // they are real data that is about to be wrong. Tapping one would add the wrong
              // exercise, so they stay inert until the new results land.
              dimmed={search.isPlaceholder}
              onPress={() => {
                if (search.isPlaceholder) return;
                onPick(exercise);
              }}
            />
          ))}
        </View>
      )}

      {search.hasMore ? (
        <Button
          label="Load more"
          variant="secondary"
          size="sm"
          loading={search.isFetchingNextPage}
          disabled={search.isFetchingNextPage}
          onPress={() => {
            // The hook fetches the next page; the local window widens by one page per press
            // so the sheet keeps rendering plain rows instead of growing a virtualiser.
            void search.loadNextPage();
            setShown((n) => n + PAGE_ROWS);
          }}
        />
      ) : null}

      <SheetFooter>
        <Button label="Done" onPress={onClose} weighty />
      </SheetFooter>

      {includedCount > 0 ? (
        <Txt variant="micro" tone="faint" style={{ textAlign: 'center', marginTop: -spacing.sm }}>
          {includedCount} {includedCount === 1 ? 'is' : 'are'} already in this routine
        </Txt>
      ) : null}
    </Sheet>
  );
}

function PickerRow({
  exercise,
  included,
  dimmed,
  onPress,
}: {
  exercise: Exercise;
  included: boolean;
  dimmed: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();

  return (
    <ListRow
      theme={theme}
      title={exercise.name}
      subtitle={pickerSubtitle(exercise)}
      onPress={included ? undefined : onPress}
      disabled={included}
      style={{
        opacity: dimmed ? 0.45 : 1,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.colors.hairline,
      }}
      accessibilityHint={
        included ? 'Already in this routine' : 'Adds this exercise to the routine'
      }
      leading={
        <ExerciseThumb
          uri={exercise.thumbnailUrl ?? exercise.imageUrl}
          name={exercise.name}
          size={44}
          theme={theme}
        />
      }
      trailing={
        <Icon
          name={included ? 'check' : 'plus'}
          size={18}
          color={included ? theme.colors.accent : theme.colors.textMuted}
        />
      }
    />
  );
}

/**
 * The row's second line.
 *
 * The same order the rest of the app uses for an exercise's caption: muscles, then category,
 * then a bare "Exercise": because two screens falling back to two different words for the
 * same missing field is how a library starts to look unfinished.
 */
function pickerSubtitle(exercise: Exercise): string {
  if (exercise.primaryMuscles.length > 0) return exercise.primaryMuscles.join(', ');
  return exercise.category ?? 'Exercise';
}
