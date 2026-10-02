import { memo } from 'react';
import { Chip } from '@/features/core/design-system';
import { useTaxonChipLogic } from '@/features/exercises/ui/components/TaxonChip/TaxonChip.logic';

/** One filter value: a muscle or a piece of equipment, on or off. */
export const TaxonChip = memo(function TaxonChip({
  id,
  label,
  selected,
  onToggle,
}: {
  id: string;
  label: string;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  const { effects } = useTaxonChipLogic(id, onToggle);
  return <Chip label={label} size="sm" selected={selected} onPress={effects.toggle} />;
});
