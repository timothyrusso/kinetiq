/**
 * Activity → text, in the user's units.
 *
 * `ActivityRow` deliberately takes its `headline` and `subtitle` already formatted, so the
 * choice of headline metric (volume, or duration when a session has none) lives here once
 * rather than in every list that draws a workout.
 */
import type { Activity } from './types';
import { formatDurationCompact, formatWeight, joinMiddleDot, type UnitSystem } from '@/utils/format';
import { tr } from '@/i18n/tr';

export type ActivityDisplay = {
  /** Big right-aligned number: "12.4k kg", "52 min". */
  headline: string;
  /** What sits under the title: "52 min · 18 sets · 412 kcal". */
  subtitle: string;
  /** One-line plain-language summary for screen readers. */
  accessibilityLabel: string;
};

/**
 * Lifts lead with volume because it is the only number that scales with effort; a session
 * with no weighted sets (all bodyweight) falls back to duration rather than "0 kg".
 */
export function activityDisplay(activity: Activity, units: UnitSystem): ActivityDisplay {
  const duration = formatDurationCompact(activity.durationSeconds);
  const calories =
    activity.caloriesKcal > 0 ? `${Math.round(activity.caloriesKcal)} kcal` : null;

  const volume = activity.strength?.totalVolumeKg ?? 0;
  const sets = activity.strength?.totalSets ?? 0;
  return {
    headline: volume > 0 ? formatWeight(volume, units) : duration,
    subtitle: joinMiddleDot([
      duration,
      sets > 0 ? tr('workout.set', { count: sets }) : null,
      calories,
    ]),
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
