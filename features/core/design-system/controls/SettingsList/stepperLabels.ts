import type { TKey, TVars } from '@/features/core/translations';

/** What a screen reader calls a stepper row's minus and plus, named after the row. */
export function stepperLabels(
  title: string,
  t: (key: TKey, vars?: TVars) => string,
): { readonly decrease: string; readonly increase: string } {
  return {
    decrease: t('settingsList.decrease', { title }),
    increase: t('settingsList.increase', { title }),
  };
}
