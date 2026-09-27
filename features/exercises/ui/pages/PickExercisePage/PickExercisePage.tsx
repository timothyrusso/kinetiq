import { View } from 'react-native';
import {
  Button,
  EmptyState,
  ErrorState,
  FormSheet,
  SkeletonList,
  Stack,
  TextInput,
  Txt,
} from '@/features/core/design-system';
import { useAppTheme } from '@/features/core/theme';
import { useT } from '@/features/core/translations';
import { ExercisePickerRow } from '@/features/exercises/ui/components/ExercisePickerRow/ExercisePickerRow';
import { TaxonFilterRail } from '@/features/exercises/ui/components/TaxonFilterRail/TaxonFilterRail';
import {
  type PickExercisePageProps,
  usePickExercisePageLogic,
} from '@/features/exercises/ui/pages/PickExercisePage/PickExercisePage.logic';

/**
 * The exercise library picker, the body of the `pick-exercise` form sheet. The route decides the
 * destination (the routine builder's draft, a saved routine or the live session) and passes
 * `onPick`; the picker knows nothing about any of them. Every muscle and every piece of equipment
 * gets one rail each: a capped, wrapped set used to show the first six by name, which kept
 * Brachialis and hid Quads.
 */
export function PickExercisePage(props: PickExercisePageProps) {
  const { state, derived, effects } = usePickExercisePageLogic(props);
  const { t } = useT();
  const theme = useAppTheme();

  return (
    <FormSheet title={t('picker.title')} doneLabel="picker.done" scroll>
      <Txt variant="caption" tone="muted">
        {t('picker.subtitle')}
      </Txt>
      {props.error ? (
        <Txt variant="caption" tone="danger">
          {props.error}
        </Txt>
      ) : null}
      <TextInput
        label={t('picker.search')}
        value={state.query}
        onChangeText={effects.setQuery}
        placeholder={t('picker.placeholder')}
        // NOTE: text rather than a spinner: a hint is announced, and it explains the one state
        // where typing has been received and nothing has moved yet.
        hint={
          state.settling ? t('exerciseList.searching') : t('details.pickerInLibrary', { total: state.total ?? '-' })
        }
        accessibilityHint={t('picker.searchHint')}
      />
      <Stack gap="sm">
        <TaxonFilterRail taxa={state.muscles} selectedId={state.muscleId} onToggle={effects.toggleMuscle} />
        <TaxonFilterRail taxa={state.equipment} selectedId={state.equipmentId} onToggle={effects.toggleEquipment} />
      </Stack>

      {derived.filtered ? (
        <Button
          label={t('picker.clearFilter')}
          variant="secondary"
          size="sm"
          icon="close"
          onPress={effects.clearFilters}
        />
      ) : null}

      {state.error !== null ? (
        <ErrorState error={state.error} onRetry={effects.retry} compact title={t('picker.unreachable')} />
      ) : state.isLoading ? (
        <SkeletonList rows={6} />
      ) : state.rows.length === 0 ? (
        <EmptyState
          compact
          icon="search"
          title={t(derived.searching || derived.filtered ? 'states.pickerNoMatch' : 'states.pickerStart')}
          message={t(derived.searching || derived.filtered ? 'states.pickerNoMatchBody' : 'states.pickerStartBody')}
        />
      ) : (
        <View>
          {state.rows.map(exercise => (
            <ExercisePickerRow
              key={exercise.id}
              exercise={exercise}
              theme={theme}
              included={effects.isIncluded(exercise.id)}
              // NOTE: rows from the previous filter while the new one is read: dimmed, because they
              // are about to be wrong, and inert, so a tap cannot add the wrong exercise.
              dimmed={state.isPlaceholder}
              onSelect={effects.select}
            />
          ))}
        </View>
      )}

      {state.hasMore ? (
        <Button
          label={t('picker.loadMore')}
          variant="secondary"
          size="sm"
          loading={state.isFetchingNextPage}
          disabled={state.isFetchingNextPage}
          onPress={effects.loadMore}
        />
      ) : null}

      {derived.includedCount > 0 ? (
        <Txt variant="micro" tone="faint" align="center">
          {t('details.pickerIncluded', { count: derived.includedCount })}
        </Txt>
      ) : null}
    </FormSheet>
  );
}
