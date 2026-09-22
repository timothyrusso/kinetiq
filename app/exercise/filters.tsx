/**
 * The Exercises tab's filters, as a form sheet over the list.
 *
 * It owns no state: every selection writes straight to the shared filter store. A sheet that
 * buffered a draft filter behind an Apply button would need a second copy of the filter and a
 * diff to know whether anything changed. Writing through means what you see is what the list
 * is, and the list behind the sheet updates live.
 */
import { StyleSheet, View } from 'react-native';

import type { Taxon } from '@/domain/types';
import { useT } from '@/i18n/useT';
import {
  resetExerciseFilter,
  setExerciseCategoryId,
  setExerciseEquipmentId,
  setExerciseMuscleId,
  useExerciseFilter,
} from '@/queries/exerciseFilters';
import { useExerciseTaxonomy } from '@/queries/useExercises';
import { spacing } from '@/theme/tokens';
import { Button } from '@/ui/controls/Button';
import { Chip } from '@/ui/controls/Chip';
import { FormSheet } from '@/ui/FormSheet';
import { Txt } from '@/ui/Text';

export default function ExerciseFiltersSheet() {
  const { t } = useT();
  const taxonomy = useExerciseTaxonomy();
  const { filter } = useExerciseFilter();

  return (
    <FormSheet title={t('exerciseList.filterTitle')} scroll>
      <TaxonPicker
        title={t('exerciseList.category')}
        taxons={taxonomy.data?.categories ?? []}
        value={filter.categoryId}
        onChange={setExerciseCategoryId}
        loading={taxonomy.isPending}
      />
      <TaxonPicker
        title={t('exerciseList.primaryMuscle')}
        taxons={taxonomy.data?.muscles ?? []}
        value={filter.muscleId}
        onChange={setExerciseMuscleId}
        loading={taxonomy.isPending}
      />
      <TaxonPicker
        title={t('exerciseList.equipment')}
        taxons={taxonomy.data?.equipment ?? []}
        value={filter.equipmentId}
        onChange={setExerciseEquipmentId}
        loading={taxonomy.isPending}
      />
      {taxonomy.isError ? (
        <Txt variant="caption" tone="muted">
          {t('exerciseList.taxonomyFailed')}
        </Txt>
      ) : null}
      <Button label={t('exerciseList.showAll')} variant="secondary" onPress={resetExerciseFilter} />
    </FormSheet>
  );
}

function TaxonPicker({
  title,
  taxons,
  value,
  onChange,
  loading,
}: {
  title: string;
  taxons: readonly Taxon[];
  value: number | null;
  onChange: (next: number | null) => void;
  loading: boolean;
}) {
  const { t } = useT();
  if (loading) {
    return (
      <Txt variant="caption" tone="faint">
        {t('exerciseList.loadingOptions', { what: title.toLowerCase() })}
      </Txt>
    );
  }
  // An empty group is hidden rather than shown empty: "Equipment · Any" with nothing after it
  // reads as a broken fetch, when the provider just has none for this install.
  if (taxons.length === 0) return null;
  return (
    <View style={styles.group}>
      <Txt variant="label" tone="muted" uppercase tracking={0.8}>
        {title}
      </Txt>
      <View style={styles.chips}>
        <Chip label={t('exerciseList.any')} size="sm" selected={value === null} onPress={() => onChange(null)} />
        {taxons.map((taxon) => (
          <Chip
            key={taxon.id}
            label={taxon.name}
            size="sm"
            selected={value === taxon.id}
            onPress={() => onChange(taxon.id)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
