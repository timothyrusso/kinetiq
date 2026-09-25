/**
 * Activity → structured metadata, in the user's units.
 *
 * `activityDisplay` in `src/domain/display.ts` still decides the headline (volume, or duration
 * for a bodyweight session) and the spoken summary; this adds the facts under the title as items, so
 * they can carry icons and wrap between items instead of arriving as one joined string.
 */
import type { Activity } from '@/domain/types';
import { activityDisplay } from '@/domain/display';
import { tr } from '@/i18n/tr';
import { formatDurationCompact, type UnitSystem } from '@/utils/format';
import type { MetaItem } from './types';

export type ActivitySummary = {
  headline: string;
  meta: MetaItem[];
  accessibilityLabel: string;
};

export function activitySummary(activity: Activity, units: UnitSystem): ActivitySummary {
  const { headline, accessibilityLabel } = activityDisplay(activity, units);
  const meta: MetaItem[] = [{ icon: 'clock', label: formatDurationCompact(activity.durationSeconds) }];

  const sets = activity.strength?.totalSets ?? 0;
  if (sets > 0) meta.push({ icon: 'layers', label: tr('workout.set', { count: sets }) });

  if (activity.caloriesKcal > 0) {
    meta.push({ icon: 'flame', label: `${Math.round(activity.caloriesKcal)} kcal` });
  }
  return { headline, meta, accessibilityLabel };
}
