/**
 * Activity → structured metadata, in the user's units.
 *
 * `activityDisplay` in `src/domain/display.ts` still decides the headline (distance for cardio,
 * volume for a lift) and the spoken summary; this adds the facts under the title as items, so
 * they can carry icons and wrap between items instead of arriving as one joined string.
 */
import type { Activity } from '@/domain/types';
import { activityDisplay } from '@/domain/display';
import { tr } from '@/i18n/tr';
import {
  formatDurationCompact,
  formatPaceShort,
  formatSpeed,
  type UnitSystem,
} from '@/utils/format';
import type { MetaItem } from './types';

export type ActivitySummary = {
  headline: string;
  meta: MetaItem[];
  accessibilityLabel: string;
};

export function activitySummary(
  activity: Activity,
  units: UnitSystem,
  showSpeedInsteadOfPace = false,
): ActivitySummary {
  const { headline, accessibilityLabel } = activityDisplay(activity, units, showSpeedInsteadOfPace);
  const meta: MetaItem[] = [{ icon: 'clock', label: formatDurationCompact(activity.durationSeconds) }];

  if (activity.kind === 'lift') {
    const sets = activity.strength?.totalSets ?? 0;
    if (sets > 0) meta.push({ icon: 'layers', label: tr('workout.set', { count: sets }) });
  } else {
    const cardio = activity.cardio;
    const distance = cardio?.distanceMeters ?? 0;
    if (cardio && distance > 0) {
      meta.push(
        showSpeedInsteadOfPace
          ? {
              icon: 'scale',
              label: formatSpeed(
                cardio.avgSpeedMps ?? distance / Math.max(1, activity.durationSeconds),
                units,
              ),
            }
          : { icon: 'timer', label: formatPaceShort(cardio.avgPaceSecPerKm, units) },
      );
    }
  }

  if (activity.caloriesKcal > 0) {
    meta.push({ icon: 'flame', label: `${Math.round(activity.caloriesKcal)} kcal` });
  }
  return { headline, meta, accessibilityLabel };
}
