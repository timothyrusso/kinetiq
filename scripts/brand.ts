#!/usr/bin/env npx tsx
/**
 * Generates every branded raster asset (app icons, adaptive icon layers, splash
 * images, favicon) from one parametric vector mark, so the icon, the splash
 * screen and the in-app wordmark can never drift apart.
 *
 *   npx tsx scripts/brand.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'assets');
const BRAND = path.join(OUT, 'brand');

/** Brand ramp: must stay in sync with src/theme/tokens.ts */
const C = {
  ink: '#07090F',
  inkAlt: '#0D1220',
  volt: '#C6F24E',
  spark: '#35E8C0',
  coral: '#FF6A45',
  white: '#FFFFFF',
};

/**
 * The mark, authored once on a 100x100 grid as polylines. Bounding box is
 * centred on (50, 50) so any box it is dropped into reads as centred.
 */
const MARK_STROKES: readonly (readonly (readonly [number, number])[])[] = [
  // stem
  [[22, 15], [22, 85]],
  // upper arm, springing off the stem
  [[22, 56], [72, 20]],
  // lower leg, drawn as a heart-rate pulse
  [[22, 57], [42, 71], [52, 50], [62, 83], [78, 61]],
];

/**
 * The mark: an energetic "k" whose leg is a heart-rate pulse.
 *
 * Scale is applied as a real SVG transform rather than by multiplying
 * coordinates, and the shared gradients must therefore be
 * `gradientUnits="userSpaceOnUse"`: with the default objectBoundingBox units a
 * purely vertical stroke has a zero-width bbox, and the spec says such a
 * gradient paints nothing: the stem silently disappears from every asset.
 * userSpaceOnUse also means all three strokes sample one continuous gradient,
 * so the volt→spark ramp has no seam at the junctions.
 */
function markGeometry(opts: {
  stroke: string;
  /** stroke width in grid units (10 ≈ 10% of the box) */
  width: number;
  /** maps the 100-unit authoring grid onto the target box */
  scale: number;
  translate: readonly [number, number];
  opacity?: number;
}): string {
  const { stroke, width, scale, translate, opacity = 1 } = opts;
  const [tx, ty] = translate;
  const paths = MARK_STROKES.map((points) => {
    const d = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
    return `<path d="${d}" />`;
  }).join('\n      ');
  return `
    <g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(4)})"
       fill="none" stroke="${stroke}" stroke-width="${width}"
       stroke-linecap="round" stroke-linejoin="round"${
         opacity < 1 ? ` opacity="${opacity}"` : ''
       }>
      ${paths}
    </g>`;
}

/** The mark gradient in grid space: see `markGeometry` for why userSpaceOnUse. */
function markGradient(id = 'mark'): string {
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="12" y1="88" x2="88" y2="12">
      <stop offset="0" stop-color="${C.volt}"/>
      <stop offset="1" stop-color="${C.spark}"/>
    </linearGradient>`;
}

/** Centres a 100-unit mark grid occupying `ratio` of the box. */
function markPlacement(size: number, ratio: number) {
  const scale = (size * ratio) / 100;
  const offset = (size - 100 * scale) / 2;
  return { scale, translate: [offset, offset] as const };
}

/** Full-bleed app icon (opaque, no transparency, App Store requirement). */
function iconSvg(size: number, opts: { rounded?: boolean } = {}): string {
  const { rounded = true } = opts;
  const r = rounded ? size * 0.225 : 0;
  const mark = markPlacement(size, 0.72);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${C.inkAlt}"/>
      <stop offset="1" stop-color="${C.ink}"/>
    </linearGradient>
    ${markGradient()}
    <radialGradient id="glow" cx="0.24" cy="0.8" r="0.75">
      <stop offset="0" stop-color="${C.spark}" stop-opacity="0.22"/>
      <stop offset="1" stop-color="${C.spark}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="0.82" cy="0.16" r="0.7">
      <stop offset="0" stop-color="${C.volt}" stop-opacity="0.16"/>
      <stop offset="1" stop-color="${C.volt}" stop-opacity="0"/>
    </radialGradient>
    ${
      rounded
        ? `<clipPath id="squircle"><rect x="0" y="0" width="${size}" height="${size}" rx="${r}" ry="${r}"/></clipPath>`
        : ''
    }
  </defs>
  <g${rounded ? ' clip-path="url(#squircle)"' : ''}>
    <rect width="${size}" height="${size}" fill="url(#bg)"/>
    <rect width="${size}" height="${size}" fill="url(#glow)"/>
    <rect width="${size}" height="${size}" fill="url(#glow2)"/>
    ${
      /* faint 24px grid: the "training grid" motif used across the dashboard */
      gridLines(size)
    }
    ${markGeometry({ stroke: 'url(#mark)', width: 10, ...mark })}
  </g>
</svg>`;
}

function gridLines(size: number, step = size / 12, ink = '#FFFFFF', opacity = 0.035): string {
  const lines: string[] = [];
  for (let i = 1; i < 12; i += 1) {
    const p = (step * i).toFixed(2);
    lines.push(
      `<path d="M ${p} 0 L ${p} ${size}" stroke="${ink}" stroke-opacity="${opacity}" stroke-width="1"/>`,
      `<path d="M 0 ${p} L ${size} ${p}" stroke="${ink}" stroke-opacity="${opacity}" stroke-width="1"/>`,
    );
  }
  return `<g>${lines.join('')}</g>`;
}

/** Adaptive-icon foreground: transparent, mark inside the 66/108 safe zone. */
function adaptiveForeground(size: number): string {
  const mark = markPlacement(size, (66 / 108) * 0.78);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    ${markGradient()}
  </defs>
  ${markGeometry({ stroke: 'url(#mark)', width: 10, ...mark })}
</svg>`;
}

/** Adaptive-icon background: opaque brand field with glow + grid. */
function adaptiveBackground(size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${C.inkAlt}"/>
      <stop offset="1" stop-color="${C.ink}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.28" cy="0.78" r="0.8">
      <stop offset="0" stop-color="${C.spark}" stop-opacity="0.20"/>
      <stop offset="1" stop-color="${C.spark}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="0.8" cy="0.18" r="0.7">
      <stop offset="0" stop-color="${C.volt}" stop-opacity="0.14"/>
      <stop offset="1" stop-color="${C.volt}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  <rect width="${size}" height="${size}" fill="url(#glow)"/>
  <rect width="${size}" height="${size}" fill="url(#glow2)"/>
  ${gridLines(size)}
</svg>`;
}

/** Adaptive-icon monochrome layer (themed icons on Android 13+). */
function adaptiveMonochrome(size: number): string {
  const mark = markPlacement(size, (66 / 108) * 0.66);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${markGeometry({ stroke: C.white, width: 10, ...mark })}
</svg>`;
}

/**
 * Splash mark, rendered per appearance: volt-on-ink and spark-on-paper both
 * read, but volt-on-paper does not, so the light variant uses the deepened
 * brand ramp the light theme itself uses.
 */
function splashImage(size: number, appearance: 'dark' | 'light'): string {
  const mark = markPlacement(size, 0.62);
  const ramp =
    appearance === 'dark'
      ? { from: C.volt, to: C.spark }
      : { from: '#5E8C0B', to: '#0E9A78' };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="mark" gradientUnits="userSpaceOnUse" x1="12" y1="88" x2="88" y2="12">
      <stop offset="0" stop-color="${ramp.from}"/>
      <stop offset="1" stop-color="${ramp.to}"/>
    </linearGradient>
  </defs>
  ${markGeometry({ stroke: 'url(#mark)', width: 9.5, ...mark })}
</svg>`;
}

/** Flat launch field: the grid has to be dark on paper, light on ink. */
function fieldImage(size: number, appearance: 'dark' | 'light'): string {
  const dark = appearance === 'dark';
  const background = dark ? C.ink : '#F6F7F4';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="g" cx="0.5" cy="0.42" r="0.72">
      <stop offset="0" stop-color="${dark ? C.spark : C.volt}" stop-opacity="${dark ? 0.1 : 0.28}"/>
      <stop offset="1" stop-color="${dark ? C.spark : C.volt}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="${background}"/>
  ${gridLines(size, size / 12, dark ? '#FFFFFF' : C.ink, dark ? 0.035 : 0.05)}
  <rect width="${size}" height="${size}" fill="url(#g)"/>
</svg>`;
}

function render(svg: string, file: string, size: number) {
  const svgPath = path.join(BRAND, `${path.basename(file)}.svg`);
  writeFileSync(svgPath, svg);
  execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), svgPath, '-o', file]);
  console.log(`  ${path.relative(ROOT, file)}  (${size}x${size})`);
}

function main() {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(BRAND, { recursive: true });

  console.log('branding:');
  // iOS + Play Store store icon: 1024, opaque, no alpha.
  render(iconSvg(1024), path.join(OUT, 'icon.png'), 1024);
  // Icon without the squircle clip, for surfaces that apply their own mask.
  render(iconSvg(1024, { rounded: false }), path.join(BRAND, 'icon-square.png'), 1024);

  // Android adaptive icon (432px == 108dp @ xxhdpi).
  render(adaptiveForeground(432), path.join(OUT, 'android-icon-foreground.png'), 432);
  render(adaptiveBackground(432), path.join(OUT, 'android-icon-background.png'), 432);
  render(adaptiveMonochrome(432), path.join(OUT, 'android-icon-monochrome.png'), 432);

  // Splash: native launch screens use a mark centred on a solid field, one
  // appearance per theme so the launch never flashes the wrong colours.
  render(splashImage(512, 'dark'), path.join(OUT, 'splash-icon.png'), 512);
  render(splashImage(512, 'light'), path.join(OUT, 'splash-icon-light.png'), 512);
  render(fieldImage(512, 'dark'), path.join(OUT, 'splash-background-dark.png'), 512);
  render(fieldImage(512, 'light'), path.join(OUT, 'splash-background-light.png'), 512);

  render(iconSvg(64), path.join(OUT, 'favicon.png'), 64);
  console.log('done.');
}

main();
