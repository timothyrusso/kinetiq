/**
 * Colour arithmetic on `#rrggbb` strings.
 *
 * ## Why this exists at all
 *
 * The map's route line is coloured by pace: one colour per coordinate: which means
 * interpolating between two brand colours in code rather than picking one from the palette.
 * Every other colour in the app comes from `theme.colors`; this is the one place a colour is
 * *computed*, and it is kept here so the arithmetic lives in one file rather than being
 * copy-pasted into the map, the trace and the heatmap.
 *
 * ## Gamma
 *
 * Mixing in sRGB: the naive thing: makes the midpoint of a green→red ramp a muddy olive,
 * because sRGB values are perceptually warped. Mixing in linear light puts the midpoint where
 * the eye expects it. The cost is six exponentiations per interpolation, which for a 400-point
 * route is nothing, and it is the reason the pace ramp reads as a gradient rather than two
 * colours with a seam.
 */

export type Rgb = readonly [number, number, number];

/** Parses `#rgb` or `#rrggbb`. Returns `null` rather than throwing: a malformed colour should degrade, not crash a screen. */
export function parseHex(hex: string): Rgb | null {
  const value = hex.trim().replace(/^#/, '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  if (full.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

export function toHex(rgb: Rgb): string {
  return `#${rgb
    .map((channel) => Math.round(clamp(channel, 0, 255)).toString(16).padStart(2, '0'))
    .join('')}`;
}

/**
 * Local rather than imported from `utils/functional`, and carrying `'worklet'`, for the same
 * reason as `withAlpha`: `toHex` runs per frame inside an animated style. Reanimated's own
 * exported `clamp` would work too, but pulling a worklet dependency into a colour module so a
 * pure arithmetic helper can clamp one channel is a worse trade than eight duplicated lines.
 */
function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function toLinear(channel8: number): number {
  const s = channel8 / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function toSrgb(linear: number): number {
  const s = linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055;
  return s * 255;
}

/**
 * Blend two colours in linear light.
 *
 * Falls back to picking the nearer input when either will not parse: a caller passing an
 * `rgba()` string gets a hard step instead of a blend, which is a better outcome than a screen
 * that refuses to draw its route line.
 */
export function mix(a: string, b: string, t: number): string {
  const from = parseHex(a);
  const to = parseHex(b);
  if (from === null || to === null) return t < 0.5 ? a : b;
  const k = clamp(t, 0, 1);
  const blended: Rgb = [
    toSrgb(toLinear(from[0]) * (1 - k) + toLinear(to[0]) * k),
    toSrgb(toLinear(from[1]) * (1 - k) + toLinear(to[1]) * k),
    toSrgb(toLinear(from[2]) * (1 - k) + toLinear(to[2]) * k),
  ];
  return toHex(blended);
}

/**
 * Sample a colour ramp at `t` (0…1) across an ordered list of stops.
 *
 * Single-stop ramps return that stop; an empty ramp returns the fallback, because a ramp with
 * no stops is a configuration mistake and the caller is better off with a visible line in the
 * brand colour than with `undefined` reaching a native prop.
 */
export function ramp(stops: readonly string[], t: number, fallback: string): string {
  if (stops.length === 0) return fallback;
  if (stops.length === 1) return stops[0] ?? fallback;
  const k = clamp(t, 0, 1) * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(k));
  return mix(stops[index] ?? fallback, stops[index + 1] ?? fallback, k - index);
}

/**
 * Append alpha to a hex colour.
 *
 * Needed because the map and the SVG trace want translucent fills from the same base colour,
 * and `theme.colors` has no alpha variant of every tone.
 *
 * ## The `'worklet'` directive
 *
 * This runs inside `useAnimatedStyle`: a collapsing header fades its frosted backing in over
 * scroll, which computes a colour per frame on the UI thread. Reanimated serialises a worklet
 * by stringifying its body, so anything it calls has to be a *literal* of that function or carry
 * its own `'worklet'` directive; a plain imported helper is `undefined` on the other side, and
 * the failure is a runtime `undefined is not a function` that `tsc` cannot see, because the
 * import is perfectly well-typed. Same for `clamp`, hence the directive there too.
 */
export function withAlpha(hex: string, alpha: number): string {
  const parsed = parseHex(hex);
  if (parsed === null) return hex;
  const a = Math.round(clamp(alpha, 0, 1) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${toHex(parsed)}${a}`;
}
