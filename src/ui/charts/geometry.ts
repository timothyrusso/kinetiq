/**
 * Chart geometry — pure functions, no React, no React Native.
 *
 * Everything that computes a coordinate lives here so it can be reasoned about (and
 * got right) once. The components in this folder only ever *draw* what comes out of
 * these functions, which is also what makes the charts cheap: the path string for a
 * 30-point series is rebuilt when the data changes and not on every animation frame,
 * while the frame-to-frame work is a single `strokeDashoffset` or `translateX`.
 *
 * Two invariants worth stating because breaking them is how charts go wrong quietly:
 * a chart with zero, one, or all-identical values must still produce finite numbers
 * (never `NaN`, never `Infinity`, which SVG renders as nothing at all), and every
 * builder is width/height agnostic so the same series can be drawn as a 30px
 * sparkline or a 200px hero chart.
 */

export type Point = { x: number; y: number };

export type Domain = readonly [min: number, max: number];

/**
 * Y domain for a series, with headroom.
 *
 * `includeZero` is not always right: a heart-rate series between 148 and 162 drawn
 * from zero is a flat line, while a bar series not drawn from zero is a lie about
 * proportion. So the caller decides, and the default for bars is enforced there.
 */
export function niceDomain(values: number[], options: { includeZero: boolean }): Domain {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return [0, 1];
  let min = Math.min(...finite);
  let max = Math.max(...finite);
  if (options.includeZero) {
    min = Math.min(0, min);
    max = Math.max(0, max);
  }
  if (max - min < 1e-6) {
    // All values identical: widen around the value rather than dividing by zero.
    // A flat line drawn across the middle reads correctly; one glued to the top
    // edge looks like a bug.
    const pad = Math.max(Math.abs(max) * 0.15, 1);
    return [min - pad, max + pad];
  }
  const pad = (max - min) * 0.12;
  return [min - pad, max + pad];
}

/** Round a domain up to a "nice" max so grid lines land on whole numbers. */
export function niceCeil(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

export type Scale = {
  /** Index → x. Evenly spaced across the plot, first point inset by `inset`. */
  x: (index: number) => number;
  /** Value → y, already flipped for screen coordinates. */
  y: (value: number) => number;
  /** Inverse of `x`, for hit-testing a touch back to an index. */
  index: (x: number) => number;
  /** Distance between two adjacent x positions. */
  step: number;
  /** Pixel height of the plot area, for callers drawing axis labels. */
  plotHeight: number;
  domain: Domain;
};

export type ScaleConfig = {
  count: number;
  domain: Domain;
  width: number;
  height: number;
  /** Extra x padding at both ends so the first/last dot is not clipped. */
  inset?: number;
  /** Reserved vertical space, e.g. for a bar value label above each bar. */
  paddingTop?: number;
  paddingBottom?: number;
};

export function createScale({
  count,
  domain,
  width,
  height,
  inset = 0,
  paddingTop = 0,
  paddingBottom = 0,
}: ScaleConfig): Scale {
  const safeCount = Math.max(1, count);
  const plotHeight = Math.max(1, height - paddingTop - paddingBottom);
  const usable = Math.max(1, width - inset * 2);
  // A single point sits dead centre rather than at x=0, which is what makes a
  // one-workout history screen look intentional instead of broken.
  const step = safeCount > 1 ? usable / (safeCount - 1) : 0;
  const [min, max] = domain;
  const span = max - min || 1;
  return {
    x: (index) => inset + (safeCount > 1 ? index * step : usable / 2),
    y: (value) => paddingTop + (1 - (value - min) / span) * plotHeight,
    index: (x) => (step > 0 ? Math.round((x - inset) / step) : 0),
    step: step || usable,
    plotHeight,
    domain,
  };
}

/**
 * Polyline path. Straight segments, no smoothing.
 *
 * Deliberate: Catmull-Rom smoothing on a workout series invents troughs and crests
 * between measurements, which is exactly wrong for data where each point is a real
 * week or a real mile. If a curve is wanted, it is wanted for *appearance*, and that
 * belongs in a sparkline where no value is being read off the shape.
 */
export function linePath(points: Point[]): string {
  if (points.length === 0) return '';
  const head = points[0];
  if (!head) return '';
  let out = `M${round(head.x)} ${round(head.y)}`;
  for (let i = 1; i < points.length; i += 1) {
    const p = points[i];
    if (!p) continue;
    out += ` L${round(p.x)} ${round(p.y)}`;
  }
  return out;
}

/**
 * Area path: the line, closed down to `baselineY`.
 *
 * The baseline is a parameter rather than "the bottom" because a series that dips
 * below its own zero should close at zero, not at the axis — otherwise the fill
 * appears to float above nothing.
 */
export function areaPath(points: Point[], baselineY: number): string {
  const line = linePath(points);
  if (!line) return '';
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return line;
  return `${line} L${round(last.x)} ${round(baselineY)} L${round(first.x)} ${round(baselineY)} Z`;
}

/**
 * Catmull-Rom → cubic Bézier, for the sparkline only.
 *
 * Tension 1 is the standard Catmull-Rom strength; anything above it overshoots and
 * the curve visibly swings outside the data, which is how a "trend" line ends up
 * showing a dip that never happened.
 */
export function smoothPath(points: Point[], tension = 1): string {
  if (points.length < 3) return linePath(points);
  let out = '';
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    if (!p0 || !p1 || !p2) continue;
    if (!out) out = `M${round(p1.x)} ${round(p1.y)}`;
    const t = tension / 6;
    const c1x = p1.x + (p2.x - p0.x) * t;
    const c1y = p1.y + (p2.y - p0.y) * t;
    const c2x = p2.x - (p3?.x ?? p2.x - p1.x) * t;
    const c2y = p2.y - (p3?.y ?? p2.y - p1.y) * t;
    out += ` C${round(c1x)} ${round(c1y)} ${round(c2x)} ${round(c2y)} ${round(p2.x)} ${round(p2.y)}`;
  }
  return out;
}

/**
 * Total length of a polyline. Needed because react-native-svg has no `pathLength`
 * attribute, so a draw-on animation has to know its own length to set
 * `strokeDasharray`. Summing segments is exact for a polyline and costs microseconds
 * at the sizes we draw.
 */
export function polylineLength(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) continue;
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

/** Arc from 12 o'clock, clockwise, as a path. Used by the progress ring. */
export function arcPath(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polar(cx, cy, radius, startAngle);
  const end = polar(cx, cy, radius, endAngle);
  const sweep = endAngle - startAngle;
  // A full circle cannot be drawn as a single arc — start and end coincide and the
  // renderer draws nothing. Callers clamp to a hair under 2π; this is the guard.
  const largeArc = Math.abs(sweep) > Math.PI ? 1 : 0;
  return `M${round(start.x)} ${round(start.y)} A${round(radius)} ${round(radius)} 0 ${largeArc} 1 ${round(end.x)} ${round(end.y)}`;
}

export function polar(cx: number, cy: number, r: number, angle: number): Point {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

/** The angle a 0→1 progress maps to, starting at the top and going clockwise. */
export function sweepTo(progress: number): number {
  const clamped = clamp01(progress);
  // 0.9999 of a turn rather than 1: with a butt cap the seam is invisible, and it
  // sidesteps the degenerate full-circle arc entirely.
  return -Math.PI / 2 + Math.min(clamped, 0.9999) * Math.PI * 2;
}

/**
 * Grid line values for a domain. Three lines is the useful maximum in a 160px-tall
 * chart: more rules than values, and the series disappears.
 */
export function gridValues(domain: Domain, count = 3): number[] {
  const [min, max] = domain;
  if (count <= 1) return [(min + max) / 2];
  const out: number[] = [];
  for (let i = 0; i <= count; i += 1) out.push(min + ((max - min) * i) / count);
  return out;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** SVG output is rounded: two decimals keeps paths small with no visible difference. */
function round(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Maps a value into a list of `buckets` by `keyOf`, filling every bucket.
 *
 * Filling is the whole point. A weekly chart built from a grouped map has a hole where
 * a quiet week was, and a hole in a bar chart reads as a rendering bug rather than as
 * "you did not train that week" — the single most misleading thing a fitness chart can
 * do is make an absence look like a zero-length bar with no label.
 */
export function bucketize<T>(
  items: T[],
  buckets: string[],
  keyOf: (item: T) => string,
  reduce: (group: T[]) => number,
): number[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const list = groups.get(key);
    if (list) list.push(item);
    else groups.set(key, [item]);
  }
  return buckets.map((key) => {
    const list = groups.get(key);
    return list ? reduce(list) : 0;
  });
}
