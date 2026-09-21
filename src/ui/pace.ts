/**
 * Pace → colour, the one place a colour is computed rather than chosen.
 *
 * ## Why a ramp and not a palette
 *
 * A route line coloured by effort needs a colour *per point*, and there is no finite palette
 * that maps a continuous quantity onto distinguishable-but-harmonious colours. A ramp built
 * from three brand stops does: slow end at azure, easy-middle at spark, hard end at coral, so
 * a green segment means the same thing on every activity in the app.
 *
 * ## The anchors are per-kind
 *
 * 4:30/km is a hard run and an impossible walk. Comparing a user's pace against a universal
 * constant would colour every beginner's run "easy" and every ride "sprint", so each kind gets
 * its own slow/fast pair, set at paces a recreational athlete actually holds. A walk ramp
 * anchored at running paces would paint the whole thing coral and teach the user to ignore it.
 *
 * ## Relative mode
 *
 * `relative` colours against the activity's own distribution rather than the absolute anchors:
 * the fastest kilometre gets the hot end, the slowest the cool end. That is the honest default
 * for a user comparing *this* run to *itself*: hills show up: where the absolute scale makes a
 * hilly run look uniformly "slow" and tells them nothing they could act on.
 */
import { palette } from '@/theme/tokens';
import { ramp } from '@/utils/color';
import { haversine } from '@/utils/geometry';
import type { ActivityKind, RoutePoint } from '@/domain/types';

/** Cool → warm. Same three hues in every ramp so a colour means the same effort everywhere. */
const STOPS = [palette.azure, palette.spark, palette.coral] as const;

/** `[slowestColoured, fastestColoured]` in seconds per kilometre. */
const ANCHORS: Partial<Record<ActivityKind, readonly [number, number]>> = {
  run: [420, 240],
  walk: [1200, 660],
  ride: [300, 90],
};

export type PaceColourMode = 'absolute' | 'relative';

export type PaceDomain = {
  /** Colour at t=0: the *slowest* end. */
  slowSecPerKm: number;
  /** Colour at t=1: the *fastest* end. */
  fastSecPerKm: number;
};

/**
 * The colour domain for an activity.
 *
 * Falls back to the running anchors for a kind that has none (a lift session has no pace, and
 * callers that ask for one are drawing a trace they should not be) rather than returning null,
 * because the alternative is a null check at every call site of a function whose only job is to
 * make a line look right.
 */
export function paceDomainFor(kind: ActivityKind): PaceDomain {
  const anchors = ANCHORS[kind] ?? ANCHORS.run!;
  return { slowSecPerKm: anchors[0], fastSecPerKm: anchors[1] };
}

/**
 * One colour for one pace.
 *
 * `domain` is inverted from intuition on purpose: a *lower* pace value is a *faster* effort and
 * so belongs at the hot end. Every caller passes seconds-per-kilometre, the app's canonical
 * pace unit, including rides: convert to m/s for display, not for colouring.
 */
export function paceColor(secPerKm: number, domain: PaceDomain): string {
  if (!Number.isFinite(secPerKm) || secPerKm <= 0) return STOPS[0];
  const span = domain.slowSecPerKm - domain.fastSecPerKm;
  if (span <= 0) return STOPS[1];
  return ramp(STOPS, (domain.slowSecPerKm - secPerKm) / span, STOPS[1]);
}

/**
 * Colours one per coordinate, for `MapPolyline.strokeColors`, which requires exactly one
 * colour per point.
 *
 * Pace at a point is not a primitive: it is the *segment* it closes, and a segment made of two
 * fixes 90 seconds apart is either a rest stop or a sprint depending on the distance between
 * them. So pace comes from distance over elapsed, and implausible values (a tunnel, a paused
 * phone, a corrupted fix) inherit the previous point's colour instead of painting a
 * kilometre-long gap in the sprint hue.
 */
export function paceColorsForRoute(points: readonly RoutePoint[], kind: ActivityKind): string[] {
  if (points.length === 0) return [];
  const domain = paceDomainFor(kind);
  const meters = cumulativeMeters(points);
  const firstPace = midPace(points, meters, 0, 1, domain);
  const colors: string[] = [firstPace === null ? STOPS[1] : paceColor(firstPace, domain)];
  for (let i = 1; i < points.length; i += 1) {
    const pace = midPace(points, meters, i - 1, i, domain);
    // Inherit rather than interpolate: a colour that changes abruptly at one point is a data
    // artefact, and smoothing it would spread the artefact across its neighbours.
    colors.push(pace === null ? (colors[i - 1] ?? STOPS[1]) : paceColor(pace, domain));
  }
  return colors;
}

/** Cumulative distance at each point, derived from the coordinates. */
function cumulativeMeters(points: readonly RoutePoint[]): number[] {
  const out: number[] = [0];
  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1];
    const current = points[i];
    const step =
      previous === undefined || current === undefined
        ? 0
        : haversine(previous.coords, current.coords);
    out.push((out[i - 1] ?? 0) + step);
  }
  return out;
}

/** Seconds per kilometre over `[from, to]`, or null when the segment is not usable. */
function midPace(
  points: readonly RoutePoint[],
  meters: readonly number[],
  from: number,
  to: number,
  domain: PaceDomain,
): number | null {
  const a = points[from];
  const b = points[to];
  if (a === undefined || b === undefined) return null;
  const segmentMeters = (meters[to] ?? 0) - (meters[from] ?? 0);
  const seconds = (b.t - a.t) / 1000;
  if (segmentMeters <= 0 || seconds <= 0) return null;
  const pace = (seconds / segmentMeters) * 1000;
  // 3× outside the anchors is a broken fix, not an effort: a 21-minute kilometre while running
  // is a phone left on a bench, and colouring it "slow" would mislabel everything after it too.
  if (pace > domain.slowSecPerKm * 3) return null;
  return pace;
}

/** Swatches for the legend, in ramp order: slow, easy, hard. */
export const PACE_RAMP_STOPS: readonly string[] = STOPS;

/**
 * The ramp's midpoint, for callers that need one neutral colour: a fallback when a segment's
 * pace cannot be derived, where "the middle of the ramp" is honest and "the first stop" would
 * read as a real measurement of a slow effort.
 */
export const PACE_RAMP_MID: string = STOPS[1] ?? STOPS[0];
