/**
 * Activity → text, in the user's units.
 *
 * `ActivityRow` deliberately takes its `headline` and `subtitle` already formatted.
 * That looks like a leak at first: the row has the activity, so why make the caller
 * format it?: but it is the right cut for one reason: which metric deserves the
 * headline position depends on the kind *and* on settings, and a row that guessed
 * would be wrong half the time. A ride reads as distance to a runner and as average
 * speed to a cyclist; a lift has neither, and its interesting number is volume.
 *
 * So the decision lives here, once, as pure functions: not duplicated across Home,
 * the Activities tab and a routine's history, and not inside a component that would
 * then need the unit settings handed to it anyway.
 */
import type { Activity, ActivityKind, ActivitySplit } from './types';
import {
  compactNumber,
  distanceValue,
  formatDistance,
  formatDurationCompact,
  formatPaceShort,
  formatSpeed,
  formatWeight,
  joinMiddleDot,
  type UnitSystem,
} from '@/utils/format';

export type ActivityDisplay = {
  /** Big right-aligned number: "8.43 km", "12.4k kg", "52 min". */
  headline: string;
  /** What sits under the title: "52 min · 5:58 /km · 412 kcal". */
  subtitle: string;
  /** One-line plain-language summary for screen readers. */
  accessibilityLabel: string;
};

/**
 * The metric that best represents a session of this kind.
 *
 * Lifts lead with volume because it is the only number that scales with effort;
 * cardio leads with distance because duration is already in the subtitle. A cardio
 * activity with no distance (a treadmill run, or a GPS fix that never came) falls
 * back to duration rather than showing "0.00 km", which would read as a lie about
 * the session rather than as an absence of data.
 */
export function activityDisplay(
  activity: Activity,
  units: UnitSystem,
  showSpeedInsteadOfPace = false,
): ActivityDisplay {
  const duration = formatDurationCompact(activity.durationSeconds);
  const calories =
    activity.caloriesKcal > 0 ? `${Math.round(activity.caloriesKcal)} kcal` : null;

  if (activity.kind === 'lift') {
    const volume = activity.strength?.totalVolumeKg ?? 0;
    const sets = activity.strength?.totalSets ?? 0;
    return {
      headline: volume > 0 ? formatWeight(volume, units) : duration,
      subtitle: joinMiddleDot([
        duration,
        sets > 0 ? `${sets} ${sets === 1 ? 'set' : 'sets'}` : null,
        calories,
      ]),
      accessibilityLabel:
        volume > 0
          ? `${activity.title}. ${sets} sets, ${formatWeight(volume, units)} total volume, ${duration}.`
          : `${activity.title}. ${duration}.`,
    };
  }

  const cardio = activity.cardio;
  const distance = cardio?.distanceMeters ?? 0;
  const hasDistance = distance > 0;

  const pacePart =
    cardio === null || !hasDistance
      ? null
      : showSpeedInsteadOfPace
        ? formatSpeed(cardio.avgSpeedMps ?? speedFrom(distance, activity.durationSeconds), units)
        : formatPaceShort(cardio.avgPaceSecPerKm, units);

  const headline = hasDistance ? formatDistance(distance, units) : duration;

  return {
    headline,
    subtitle: joinMiddleDot([duration, pacePart, calories]),
    accessibilityLabel: hasDistance
      ? `${activity.title}. ${formatDistance(distance, units)} in ${duration}.`
      : `${activity.title}. ${duration}.`,
  };
}

/**
 * Short summary for a dense list (a routine's session history, a search result)
 * where the two-line row would not fit.
 */
export function activityInline(activity: Activity, units: UnitSystem): string {
  const duration = formatDurationCompact(activity.durationSeconds);
  if (activity.kind === 'lift') {
    const volume = activity.strength?.totalVolumeKg ?? 0;
    return volume > 0 ? `${formatWeight(volume, units)} · ${duration}` : duration;
  }
  const distance = activity.cardio?.distanceMeters ?? 0;
  return distance > 0 ? `${formatDistance(distance, units)} · ${duration}` : duration;
}

export type SplitRow = {
  label: string;
  distanceLabel: string;
  durationSeconds: number;
  /** Already in min/km or min/mi: a split row should not be doing unit maths. */
  paceLabel: string;
  heartRate: number | null;
  elevationGainMeters: number;
  /** The quickest split, marked so a detail screen can call it out. */
  fastest: boolean;
  /** The slowest, which is usually the last one and is worth knowing too. */
  slowest: boolean;
};

/**
 * Per-kilometre splits, or `null` when there are none.
 *
 * `null` rather than `[]` matters to the caller: an empty array would render an empty
 * table with a heading, which reads as a data bug. `null` lets the detail screen say
 * "this activity has no splits" honestly.
 *
 * The fastest/slowest flags are computed here rather than in the row renderer,
 * because "fastest" is a comparison across the whole set and a per-row component
 * cannot see its siblings.
 */
export function splitRows(
  splits: readonly ActivitySplit[],
  units: UnitSystem,
): SplitRow[] | null {
  if (splits.length === 0) return null;

  let fastest = Number.POSITIVE_INFINITY;
  let slowest = Number.NEGATIVE_INFINITY;
  for (const split of splits) {
    // A zero-pace split means "no timing for this segment", not a superhuman kilometre.
    if (split.paceSecPerKm > 0) {
      fastest = Math.min(fastest, split.paceSecPerKm);
      slowest = Math.max(slowest, split.paceSecPerKm);
    }
  }

  return splits.map((split) => {
    const timed = split.paceSecPerKm > 0;
    return {
      // The split's own stored index, not the array position: an activity may record
      // splits from partway through a session, and renumbering from 1 would claim
      // kilometres that were never timed.
      label: `${split.index + 1}`,
      distanceLabel: distanceValue(split.distanceMeters, units).toFixed(2),
      durationSeconds: split.durationSeconds,
      paceLabel: formatPaceShort(split.paceSecPerKm, units),
      heartRate: split.heartRate,
      elevationGainMeters: split.elevationGainMeters,
      // Every split tying on the best pace is flagged, not just the first. Two identical
      // kilometres are both the fastest kilometre, and hiding the second one would make
      // the highlight look arbitrary once someone compared the two rows.
      fastest: timed && split.paceSecPerKm === fastest,
      slowest: timed && split.paceSecPerKm === slowest,
    };
  });
}

/** Minutes per kind over a set of activities, for the distribution donut. */
export function minutesByKind(activities: readonly Activity[]): Map<ActivityKind, number> {
  const map = new Map<ActivityKind, number>();
  for (const activity of activities) {
    map.set(activity.kind, (map.get(activity.kind) ?? 0) + activity.durationSeconds / 60);
  }
  return map;
}

/** "3 runs, 2 lifts": the sentence a weekly summary wants, in a stable kind order. */
export function kindBreakdown(activities: readonly Activity[]): string {
  const counts = new Map<ActivityKind, number>();
  for (const activity of activities) {
    counts.set(activity.kind, (counts.get(activity.kind) ?? 0) + 1);
  }
  return KIND_ORDER.filter((kind) => (counts.get(kind) ?? 0) > 0)
    .map((kind) => `${counts.get(kind)} ${KIND_WORD[kind](counts.get(kind) ?? 0)}`)
    .join(', ');
}

export const KIND_ORDER: readonly ActivityKind[] = ['run', 'ride', 'lift', 'walk', 'yoga'];

const KIND_WORD: Record<ActivityKind, (count: number) => string> = {
  run: (n) => (n === 1 ? 'run' : 'runs'),
  ride: (n) => (n === 1 ? 'ride' : 'rides'),
  lift: (n) => (n === 1 ? 'lift' : 'lifts'),
  walk: (n) => (n === 1 ? 'walk' : 'walks'),
  yoga: (n) => (n === 1 ? 'yoga session' : 'yoga sessions'),
};

/** Compact volume for chart readouts, where "12,400 kg" would not fit a column. */
export function formatVolumeShort(kg: number): string {
  return kg >= 10_000 ? `${compactNumber(kg)} kg` : `${Math.round(kg)} kg`;
}

function speedFrom(meters: number, seconds: number): number {
  return seconds > 0 ? meters / seconds : 0;
}
