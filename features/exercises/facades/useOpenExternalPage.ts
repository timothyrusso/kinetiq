import { useEffectMutation } from '@/features/core/query';
import { openExternalPage } from '@/features/exercises/useCases/openExternalPage';

/**
 * Opens a web page outside the app. Fired and forgotten: a device that refuses the link is
 * logged once at the boundary, and the screen stays where it was.
 */
export function useOpenExternalPage() {
  return useEffectMutation({ mutationFn: (url: string) => openExternalPage(url) }).mutate;
}
