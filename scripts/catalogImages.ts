/**
 * The bundled exercise photos as a static `require` map, which is how Metro bundles an image:
 * a path it can see at build time. `npm run catalog:images` writes it from the dataset, and a
 * jest test renders it again and fails when the committed file differs, so a dataset edit that
 * forgets to regenerate cannot ship.
 *
 * Each photo carries its blurhash, drawn blurred while the photo decodes. It is computed here,
 * once per file, so the app ships the short string and never the encoder.
 *
 * An exercise in `pendingPhotos.json` is left out: its files do not exist yet, and a `require`
 * of a missing file fails the whole bundle. Kept free of the app's modules, so `tsx` runs it.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { encode } from 'blurhash';
import sharp from 'sharp';

/** The generated file, from the repository root. */
export const CATALOG_IMAGES_OUTPUT = 'features/exercises/mappers/catalogImages.generated.ts';

const ROOT = resolve(__dirname, '..');
const FRAMES = { start: '0', end: '1', thumb: 'thumb' } as const;

/**
 * The blurhash grid: four by three components is a 28-character string, enough for the light
 * backdrop and the dark figure of these photos to show as shapes rather than one flat tint.
 */
const COMPONENTS = { x: 4, y: 3 } as const;

/**
 * The longest side the photo is averaged down to before encoding. Four by three components need
 * no more, and the encoder's cost grows with the pixel count, which the map's test pays on every run.
 */
const SAMPLE_SIZE = 16;

/**
 * Each pixel of the small copy averages a grid of this many points by this many, evenly spread
 * over the block it stands for: as smooth as averaging every pixel at this size, at a fraction of
 * the reads.
 */
const SAMPLES = 4;

const sampleOffsets = (scale: number) =>
  Array.from({ length: SAMPLES }, (_, index) => Math.floor(((2 * index + 1) * scale) / (2 * SAMPLES)));

/** A blurhash by image path, as the dataset names it: `images/<slug>/0.webp`. */
export type CatalogBlurhashes = Readonly<Record<string, string>>;

interface DatasetImages {
  readonly id: string;
  readonly images: Readonly<Record<keyof typeof FRAMES, string>>;
}

/** What the map is generated from: the dataset's exercises and the ids still waiting for photos. */
export function readCatalogImageInputs(): { exercises: readonly DatasetImages[]; pending: readonly string[] } {
  const read = (file: string) => JSON.parse(readFileSync(resolve(ROOT, 'assets/catalog', file), 'utf8'));
  return { exercises: read('exercises.json').exercises, pending: read('pendingPhotos.json') };
}

/**
 * The blurhash of every bundled photo, by its dataset path.
 *
 * `sharp` only decodes; the averaging down to `SAMPLE_SIZE` happens here in integer arithmetic,
 * because a library resize can round differently between a Mac and the Linux CI runner, and the
 * map's test compares the strings exactly.
 */
export async function readCatalogBlurhashes(
  exercises: readonly DatasetImages[],
  pending: readonly string[],
): Promise<CatalogBlurhashes> {
  const waiting = new Set(pending);
  const paths = exercises
    .filter(exercise => !waiting.has(exercise.id))
    .flatMap(exercise => Object.values(exercise.images));
  const hashes = await Promise.all(paths.map(path => blurhashOf(resolve(ROOT, 'assets/catalog', path))));
  return Object.fromEntries(paths.map((path, index) => [path, hashes[index] ?? '']));
}

async function blurhashOf(file: string): Promise<string> {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const scale = Math.max(1, Math.ceil(Math.max(info.width, info.height) / SAMPLE_SIZE));
  const width = Math.floor(info.width / scale);
  const height = Math.floor(info.height / scale);
  const offsets = sampleOffsets(scale);
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let channel = 0; channel < 4; channel++) {
        let sum = 0;
        for (const dy of offsets) {
          for (const dx of offsets) {
            sum += data[((y * scale + dy) * info.width + x * scale + dx) * 4 + channel] ?? 0;
          }
        }
        pixels[(y * width + x) * 4 + channel] = Math.round(sum / SAMPLES ** 2);
      }
    }
  }
  return encode(pixels, width, height, COMPONENTS.x, COMPONENTS.y);
}

/**
 * The slug of `exercise`, after checking its images follow the one layout the app resolves:
 * `images/<slug>/0.webp`, `1.webp` and `thumb.webp`, where the slug is the id without `ex:`.
 */
function slugOf(exercise: DatasetImages): string {
  const slug = exercise.id.replace(/^ex:/, '');
  for (const [frame, file] of Object.entries(FRAMES)) {
    const expected = `images/${slug}/${file}.webp`;
    const actual = exercise.images[frame as keyof typeof FRAMES];
    if (actual !== expected) throw new Error(`${exercise.id}: ${frame} is ${actual}, expected ${expected}`);
  }
  return slug;
}

/**
 * The text of the generated file, one entry per exercise with photos, in dataset order, each
 * frame with its blurhash from `blurhashes`.
 */
export function renderCatalogImages(
  exercises: readonly DatasetImages[],
  pending: readonly string[],
  blurhashes: CatalogBlurhashes,
): string {
  const waiting = new Set(pending);
  const entries = exercises
    .filter(exercise => !waiting.has(exercise.id))
    .map(exercise => {
      const slug = slugOf(exercise);
      const frames = Object.entries(FRAMES).map(([frame, file]) => {
        const path = `images/${slug}/${file}.webp`;
        const blurhash = blurhashes[path];
        if (blurhash === undefined) throw new Error(`${exercise.id}: no blurhash for ${path}`);
        return `    ${frame}: { asset: require('@/assets/catalog/${path}'), blurhash: '${blurhash}' },`;
      });
      return [`  '${slug}': {`, ...frames, '  },'].join('\n');
    });
  return [
    '/**',
    ' * Generated by `npm run catalog:images` from `assets/catalog/exercises.json`: do not edit by hand.',
    ' * Every bundled photo, by exercise slug, as the asset Metro bundled and its blurhash; an exercise',
    ' * waiting for its photos in `pendingPhotos.json` has no entry.',
    ' */',
    "import type { BundledImage } from '@/features/core/design-system';",
    '',
    'export const CATALOG_IMAGES: Readonly<Record<string, { start: BundledImage; end: BundledImage; thumb: BundledImage }>> = {',
    ...entries,
    '};',
    '',
  ].join('\n');
}
