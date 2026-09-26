/**
 * The exercise picker: the body of the `pick-exercise` form-sheet route.
 *
 * Shared by the three places that put an exercise into a list: the routine builder, a saved
 * routine and the live session. The route decides the destination and passes `onPick`; this
 * component knows nothing about any of them.
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
 * "romanian deadlift" costs one catalog read rather than three, and TanStack Query owns
 * cancellation per key. The part that actually carries the correctness is that no result is
 * ever copied out of the cache into local state: there is no shadow array for a late response
 * to overwrite, so an old response can only repaint the list its own key asked for.
 */
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Theme } from '@/theme/theme';

import { Button } from '@/ui/controls/Button';
import { Chip } from '@/ui/controls/Chip';
import { TextInput } from '@/ui/controls/TextInput';
import { Rail, Stack } from '@/ui/layout';
import { Txt } from '@/ui/Text';
import { Icon, ICON_SIZE } from '@/ui/icons';
import { EmptyState, ErrorState, SkeletonList } from '@/ui/states';
import { ExerciseThumb, ListRow } from '@/ui/rows';
import { FormSheet } from '@/ui/FormSheet';
import { useExerciseSearch, useExerciseTaxonomy } from '@/queries/useExercises';
import { useAppTheme } from '@/theme/theme';
import { useDebouncedValue, useIsSettling } from '@/utils/useDebouncedValue';
import type { Exercise, ExerciseFilter } from '@/domain/types';
import { useT } from '@/i18n/useT';
import { exerciseTags } from '@/ui/display/exerciseTags';

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

export function ExercisePicker({
  onPick,
  isIncluded,
  error,
}: {
  /** Called once per chosen exercise, with the provider's row. */
  onPick: (exercise: Exercise) => void;
  /** Why the last pick did not land, shown above the results. */
  error: string | null;
  /**
   * Whether this exercise is already in the destination list. Included rows stay visible,
   * checked and disabled, rather than disappearing: a result set that silently loses rows
   * while you type reads as a broken search, and "why did that one vanish" is a worse
   * question than a grey row is an answer.
   */
  isIncluded: (exerciseId: string) => boolean;
}) {
  const { t } = useT();
  const theme = useAppTheme();
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

  const rows = useMemo(() => search.items.slice(0, shown), [search.items, shown]);
  const includedCount = useMemo(
    () => search.items.filter((exercise) => isIncluded(exercise.id)).length,
    [isIncluded, search.items],
  );
  const placeholder = search.isPlaceholder;
  // One callback for every row; the row hands back its own exercise.
  const select = useCallback(
    (exercise: Exercise) => {
      if (placeholder) return;
      onPick(exercise);
    },
    [onPick, placeholder],
  );

  return (
    <FormSheet title={t('picker.title')} doneLabel="picker.done" scroll>
      <Txt variant="caption" tone="muted">
        {t('picker.subtitle')}
      </Txt>
      {error ? (
        <Txt variant="caption" tone="danger">
          {error}
        </Txt>
      ) : null}
      <TextInput
        label={t('picker.search')}
        value={query}
        onChangeText={setQuery}
        placeholder={t('picker.placeholder')}
        // Text rather than a spinner: a hint is announced, and it explains the one state
        // where typing has been received and nothing has moved yet.
        hint={
          settling
            ? t('exerciseList.searching')
            : t('details.pickerInLibrary', { total: search.total ?? '-' })
        }
        accessibilityHint={t('picker.searchHint')}
      />

      {/* Every muscle and every piece of equipment, one rail each. A capped, wrapped set
          used to show the first six by name, which kept Brachialis and hid Quads. */}
      <Stack gap="sm">
        <Rail>
          {(taxonomy.data?.muscles ?? []).map((muscle) => (
            <Chip
              key={muscle.id}
              label={muscle.name}
              size="sm"
              selected={muscleId === muscle.id}
              onPress={() => setMuscleId(muscleId === muscle.id ? null : muscle.id)}
            />
          ))}
        </Rail>
        <Rail>
          {(taxonomy.data?.equipment ?? []).map((piece) => (
            <Chip
              key={piece.id}
              label={piece.name}
              size="sm"
              selected={equipmentId === piece.id}
              onPress={() => setEquipmentId(equipmentId === piece.id ? null : piece.id)}
            />
          ))}
        </Rail>
      </Stack>

      {filtered ? (
        <Button
          label={t('picker.clearFilter')}
          variant="secondary"
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
          title={t('picker.unreachable')}
        />
      ) : search.isLoading ? (
        <SkeletonList rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          compact
          icon="search"
          title={t(searching || filtered ? 'states.pickerNoMatch' : 'states.pickerStart')}
          message={t(
            searching || filtered ? 'states.pickerNoMatchBody' : 'states.pickerStartBody',
          )}
        />
      ) : (
        <View>
          {rows.map((exercise) => (
            <PickerRow
              key={exercise.id}
              exercise={exercise}
              theme={theme}
              included={isIncluded(exercise.id)}
              // Rows from the previous filter while the new one is in flight: dimmed, because
              // they are real data that is about to be wrong. Tapping one would add the wrong
              // exercise, so they stay inert until the new results land.
              dimmed={search.isPlaceholder}
              onSelect={select}
            />
          ))}
        </View>
      )}

      {search.hasMore ? (
        <Button
          label={t('picker.loadMore')}
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

      {includedCount > 0 ? (
        <Txt variant="micro" tone="faint" align="center">
          {t('details.pickerIncluded', { count: includedCount })}
        </Txt>
      ) : null}
    </FormSheet>
  );
}

/**
 * One library result. Memoised with the theme and a shared `onSelect` as props, so typing
 * (which re-renders the sheet on every keystroke) does not re-render two dozen rows whose
 * exercise did not change.
 */
const PickerRow = memo(function PickerRow({
  exercise,
  theme,
  included,
  dimmed,
  onSelect,
}: {
  exercise: Exercise;
  theme: Theme;
  included: boolean;
  dimmed: boolean;
  onSelect: (exercise: Exercise) => void;
}) {
  const { t } = useT();
  const tags = useMemo(() => exerciseTags(exercise), [exercise]);
  const press = useCallback(() => onSelect(exercise), [onSelect, exercise]);

  return (
    <ListRow
      theme={theme}
      title={exercise.name}
      tags={tags}
      tagsMax={2}
      {...(included ? {} : { onPress: press })}
      disabled={included}
      style={[styles.row, { borderTopColor: theme.colors.hairline }, dimmed ? styles.dimmed : null]}
      accessibilityHint={
        t(included ? 'states.alreadyInRoutine' : 'states.addsToRoutine')
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
          size={ICON_SIZE.inline}
          color={included ? theme.colors.accent : theme.colors.textMuted}
        />
      }
    />
  );
});

const styles = StyleSheet.create({
  row: { borderTopWidth: StyleSheet.hairlineWidth },
  dimmed: { opacity: 0.45 },
});
