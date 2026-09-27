import type { ActivityKind } from '@/domain/types';
import type { IconName } from '@/features/core/design-system/icons/icons';

/** Activity kind → glyph. One table, so a kind can never render the wrong icon. */
export const ACTIVITY_ICON: Record<ActivityKind, IconName> = {
  lift: 'dumbbell',
};
