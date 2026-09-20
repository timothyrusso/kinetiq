/**
 * Route geometry: haversine distance, Douglas–Peucker simplification and
 * bounding boxes. Routes are stored as [lat, lng] pairs; the map needs a
 * fitted coordinate, and the stats need a decimated polyline, so both live here
 * rather than in components.
 */
import type { LatLng, RoutePoint } from '@/domain/types';

const EARTH_RADIUS_M = 6_371_000;

export function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in metres between two [lat, lng] pairs. */
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Cumulative distance of a polyline, in metres. */
export function routeLength(route: readonly LatLng[]): number {
  let total = 0;
  for (let i = 1; i < route.length; i += 1) {
    total += haversine(route[i - 1]!, route[i]!);
  }
  return total;
}

function perpendicularDistance(point: LatLng, lineStart: LatLng, lineEnd: LatLng): number {
  // Approximation valid at route scale: project onto the local plane.
  const dx = (point[1] - lineStart[1]) * Math.cos(toRad(point[0]));
  const dy = point[0] - lineStart[0];
  const ex = (lineEnd[1] - lineStart[1]) * Math.cos(toRad(lineEnd[0]));
  const ey = lineEnd[0] - lineStart[0];
  const len = Math.hypot(ex, ey);
  if (len === 0) return Math.hypot(dx, dy);
  return Math.abs(dx * ey - dy * ex) / len;
}

/**
 * Ramer–Douglas–Peucker. Keeps a route visually faithful while bounding how
 * many points cross into the map renderer and into chart scales.
 */
export function simplifyRoute(route: readonly LatLng[], toleranceDeg = 0.00012): LatLng[] {
  if (route.length < 3) return route.map((p) => [p[0], p[1]] as LatLng);

  const keep = new Array<boolean>(route.length).fill(false);
  keep[0] = true;
  keep[route.length - 1] = true;

  const stack: Array<[number, number]> = [[0, route.length - 1]];
  while (stack.length > 0) {
    const range = stack.pop();
    if (!range) continue;
    const [first, last] = range;
    let farthest = -1;
    let farthestDist = 0;
    for (let i = first! + 1; i < last!; i += 1) {
      const d = perpendicularDistance(route[i]!, route[first!]!, route[last!]!);
      if (d > farthestDist) {
        farthestDist = d;
        farthest = i;
      }
    }
    if (farthest !== -1 && farthestDist > toleranceDeg) {
      keep[farthest] = true;
      stack.push([first!, farthest], [farthest, last!]);
    }
  }

  return route.filter((_, i) => keep[i]).map((p) => [p[0], p[1]] as LatLng);
}

/** Downsamples to at most `max` points by index stride (order preserved). */
export function resampleRoute(route: readonly LatLng[], max: number): LatLng[] {
  if (route.length <= max) return route.map((p) => [p[0], p[1]] as LatLng);
  const stride = (route.length - 1) / (max - 1);
  const out: LatLng[] = [];
  for (let i = 0; i < max; i += 1) {
    out.push(route[Math.round(i * stride)]!);
  }
  return out;
}

export type Bounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

export function routeBounds(route: readonly LatLng[]): Bounds | null {
  if (route.length === 0) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const [lat, lng] of route) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  if (!Number.isFinite(minLat)) return null;
  return { minLat, maxLat, minLng, maxLng };
}

export function boundsCenter(bounds: Bounds): LatLng {
  return [(bounds.minLat + bounds.maxLat) / 2, (bounds.minLng + bounds.maxLng) / 2];
}

/**
 * Latitude span that fits `route` inside a viewport of `widthPx` x `heightPx`
 * with padding — MapView's `fitPadding` is unreliable on some devices, so we
 * compute a zoom-independent span and drive `region` directly.
 */
export function regionForRoute(
  route: readonly LatLng[],
  viewport: { width: number; height: number; padding?: number },
): { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number } | null {
  const bounds = routeBounds(route);
  if (!bounds) return null;
  const pad = viewport.padding ?? 0.16;

  const latSpan = Math.max(bounds.maxLat - bounds.minLat, 0.0015);
  const lngSpan = Math.max(bounds.maxLng - bounds.minLng, 0.0015);

  // Scale the padding into the span rather than the pixel box: guarantees the
  // route is never clipped regardless of aspect ratio. Longitude is widened to
  // the viewport aspect so a tall, narrow card still frames the path.
  const latDelta = latSpan * (1 + pad * 2);
  const aspect = Math.max(0.2, viewport.height / Math.max(1, viewport.width));
  const lngDelta = Math.max(lngSpan * (1 + pad * 2), latDelta * aspect);

  const center = boundsCenter(bounds);
  return {
    latitude: center[0],
    longitude: center[1],
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
}

/**
 * Cuts a route into per-`segmentMeters` splits and returns the point indices at each
 * boundary. Used to derive per-km splits from recorded GPS points without assuming
 * uniform sampling.
 *
 * Two rules make the numbers add up, and breaking either one produced a real bug:
 *
 * - **Boundaries are placed against an absolute cumulative target**, never a counter
 *   restarted at zero. Restarting discarded the overshoot of the step that crossed a
 *   kilometre, up to a whole sampling interval per split: on a 100 m-sampled route every
 *   "kilometre" reported 1099 m, so the splits disagreed with the headline distance
 *   printed above them. A user adds the splits up; disagreement is worse than coarseness.
 * - **A leftover is its own split.** Once a boundary is crossed, the points after it are
 *   a new segment. Folding a 200 m remainder into the kilometre that just closed made a
 *   5.2 km run report *four* splits, the last one 2.2 km long and labelled as a fifth
 *   kilometre — a pace for a distance that was never one.
 *
 * Consecutive splits share their boundary point, so each `meters` is the true distance
 * between its own endpoints and the set sums to the route exactly. Individual splits sit
 * within one sampling interval of the target, because a boundary can only land on a
 * recorded point: at a real ~5 m between GPS fixes that means within metres of the mark,
 * and precision there is a property of the sampling rate rather than of this function.
 */
export function splitRouteByDistance(
  route: readonly RoutePoint[],
  segmentMeters: number,
): Array<{ fromIndex: number; toIndex: number; meters: number }> {
  if (route.length < 2 || segmentMeters <= 0) return [];
  const segments: Array<{ fromIndex: number; toIndex: number; meters: number }> = [];
  let fromIndex = 0;
  /** Cumulative distance from the start, and its value at `fromIndex`. */
  let acc = 0;
  let accAtFrom = 0;
  /** Where the next boundary must fall — advanced by one segment, never reset. */
  let target = segmentMeters;
  for (let i = 1; i < route.length; i += 1) {
    acc += haversine(route[i - 1]!.coords, route[i]!.coords);
    if (acc >= target) {
      segments.push({ fromIndex, toIndex: i, meters: acc - accAtFrom });
      fromIndex = i;
      accAtFrom = acc;
      target += segmentMeters;
    }
  }
  if (segments.length === 0) {
    // Shorter than one segment: the whole route is the split, honestly labelled short
    // rather than rounded up into a kilometre that did not happen.
    return acc > 0 ? [{ fromIndex: 0, toIndex: route.length - 1, meters: acc }] : [];
  }
  if (fromIndex < route.length - 1) {
    segments.push({
      fromIndex,
      toIndex: route.length - 1,
      meters: acc - accAtFrom,
    });
  }
  return segments;
}

/**
 * Interpolates a route into points evenly spaced by distance. The map polyline
 * uses this so a gradient stroke encodes pace uniformly along the path instead
 * of bunching where GPS samples were dense.
 */
export function interpolateByDistance(
  route: readonly LatLng[],
  samples: number,
): Array<{ point: LatLng; fraction: number }> {
  if (route.length === 0 || samples < 2) return [];
  const cumulative: number[] = [0];
  for (let i = 1; i < route.length; i += 1) {
    cumulative.push(cumulative[i - 1]! + haversine(route[i - 1]!, route[i]!));
  }
  const total = cumulative[cumulative.length - 1]!;
  if (total <= 0) return [];

  const out: Array<{ point: LatLng; fraction: number }> = [];
  let cursor = 0;
  for (let s = 0; s < samples; s += 1) {
    const target = (total * s) / (samples - 1);
    while (cursor < route.length - 2 && cumulative[cursor + 1]! < target) cursor += 1;
    const segLen = cumulative[cursor + 1]! - cumulative[cursor]!;
    const t = segLen > 0 ? (target - cumulative[cursor]!) / segLen : 0;
    const a = route[cursor]!;
    const b = route[cursor + 1]!;
    out.push({
      point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
      fraction: s / (samples - 1),
    });
  }
  return out;
}

/** Elevation gain that ignores barometric jitter below `thresholdM`. */
export function elevationGain(route: readonly RoutePoint[], thresholdM = 1.5): number {
  let gain = 0;
  let reference = route[0]?.elevation ?? 0;
  for (const p of route) {
    const delta = p.elevation - reference;
    if (delta > thresholdM) {
      gain += delta;
      reference = p.elevation;
    } else if (delta < -thresholdM) {
      reference = p.elevation;
    }
  }
  return gain;
}
