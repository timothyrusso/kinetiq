import { useCallback } from 'react';

/** The chip's press, which hands back its taxon's id. */
export function useTaxonChipLogic(id: number, onToggle: (id: number) => void) {
  const toggle = useCallback(() => onToggle(id), [id, onToggle]);
  return { effects: { toggle } };
}
