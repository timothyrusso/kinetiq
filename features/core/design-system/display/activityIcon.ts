import type { IconName } from '@/features/core/design-system/icons/icons';

/**
 * Activity kind to glyph. One table, so a kind can never render the wrong icon. Keyed by the kind's
 * stored name; Kinetiq records lifting sessions only.
 */
export const ACTIVITY_ICON: Readonly<Record<'lift', IconName>> = {
  lift: 'dumbbell',
};
