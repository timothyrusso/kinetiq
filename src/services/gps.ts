/**
 * The maths of a trail: which GPS fixes to believe, how far apart they are, and how
 * the result is cut into splits and thinned for storage.
 *
 * This file deliberately imports nothing platform-specific: no `react-native`, no
 * `expo-location`: so the whole anti-jitter policy can be exercised directly in node
 * against synthetic fixes. That matters more here than almost anywhere else in the
 * app: the acceptance rules below decide whether a run reads 5.0 km or 6.4 km, and
 * neither the simulator nor a unit-test runner can produce a real satellite sky. A
 * device proves that fixes *arrive*; only a table like the ones in this file's
 * docstrings proves what gets done with them.
 *
 * `location.ts` owns the device: permissions, subscriptions, the durable draft, the
 * headless task. It answers *where am I*; this file answers *what is that worth*.
 */

import type { ActivityKind, ActivitySplit, LatLng, RoutePoint } from '@/domain/types';
import { paceFromDistance } from '@/domain/logic';
import {
  elevationGain,
  haversine,
  resampleRoute,
  splitRouteByDistance,
} from '@/utils/geometry';
import { mean } from '@/utils/functional';

/** A fix must be this good (or better) before it contributes distance. */
export const GPS_ACCURACY_FLOOR_M = 24;
/**
 * Segments below this are GPS jitter. 4 m at ~2 samples/second is 8 m/s: well
 * above any human pace: so real motion passes and wobble does not. Below ~0.8
 * m/s (a slow walk) some segments get skipped, which under-reads distance by a
 * few percent; that is the correct trade, because the failure mode of a lower
 * floor is a run that reads 1.5 km longer than it was.
 */
export const GPS_MIN_SEGMENT_M = 4;
/** Fastest a human (or a bicycle at sprint effort) legitimately moves; faster means noise. */
export const MAX_HUMAN_SPEED_MPS = 8;
/** Stored routes are thinned to this many points; long enough that the shape survives. */
export const MAX_STORED_POINTS = 2000;

/**
 * Whether a fix is trustworthy, in order of preference: the device's own speed
 * estimate (derived from Doppler, so immune to position jitter), then a pace
 * sanity check. `null` means the platform gave no speed, which is not a
 * rejection: the caller still has the segment-length floor.
 *
 * A reported speed of *exactly* zero is treated as a cross-check rather than a
 * ceiling. It is the device asserting it is not moving, and a hop longer than the
 * jitter floor contradicts that: which is precisely the artefact that inflates a
 * phone left on a seat: positions wander 5-15 m every second at a perfectly good
 * reported accuracy, and each hop clears a bare length floor. Real motion almost
 * never reports exactly 0.0, so what this gives up is a slow walk whose Doppler
 * reading dropped to zero, the same class of loss `GPS_MIN_SEGMENT_M` already
 * accepts deliberately.
 *
 * **What this deliberately does not catch.** A large *position* error: urban
 * multipath putting the fix 100 m off while the runner holds a true 3 m/s: is
 * accepted, because Doppler sits near the top of its band and the positions are
 * what we sum. Catching it needs a ceiling scaled by reported accuracy
 * (`speed × dt + accuracy`), and no threshold like that can be calibrated from a
 * simulator or a table; it needs a logged sky from real runs. Guessing one risks
 * under-reading honest distance, which is the worse of the two errors here. The
 * known hole is named so that the next person meets it as an open question with a
 * stated cost, not as a mystery in the arithmetic.
 */
export function isPlausiblePace(
  segmentMeters: number,
  elapsedMs: number,
  speedMps: number | null,
): boolean {
  if (speedMps !== null && Number.isFinite(speedMps)) {
    if (speedMps < 0 || speedMps > MAX_HUMAN_SPEED_MPS) return false;
    if (speedMps === 0) return segmentMeters <= GPS_MIN_SEGMENT_M;
    return true;
  }
  if (elapsedMs <= 250) return true;
  return segmentMeters / (elapsedMs / 1000) <= MAX_HUMAN_SPEED_MPS;
}

/**
 * Distance to add for one candidate fix, or 0 when it is rejected. This is the
 * whole anti-jitter policy in one function, so it can be reasoned about: and
 * argued with: without reading a class.
 */
export function acceptedSegmentMeters(
  previous: RoutePoint | null,
  next: {
    t: number;
    coords: LatLng;
    accuracy: number | null;
    speed: number | null;
  },
): number {
  if (!previous) return 0;
  if (next.accuracy !== null && next.accuracy > GPS_ACCURACY_FLOOR_M) return 0;
  const raw = haversine(previous.coords, next.coords);
  if (raw < GPS_MIN_SEGMENT_M) return 0;
  if (!isPlausiblePace(raw, next.t - previous.t, next.speed)) return 0;
  return raw;
}

/**
 * Per-km splits from the recorded points, using timestamps rather than assuming
 * even sampling. The final split is the remainder and keeps its true length, so
 * a 5.2 km run reports six splits with the last one honestly labelled.
 */
export function buildSplits(route: readonly RoutePoint[]): ActivitySplit[] {
  if (route.length < 2) return [];
  return splitRouteByDistance(route, 1000).map((segment, i) => {
    const from = route[segment.fromIndex]!;
    const to = route[segment.toIndex]!;
    const durationSeconds = Math.max(1, (to.t - from.t) / 1000);
    const beats = route
      .slice(segment.fromIndex, segment.toIndex + 1)
      .map((p) => p.heartRate)
      .filter((hr): hr is number => hr !== null);
    return {
      index: i + 1,
      distanceMeters: Math.round(segment.meters),
      durationSeconds,
      paceSecPerKm: paceFromDistance(durationSeconds, segment.meters),
      elevationGainMeters: elevationGain(route.slice(segment.fromIndex, segment.toIndex + 1)),
      heartRate: beats.length > 0 ? Math.round(mean(beats)) : null,
    };
  });
}

/**
 * Fallback distance for a session with no usable GPS: a plausible easy effort.
 * Clamps its input the way `estimateCalories` does: both are exported as pure
 * helpers, and a fallback that can return negative metres is only safe because of
 * something a caller happens to do, which is the kind of safety that breaks when a
 * second caller appears.
 */
export function estimatedDistanceMeters(kind: ActivityKind, seconds: number): number {
  const paceSecPerKm = { run: 330, walk: 780, ride: 150, yoga: 0, lift: 0 }[kind];
  if (paceSecPerKm <= 0) return 0;
  return Math.round((Math.max(0, seconds) / paceSecPerKm) * 1000);
}

/** Maps need `[lat, lng]` pairs; the route stores richer points. */
export function routeCoords(route: readonly RoutePoint[]): LatLng[] {
  return route.map((p) => p.coords);
}

/** Thinning for the map layer, which cannot draw 2000 segments at 60fps. */
export function displayRoute(route: readonly RoutePoint[], max = 400): LatLng[] {
  return resampleRoute(routeCoords(route), max);
}

/**
 * Ramer-Douglas-Peucker is overkill for storage; even sampling keeps the shape
 * honest and is cheaper to reason about. The endpoint is always preserved so
 * the recorded finish position is exact.
 */
export function trimRoute(route: readonly RoutePoint[], max = MAX_STORED_POINTS): RoutePoint[] {
  if (route.length <= max) return [...route];
  const stride = (route.length - 1) / (max - 1);
  const out: RoutePoint[] = [];
  for (let i = 0; i < max; i += 1) out.push(route[Math.round(i * stride)]!);
  out[max - 1] = route[route.length - 1]!;
  return out;
}
