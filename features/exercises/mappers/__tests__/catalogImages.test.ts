import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { exerciseImageSource } from '@/features/exercises/mappers/exerciseImageSource';
import {
  CATALOG_IMAGES_OUTPUT,
  type CatalogBlurhashes,
  readCatalogBlurhashes,
  readCatalogImageInputs,
  renderCatalogImages,
} from '@/scripts/catalogImages';

const committed = () => readFileSync(resolve(__dirname, '../../../..', CATALOG_IMAGES_OUTPUT), 'utf8');

const BENCH_START = 'images/barbell-bench-press-medium-grip/0.webp';

describe('the bundled photo map', () => {
  const { exercises, pending } = readCatalogImageInputs();
  let blurhashes: CatalogBlurhashes = {};

  // NOTE: decoding every bundled photo takes a few seconds; it is done once for the whole block.
  beforeAll(async () => {
    blurhashes = await readCatalogBlurhashes(exercises, pending);
  }, 60_000);

  it('is the file `npm run catalog:images` writes from the committed dataset and photos', () => {
    expect(committed()).toBe(renderCatalogImages(exercises, pending, blurhashes));
  });

  it('would change when the dataset gains an exercise, so a forgotten regeneration fails the test above', () => {
    const added = {
      id: 'ex:new-press',
      images: {
        start: 'images/new-press/0.webp',
        end: 'images/new-press/1.webp',
        thumb: 'images/new-press/thumb.webp',
      },
    };
    const withAdded = {
      ...blurhashes,
      [added.images.start]: 'L00000fQfQfQfQfQfQfQfQfQfQfQ',
      [added.images.end]: 'L00000fQfQfQfQfQfQfQfQfQfQfQ',
      [added.images.thumb]: 'L00000fQfQfQfQfQfQfQfQfQfQfQ',
    };

    expect(renderCatalogImages([...exercises, added], pending, withAdded)).not.toBe(committed());
  });

  it('would change when a photo is replaced, so a stale blurhash fails the test above', () => {
    const replaced = { ...blurhashes, [BENCH_START]: 'L00000fQfQfQfQfQfQfQfQfQfQfQ' };

    expect(blurhashes[BENCH_START]).toMatch(/^[0-9A-Za-z#$%*+,\-.:;=?@[\]^_{|}~]{28}$/);
    expect(renderCatalogImages(exercises, pending, replaced)).not.toBe(committed());
  });

  it('refuses a photo without a blurhash, rather than writing an entry the placeholder cannot draw', () => {
    const { [BENCH_START]: _dropped, ...missing } = blurhashes;

    expect(() => renderCatalogImages(exercises, pending, missing)).toThrow(BENCH_START);
  });

  it('leaves out the exercises waiting for photos, whose files a require would not find', () => {
    const text = renderCatalogImages(exercises, pending, blurhashes);

    expect(pending.length).toBeGreaterThan(0);
    for (const id of pending) expect(text).not.toContain(`'${id.replace(/^ex:/, '')}': {`);
  });

  it('refuses an entry whose images break the one layout the app resolves', () => {
    const odd = { id: 'ex:odd', images: { start: 'images/odd/start.webp', end: 'images/odd/1.webp', thumb: 'x.webp' } };

    expect(() => renderCatalogImages([odd], [], {})).toThrow('ex:odd');
  });
});

describe('exerciseImageSource', () => {
  it('resolves each frame of a bundled exercise to its own asset', () => {
    const frames = ['0', '1', 'thumb'].map(frame =>
      exerciseImageSource(`assets/catalog/images/barbell-bench-press-medium-grip/${frame}.webp`),
    );

    for (const frame of frames) expect(frame).not.toBeNull();
    expect(new Set(frames.map(frame => JSON.stringify(frame))).size).toBe(3);
  });

  it('is null for an exercise waiting for photos, a URL, a local path and no path', () => {
    expect(exerciseImageSource('assets/catalog/images/kettlebell-halo/0.webp')).toBeNull();
    expect(exerciseImageSource('https://example.com/bench.png')).toBeNull();
    expect(exerciseImageSource('file:///photo.jpg')).toBeNull();
    expect(exerciseImageSource(null)).toBeNull();
  });
});
