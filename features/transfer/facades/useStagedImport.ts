import { useEffect, useState } from 'react';
import { useStagedImportStore } from '@/features/transfer/state/stagedImportStore';

/**
 * The staged import, read once: it is fixed for the preview's lifetime, and cleared when the
 * preview goes, so a later visit never shows it again.
 */
export function useStagedImport() {
  const [staged] = useState(() => useStagedImportStore.getState().staged);
  useEffect(() => () => useStagedImportStore.getState().clear(), []);
  return staged;
}
