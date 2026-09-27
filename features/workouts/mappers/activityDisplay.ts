import type { MetaItem } from '@/features/core/design-system';
import { tr } from '@/features/core/translations';
import { formatDurationCompact, formatWeight, type UnitSystem } from '@/features/core/utils';
import type { Activity } from '@/features/workouts/domain/schemas/ActivitySchema';

/** How a recorded workout reads: its headline number, the facts under its title, and a sentence. */
export interface ActivityDisplay {
  /** The big right-aligned number: "12.4k kg", or "52 min" for a bodyweight session. */
  readonly headline: string;
  readonly meta: readonly MetaItem[];
  /** The one-line summary a screen reader speaks. */
  readonly accessibilityLabel: string;
}

/**
 * A workout in the user's units. A lift leads with volume, the only number that scales with
 * effort; a workout with no weighted set falls back to its duration rather than "0 kg". The list
 * card and the detail share this, so they cannot disagree about rounding.
 */
export function activityDisplay(activity: Activity, units: UnitSystem): ActivityDisplay {
  const duration = formatDurationCompact(activity.durationSeconds);
  const volume = activity.strength?.totalVolumeKg ?? 0;
  const sets = activity.strength?.totalSets ?? 0;

  const meta: MetaItem[] = [{ icon: 'clock', label: duration }];
  if (sets > 0) meta.push({ icon: 'layers', label: tr('workout.set', { count: sets }) });
  if (activity.caloriesKcal > 0) meta.push({ icon: 'flame', label: `${Math.round(activity.caloriesKcal)} kcal` });

  return {
    headline: volume > 0 ? formatWeight(volume, units) : duration,
    meta,
    accessibilityLabel:
      volume > 0
        ? tr('followups.a11yLift', {
            title: activity.title,
            sets: tr('workout.set', { count: sets }),
            volume: formatWeight(volume, units),
            duration,
          })
        : tr('followups.a11yPlain', { title: activity.title, duration }),
  };
}
