import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { exerciseImageSource } from '@/features/exercises/mappers/exerciseImageSource';
import { CATALOG_IMAGES_OUTPUT, readCatalogImageInputs, renderCatalogImages } from '@/scripts/catalogImages';

const committed = () => readFileSync(resolve(__dirname, '../../../..', CATALOG_IMAGES_OUTPUT), 'utf8');

describe('the bundled photo map', () => {
  it('is the file `npm run catalog:images` writes from the committed dataset', () => {
    const { exercises, pending } = readCatalogImageInputs();

    expect(committed()).toBe(renderCatalogImages(exercises, pending));
  });

  it('would change when the dataset gains an exercise, so a forgotten regeneration fails the test above', () => {
    const { exercises, pending } = readCatalogImageInputs();
    const added = {
      id: 'ex:new-press',
      images: {
        start: 'images/new-press/0.webp',
        end: 'images/new-press/1.webp',
        thumb: 'images/new-press/thumb.webp',
      },
    };

    expect(renderCatalogImages([...exercises, added], pending)).not.toBe(committed());
  });

  it('leaves out the exercises waiting for photos, whose files a require would not find', () => {
    const { exercises, pending } = readCatalogImageInputs();
    const text = renderCatalogImages(exercises, pending);

    expect(pending.length).toBeGreaterThan(0);
    for (const id of pending) expect(text).not.toContain(`'${id.replace(/^ex:/, '')}': {`);
  });

  it('refuses an entry whose images break the one layout the app resolves', () => {
    const odd = { id: 'ex:odd', images: { start: 'images/odd/start.webp', end: 'images/odd/1.webp', thumb: 'x.webp' } };

    expect(() => renderCatalogImages([odd], [])).toThrow('ex:odd');
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
