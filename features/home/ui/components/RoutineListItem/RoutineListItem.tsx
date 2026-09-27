import { memo } from 'react';
import { RoutineRow } from '@/features/core/design-system';
import type { Theme } from '@/features/core/theme';
import type { TKey, TVars } from '@/features/core/translations';
import { useRoutineListItemLogic } from '@/features/home/ui/components/RoutineListItem/RoutineListItem.logic';
import type { Routine } from '@/features/routines';

/**
 * One routine row. Memoised with the id-taking `onOpen`, so a re-render of the tab (a new sort, a
 * routine saved elsewhere) redraws only the rows whose routine changed. `t` is a prop so a
 * language change reaches a row its memo would otherwise skip.
 */
export const RoutineListItem = memo(function RoutineListItem({
  routine,
  theme,
  t,
  locale,
  first,
  onOpen,
}: {
  routine: Routine;
  theme: Theme;
  t: (key: TKey, vars?: TVars) => string;
  locale: string;
  first: boolean;
  onOpen: (id: string) => void;
}) {
  const { derived, effects } = useRoutineListItemLogic(routine, t, locale, onOpen);
  return <RoutineRow routine={routine} theme={theme} meta={derived.meta} topDivider={!first} onPress={effects.press} />;
});
