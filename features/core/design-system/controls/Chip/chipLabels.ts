import type { TKey, TVars } from '@/features/core/translations';

/** What a screen reader calls a chip, with its result count, and its remove control. */
export function chipLabels(
  label: string,
  count: number | undefined,
  t: (key: TKey, vars?: TVars) => string,
): { readonly chip: string; readonly remove: string } {
  return {
    chip: count === undefined ? label : t('chip.results', { label, count }),
    remove: t('chip.remove', { label }),
  };
}
