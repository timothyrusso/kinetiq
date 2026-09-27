import { Rail } from '@/features/core/design-system';
import type { Taxon } from '@/features/exercises/domain/schemas/ExerciseTaxonomySchema';
import { TaxonChip } from '@/features/exercises/ui/components/TaxonChip/TaxonChip';

/** Every value of one taxonomy on one horizontal rail; tapping the selected one clears it. */
export function TaxonFilterRail({
  taxa,
  selectedId,
  onToggle,
}: {
  taxa: readonly Taxon[];
  selectedId: number | null;
  onToggle: (id: number) => void;
}) {
  return (
    <Rail>
      {taxa.map(taxon => (
        <TaxonChip
          key={taxon.id}
          id={taxon.id}
          label={taxon.name}
          selected={selectedId === taxon.id}
          onToggle={onToggle}
        />
      ))}
    </Rail>
  );
}
